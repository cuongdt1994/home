"""DeepSeek AI API client with strict JSON validation, bounded concurrency,
prompt-injection protection (Section 7), and budget controls (Section 8)."""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from pydantic import ValidationError

from app.config import settings
from app.services.prompt_sanitizer import build_safe_event_summary, validate_deepseek_response
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
    """Async client for the DeepSeek API with timeout, semaphore, validation,
    prompt-injection protection, budget tracking, and circuit breaker."""

    def __init__(self):
        self._semaphore = asyncio.Semaphore(settings.AI_MAX_CONCURRENT_REQUESTS)
        self._client: Optional[httpx.AsyncClient] = None
        self._last_latency_ms: Optional[float] = None
        # Budget tracking (Section 8)
        self._hourly_count = 0
        self._daily_count = 0
        self._hour_reset = datetime.now(timezone.utc)
        self._day_reset = datetime.now(timezone.utc)
        # Circuit breaker (Section 8)
        self._failure_count = 0
        self._last_failure_time: float = 0.0
        self._circuit_open = False
        self._circuit_opened_at: float = 0.0
        # Cache for deduplication
        self._decision_cache: dict[str, tuple[float, DeepSeekDecision]] = {}
        self._cache_ttl = getattr(settings, 'AI_CACHE_TTL_SECONDS', 3600)

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

    async def analyze(self, event_summary: str, raw_event_data: dict | None = None) -> DeepSeekDecision:
        """Send a sanitized event summary to DeepSeek for classification.

        Args:
            event_summary: Human-readable summary (legacy, not used if raw_event_data provided).
            raw_event_data: Raw aggregated event data — will be sanitized before sending.

        Returns:
            Validated DeepSeekDecision, or SAFE_DECISION on any failure.
        """
        # Check if AI is enabled
        if not getattr(settings, 'AI_ENABLED', True):
            return SAFE_DECISION

        # Check budget limits (Section 8)
        self._check_budget_reset()
        daily_limit = getattr(settings, 'AI_DAILY_REQUEST_LIMIT', 500)
        hourly_limit = getattr(settings, 'AI_HOURLY_REQUEST_LIMIT', 100)
        if self._daily_count >= daily_limit or self._hourly_count >= hourly_limit:
            logger.warning("AI budget exhausted (daily=%d/%d, hourly=%d/%d)",
                           self._daily_count, daily_limit, self._hourly_count, hourly_limit)
            return SAFE_DECISION

        # Check circuit breaker
        if self._circuit_open:
            cooldown = getattr(settings, 'AI_FAILURE_COOLDOWN_SECONDS', 300)
            if time.monotonic() - self._circuit_opened_at < cooldown:
                logger.warning("Circuit breaker open — skipping AI call")
                return SAFE_DECISION
            else:
                self._circuit_open = False
                self._failure_count = 0
                logger.info("Circuit breaker reset")

        # Cache check
        cache_key = event_summary[:200]
        if cache_key in self._decision_cache:
            cached_time, cached_decision = self._decision_cache[cache_key]
            if time.monotonic() - cached_time < self._cache_ttl:
                logger.debug("AI cache hit")
                return cached_decision

        # Build sanitized prompt if raw data provided
        safe_summary = event_summary
        if raw_event_data:
            safe_summary = build_safe_event_summary(raw_event_data)

        async with self._semaphore:
            result = await self._call_api(safe_summary)

        # Cache result
        self._decision_cache[cache_key] = (time.monotonic(), result)
        # Prune cache
        if len(self._decision_cache) > 1000:
            self._decision_cache.clear()

        return result

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

            # Validate with sanitizer (Section 7)
            parsed = validate_deepseek_response(content)
            if parsed is None:
                raise ValueError(f"DeepSeek response failed validation: {content[:200]}")

            decision = DeepSeekDecision.model_validate(parsed)

            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._hourly_count += 1
            self._daily_count += 1
            self._failure_count = 0  # Reset on success
            logger.info(
                "DeepSeek decision: malicious=%s risk=%d latency=%.0fms",
                decision.is_malicious, decision.risk_score, elapsed,
            )
            return decision

        except httpx.TimeoutException:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._failure_count += 1
            logger.warning("DeepSeek timeout after %.0fms (failure %d)", elapsed, self._failure_count)
            self._check_circuit_breaker()
            return SAFE_DECISION

        except (json.JSONDecodeError, ValidationError) as e:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._failure_count += 1
            logger.warning("DeepSeek returned invalid response: %s (failure %d)", e, self._failure_count)
            self._check_circuit_breaker()
            return SAFE_DECISION

        except httpx.HTTPStatusError as e:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._failure_count += 1
            logger.error("DeepSeek HTTP %d: %s (failure %d)", e.response.status_code, e.response.text[:200], self._failure_count)
            self._check_circuit_breaker()
            return SAFE_DECISION

        except Exception:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._failure_count += 1
            logger.exception("DeepSeek unexpected error (failure %d)", self._failure_count)
            self._check_circuit_breaker()
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

    def _check_circuit_breaker(self) -> None:
        """Open circuit breaker after repeated failures."""
        self._last_failure_time = time.monotonic()
        if self._failure_count >= 5:
            self._circuit_open = True
            self._circuit_opened_at = time.monotonic()
            logger.warning("Circuit breaker OPEN after %d failures", self._failure_count)

    def _check_budget_reset(self) -> None:
        """Reset hourly/daily counters when their windows expire."""
        now = datetime.now(timezone.utc)
        if (now - self._hour_reset).total_seconds() >= 3600:
            self._hourly_count = 0
            self._hour_reset = now
        if (now - self._day_reset).total_seconds() >= 86400:
            self._daily_count = 0
            self._day_reset = now

    def get_metrics(self) -> dict:
        """Return AI usage metrics for Prometheus/health."""
        return {
            "hourly_requests": self._hourly_count,
            "daily_requests": self._daily_count,
            "failure_count": self._failure_count,
            "circuit_open": self._circuit_open,
            "cache_size": len(self._decision_cache),
            "last_latency_ms": self._last_latency_ms,
        }

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
