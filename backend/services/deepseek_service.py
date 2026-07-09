"""DeepSeek API integration for AI-powered alert analysis."""

import asyncio
import json
import logging
from datetime import datetime

from openai import AsyncOpenAI

from config import settings
from database import Analysis, BlockEvent, get_session

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a network security analyst AI. Analyze Suricata IDS alerts and determine if the source IP should be blocked at the firewall.

Rules:
- Block if: repeated attack patterns, known malicious signatures, scanning behavior, high severity
- Flag if: suspicious but could be false positive, needs human review
- Allow if: likely false positive, normal traffic, low severity

Respond with JSON only:
{
  "decision": "block" | "flag" | "allow",
  "confidence": 0.0-1.0,
  "reasoning": "brief analysis in Vietnamese",
  "suggested_block_timeout_hours": 24,
  "block_scope": "src_ip"
}"""


class DeepSeekService:
    """AI analysis via DeepSeek API."""

    def __init__(self):
        self._client: AsyncOpenAI | None = None
        self._ws_manager = None
        self._request_times: list[float] = []  # Rate limiting
        self._cache: dict[str, dict] = {}

    def set_ws_manager(self, manager):
        self._ws_manager = manager

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            api_key = settings.deepseek_api_key
            if not api_key:
                raise ValueError("DEEPSEEK_API_KEY not configured")
            self._client = AsyncOpenAI(
                api_key=api_key,
                base_url=settings.deepseek_base_url,
            )
        return self._client

    async def analyze_alert(self, alert_data: dict) -> dict:
        """Send alert to DeepSeek for analysis. Returns decision dict."""
        # Rate limiting: max 10 requests/minute
        now = asyncio.get_event_loop().time()
        self._request_times = [t for t in self._request_times if now - t < 60]
        if len(self._request_times) >= 10:
            wait = 60 - (now - self._request_times[0]) + 1
            logger.info(f"Rate limiting AI, waiting {wait:.0f}s")
            await asyncio.sleep(wait)
        self._request_times.append(now)

        # Check cache (same src_ip + signature within 5 minutes)
        cache_key = f"{alert_data.get('src_ip')}:{alert_data.get('alert_signature')}"
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            age = (datetime.utcnow() - cached["timestamp"]).total_seconds()
            if age < 300:
                return cached["result"]

        user_prompt = f"""Alert to analyze:
Signature: {alert_data.get('alert_signature', 'Unknown')}
Category: {alert_data.get('alert_category', 'Unknown')}
Severity: {alert_data.get('alert_severity', 3)} (1=Critical, 2=High, 3=Medium, 4=Low)
Source: {alert_data.get('src_ip', '?')}:{alert_data.get('src_port', '?')}
Destination: {alert_data.get('dest_ip', '?')}:{alert_data.get('dest_port', '?')}
Protocol: {alert_data.get('proto', '?')}
Timestamp: {alert_data.get('timestamp', '?')}"""

        try:
            response = await self.client.chat.completions.create(
                model=settings.deepseek_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=500,
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            # Validate
            result.setdefault("decision", "flag")
            result.setdefault("confidence", 0.0)
            result.setdefault("reasoning", "")
            result.setdefault("suggested_block_timeout_hours", 24)
            result.setdefault("block_scope", "src_ip")

        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            result = {
                "decision": "flag",
                "confidence": 0.0,
                "reasoning": f"API error: {str(e)}",
                "suggested_block_timeout_hours": 24,
                "block_scope": "src_ip",
            }

        # Cache
        self._cache[cache_key] = {"result": result, "timestamp": datetime.utcnow()}
        # Limit cache size
        if len(self._cache) > 1000:
            self._cache.clear()

        return result

    async def analyze_and_store(self, alert_data: dict, alert_id: int) -> dict:
        """Analyze alert and store result in database. Returns the analysis result."""
        result = await self.analyze_alert(alert_data)

        # Store in DB
        session = get_session()
        try:
            analysis = Analysis(
                alert_id=alert_id,
                decision=result["decision"],
                confidence=result["confidence"],
                reasoning=result["reasoning"],
                suggested_block_timeout_hours=result.get("suggested_block_timeout_hours", 24),
                block_scope=result.get("block_scope", "src_ip"),
                full_response=json.dumps(result),
                model_used=settings.deepseek_model,
                tokens_used=0,
            )
            session.add(analysis)
            session.commit()
            analysis_id = analysis.id
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to store analysis: {e}")
            analysis_id = None
        finally:
            session.close()

        # Broadcast result
        if self._ws_manager:
            await self._ws_manager.broadcast({
                "type": "analysis",
                "payload": {
                    "alert_id": alert_id,
                    "analysis_id": analysis_id,
                    "decision": result["decision"],
                    "confidence": result["confidence"],
                    "reasoning": result["reasoning"],
                    "timestamp": datetime.utcnow().isoformat(),
                },
            })

        return result

    async def get_analysis_history(self, limit: int = 50) -> list[dict]:
        """Get recent analysis results."""
        session = get_session()
        try:
            analyses = session.query(Analysis).order_by(
                Analysis.analyzed_at.desc()
            ).limit(limit).all()

            results = []
            for a in analyses:
                results.append({
                    "id": a.id,
                    "alert_id": a.alert_id,
                    "decision": a.decision,
                    "confidence": a.confidence,
                    "reasoning": a.reasoning,
                    "analyzed_at": a.analyzed_at,
                })
            return results
        finally:
            session.close()


# Singleton
deepseek_service = DeepSeekService()
