"""Telegram notification sender — fire-and-forget, never blocks the pipeline."""

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Sends alert notifications via Telegram Bot API.

    Designed as fire-and-forget: failures are logged but never raised.
    If TELEGRAM_BOT_TOKEN is not configured, notifications are silently skipped.
    """

    def __init__(self):
        self._enabled = bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)
        self._client: Optional[httpx.AsyncClient] = None

        if not self._enabled:
            logger.info("Telegram notifications disabled (token or chat_id not configured)")

    async def _get_client(self) -> Optional[httpx.AsyncClient]:
        if not self._enabled:
            return None
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(10.0))
        return self._client

    async def send_alert(
        self,
        ip: str,
        risk_score: int,
        action: str,
        reason: str,
        dry_run: bool = True,
    ) -> None:
        """Send a blocking/mitigation alert to the configured Telegram chat.

        Args:
            ip: Source IP that was blocked (or would be blocked).
            risk_score: DeepSeek risk score (0-10).
            action: Action taken ("BLOCKED", "DRY_RUN_BLOCKED", "ALLOWED").
            reason: Short reason from the AI.
            dry_run: Whether this was a dry run.
        """
        if not self._enabled:
            return

        dry_run_label = "true" if dry_run else "false"
        message = (
            f"🛡️ AI Shield Alert\n"
            f"\n"
            f"IP: {ip}\n"
            f"Risk: {risk_score}/10\n"
            f"Action: {action}\n"
            f"Reason: {reason}\n"
            f"Dry-run: {dry_run_label}"
        )

        try:
            client = await self._get_client()
            if client is None:
                return
            resp = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": settings.TELEGRAM_CHAT_ID,
                    "text": message,
                    "parse_mode": "HTML",
                },
            )
            if resp.status_code != 200:
                logger.warning("Telegram API returned %d: %s", resp.status_code, resp.text[:200])
            else:
                logger.info("Telegram notification sent for IP %s", ip)
        except Exception:
            logger.exception("Failed to send Telegram notification for IP %s", ip)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
