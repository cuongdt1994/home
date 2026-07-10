"""Mitigation orchestrator — the final pipeline stage.

Coordinates: whitelist override → dry-run check → MikroTik execution →
audit logging → Telegram notification.
"""

import logging
from typing import Optional

from app.config import settings
from app.services.aggregator import AggregatedEvent
from app.services.audit import AuditLogger
from app.services.deepseek import DeepSeekClient
from app.services.mikrotik import MikroTikExecutor
from app.services.telegram import TelegramNotifier
from app.services.whitelist import WhitelistEngine
from app.utils.schema import DeepSeekDecision

logger = logging.getLogger(__name__)


class MitigationOrchestrator:
    """Takes AI decisions and executes the appropriate blocking/mitigation action.

    Enforces the full safety chain:
    1. Final whitelist override (whitelist ALWAYS wins)
    2. Dry-run check (DRY_RUN=true → log only)
    3. MikroTik address-list management
    4. Audit logging
    5. Telegram notification
    """

    def __init__(
        self,
        whitelist: WhitelistEngine,
        mikrotik: MikroTikExecutor,
        audit: AuditLogger,
        telegram: TelegramNotifier,
    ):
        self._whitelist = whitelist
        self._mikrotik = mikrotik
        self._audit = audit
        self._telegram = telegram

    async def handle(
        self,
        aggregated: AggregatedEvent,
        decision: DeepSeekDecision,
    ) -> dict:
        """Execute the mitigation decision pipeline.

        Args:
            aggregated: The aggregated event that triggered analysis.
            decision: The validated DeepSeek AI decision.

        Returns:
            A result dict with action, success, and details.
        """
        src_ip = aggregated.src_ip
        risk_score = decision.risk_score
        reason = decision.reason

        # ---------------------------------------------------------------
        # SAFETY GATE 1: Whitelist override (ALWAYS wins)
        # ---------------------------------------------------------------
        if self._whitelist.is_whitelisted(src_ip):
            logger.info(
                "WHITELIST OVERRIDE: %s classified as malicious (score=%d) but is whitelisted — skipping block",
                src_ip, risk_score,
            )
            await self._audit.log_decision(
                src_ip=src_ip,
                risk_score=risk_score,
                reason=reason,
                dry_run=True,
                action="whitelist_override",
                result="skipped",
                deepseek_latency_ms=None,
                details={"reason_override": "IP is whitelisted"},
            )
            return {
                "action": "whitelist_override",
                "success": True,
                "blocked": False,
                "reason": "IP is in whitelist — block overridden",
            }

        # ---------------------------------------------------------------
        # SAFETY GATE 2: Dry-run mode
        # ---------------------------------------------------------------
        if settings.DRY_RUN:
            logger.info("DRY-RUN: Would block IP %s (risk=%d): %s", src_ip, risk_score, reason)

            await self._audit.log_decision(
                src_ip=src_ip,
                risk_score=risk_score,
                reason=reason,
                dry_run=True,
                action="would_block",
                result="dry_run_skipped",
                deepseek_latency_ms=None,
            )

            # Fire-and-forget Telegram notification
            await self._telegram.send_alert(
                ip=src_ip,
                risk_score=risk_score,
                action="DRY_RUN_BLOCKED",
                reason=reason,
                dry_run=True,
            )

            return {
                "action": "dry_run_blocked",
                "success": True,
                "blocked": False,
                "reason": f"DRY-RUN: Would block IP {src_ip}",
            }

        # ---------------------------------------------------------------
        # EXECUTE: Add to MikroTik address-list
        # ---------------------------------------------------------------
        result = await self._mikrotik.add_to_address_list(
            ip=src_ip,
            list_name="ai_blacklist",
            timeout_str=settings.MIKROTIK_BLACKLIST_TIMEOUT,
            comment=f"AI Shield: {reason}",
        )

        # ---------------------------------------------------------------
        # Audit + notify
        # ---------------------------------------------------------------
        await self._audit.log_decision(
            src_ip=src_ip,
            risk_score=risk_score,
            reason=reason,
            dry_run=False,
            action="mikrotik_address_list_add",
            result="success" if result["success"] else "failed",
            deepseek_latency_ms=None,
            details={"mikrotik_output": result},
        )

        if result["success"]:
            await self._telegram.send_alert(
                ip=src_ip,
                risk_score=risk_score,
                action="BLOCKED",
                reason=reason,
                dry_run=False,
            )

        return {
            "action": "blocked" if result["success"] else "block_failed",
            "success": result["success"],
            "blocked": result["success"],
            "reason": reason,
            "mikrotik_result": result,
        }
