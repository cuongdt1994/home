"""DeepSeek AI API client with strict JSON validation and bounded concurrency."""

import asyncio
import json
import logging
import time
from typing import Optional

import httpx
from pydantic import ValidationError

from app.config import settings
from app.utils.schema import DeepSeekDecision

logger = logging.getLogger(__name__)

# System prompt from the spec — strict classification engine
SYSTEM_PROMPT = """You are a strict network security classification engine.

You will receive a summarized security event from a home/office network. Your job is to decide whether the source IP is likely malicious and whether automated blocking is justified.

Return ONLY a valid JSON object. Do not include markdown. Do not include explanations outside JSON.

Schema:
{
  "is_malicious": boolean,
  "risk_score": integer,
  "reason": string
}

Rules:
- risk_score must be an integer from 0 to 10.
- Set is_malicious=true only when the evidence strongly indicates hostile behavior such as brute force, port scanning, exploit probing, malware callback, credential stuffing, or repeated policy violations.
- Do not classify an IP as malicious from one isolated low-severity alert.
- Treat private RFC1918 IP addresses as internal unless the event clearly says they are compromised.
- If evidence is weak, ambiguous, or looks like normal LAN discovery, return is_malicious=false.
- The reason must be short, specific, and based only on the provided event summary.
- Never recommend blocking whitelisted, internal infrastructure, DNS resolvers, gateways, or monitoring systems."""

# Safe default returned on any failure
SAFE_DECISION = DeepSeekDecision(
    is_malicious=False,
    risk_score=0,
    reason="AI analysis unavailable — defaulting to safe",
)


class DeepSeekClient:
    """Async client for the DeepSeek API with timeout, semaphore, and validation."""

    def __init__(self):
        self._semaphore = asyncio.Semaphore(settings.AI_MAX_CONCURRENT_REQUESTS)
        self._client: Optional[httpx.AsyncClient] = None
        self._last_latency_ms: Optional[float] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=settings.DEEPSEEK_BASE_URL,
                timeout=httpx.Timeout(settings.DEEPSEEK_TIMEOUT_SECONDS),
                headers={
                    "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    @property
    def last_latency_ms(self) -> Optional[float]:
        return self._last_latency_ms

    async def analyze(self, event_summary: str) -> DeepSeekDecision:
        """Send an aggregated event summary to DeepSeek for classification.

        Args:
            event_summary: Human-readable summary of aggregated alerts.

        Returns:
            Validated DeepSeekDecision, or SAFE_DECISION on any failure.
        """
        async with self._semaphore:
            return await self._call_api(event_summary)

    async def _call_api(self, event_summary: str) -> DeepSeekDecision:
        """Internal API call with timeout and validation."""
        if not settings.DEEPSEEK_API_KEY:
            logger.warning("DeepSeek API key not configured — skipping AI analysis")
            return SAFE_DECISION

        start = time.monotonic()

        try:
            client = await self._get_client()

            payload = {
                "model": settings.DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": event_summary},
                ],
                "temperature": 0.0,
                "max_tokens": 256,
                "stream": False,
            }

            response = await client.post("/v1/chat/completions", json=payload)
            response.raise_for_status()

            body = response.json()
            content = body["choices"][0]["message"]["content"]

            # Strip markdown code fences if present
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

            parsed = json.loads(content)
            decision = DeepSeekDecision.model_validate(parsed)

            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.info(
                "DeepSeek decision: ip_hidden malicious=%s risk=%d latency=%.0fms",
                decision.is_malicious, decision.risk_score, elapsed,
            )
            return decision

        except httpx.TimeoutException:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.warning("DeepSeek timeout after %.0fms", elapsed)
            return SAFE_DECISION

        except (json.JSONDecodeError, ValidationError) as e:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.warning("DeepSeek returned invalid response: %s (latency=%.0fms)", e, elapsed)
            return SAFE_DECISION

        except httpx.HTTPStatusError as e:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.error("DeepSeek HTTP %d: %s", e.response.status_code, e.response.text[:200])
            return SAFE_DECISION

        except Exception:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.exception("DeepSeek unexpected error")
            return SAFE_DECISION

    async def ping(self) -> tuple[bool, Optional[float]]:
        """Lightweight connectivity check for health endpoint."""
        if not settings.DEEPSEEK_API_KEY:
            return False, None
        try:
            start = time.monotonic()
            # Simple decision on a trivial event
            result = await self.analyze("One informational alert from internal host — normal traffic.")
            elapsed = (time.monotonic() - start) * 1000
            return True, elapsed
        except Exception:
            return False, None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
