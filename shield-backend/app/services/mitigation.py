"""Mitigation orchestrator — the final pipeline stage (Sections 2-5).

Coordinates: safety guard → whitelist override → deterministic rules →
dry-run check → escalation policy → two-phase MikroTik execution →
audit logging → Telegram notification.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.services.aggregator import AggregatedEvent
from app.services.audit import AuditLogger
from app.services.mikrotik import MikroTikExecutor
from app.services.safety_guard import SafetyGuard, sanitize_ros_comment, validate_ros_timeout, validate_ros_list_name
from app.services.telegram import TelegramNotifier
from app.services.whitelist import WhitelistEngine
from app.services.rule_engine import DeterministicRuleEngine, DecisionSource
from app.utils.schema import DeepSeekDecision

logger = logging.getLogger(__name__)


class MitigationOrchestrator:
    """Takes AI/rule decisions and executes the appropriate blocking/mitigation action.

    Enhanced safety chain:
    0. Safety guard validation (IP, infrastructure, self-lockout)
    1. Whitelist override (whitelist ALWAYS wins)
    2. Deterministic rule evaluation
    3. Escalation policy (first=1h, second=24h, repeated=7d)
    4. Dry-run check (DRY_RUN=true → log only)
    5. Two-phase MikroTik operation (prepare → execute → verify)
    6. Audit logging with tamper-evident chaining
    7. Telegram notification (dedup-aware)
    """

    def __init__(
        self,
        whitelist: WhitelistEngine,
        mikrotik: MikroTikExecutor,
        audit: AuditLogger,
        telegram: TelegramNotifier,
        rule_engine: DeterministicRuleEngine | None = None,
    ):
        self._whitelist = whitelist
        self._mikrotik = mikrotik
        self._audit = audit
        self._telegram = telegram
        self._rule_engine = rule_engine or DeterministicRuleEngine()
        self._safety = SafetyGuard(whitelist)
        # Idempotency tracking to prevent duplicate mitigation
        self._executed_keys: set[str] = set()
        # Offense tracking for escalation
        self._offense_cache: dict[str, int] = {}

    def _make_idempotency_key(self, ip: str, window_start) -> str:
        """Generate an idempotency key: mitigation:<ip>:<window_start>."""
        return f"mitigation:{ip}:{window_start}"

    def _is_duplicate(self, key: str) -> bool:
        if key in self._executed_keys:
            return True
        self._executed_keys.add(key)
        # Keep set bounded
        if len(self._executed_keys) > 10000:
            self._executed_keys.clear()
        return False

    def _get_escalation_timeout(self, ip: str) -> tuple[str, int]:
        """Determine block timeout based on offense history (Section 2).

        Returns (timeout_str, offense_count).
        """
        count = self._rule_engine.get_offense_count(ip)
        if count >= 3:
            return getattr(settings, 'REPEAT_BLOCK_TIMEOUT', '7d'), count
        elif count >= 2:
            return getattr(settings, 'SECOND_BLOCK_TIMEOUT', '24h'), count
        else:
            return getattr(settings, 'FIRST_BLOCK_TIMEOUT', '1h'), count

    async def handle(
        self,
        aggregated: AggregatedEvent,
        decision: DeepSeekDecision,
        admin_ip: Optional[str] = None,
    ) -> dict:
        """Execute the full mitigation decision pipeline."""
        src_ip = aggregated.src_ip

        # ---------------------------------------------------------------
        # 0. Safety guard
        # ---------------------------------------------------------------
        safety = self._safety.validate_block(src_ip, admin_ip=admin_ip)
        if not safety.allowed:
            logger.warning("SAFETY GUARD: %s — %s", src_ip, safety.reason)
            await self._audit.log_decision(
                src_ip=src_ip, risk_score=decision.risk_score,
                reason=safety.reason, dry_run=True,
                action="safety_blocked", result="skipped",
            )
            return {"action": "safety_blocked", "success": True, "blocked": False, "reason": safety.reason}

        # ---------------------------------------------------------------
        # 1. Whitelist override
        # ---------------------------------------------------------------
        if self._whitelist.is_whitelisted(src_ip):
            logger.info("WHITELIST OVERRIDE: %s", src_ip)
            await self._audit.log_decision(
                src_ip=src_ip, risk_score=decision.risk_score,
                reason=decision.reason, dry_run=True,
                action="whitelist_override", result="skipped",
            )
            return {"action": "whitelist_override", "success": True, "blocked": False}

        # ---------------------------------------------------------------
        # 2. Deterministic rule engine check
        # ---------------------------------------------------------------
        rule_result = self._rule_engine.evaluate(
            src_ip=src_ip,
            count=aggregated.count,
            unique_ports=aggregated.unique_ports,
            unique_hosts=aggregated.unique_targets,
        )

        # Combine AI + rule engine decision
        decision_source = DecisionSource.DEEPSEEK
        if rule_result.matched and rule_result.risk_score >= decision.risk_score:
            decision_source = DecisionSource.RULE_ENGINE

        # ---------------------------------------------------------------
        # 3. Risk score check (AI + deterministic)
        # ---------------------------------------------------------------
        effective_score = max(decision.risk_score, rule_result.risk_score if rule_result.matched else 0)
        if not decision.is_malicious and not rule_result.matched:
            await self._audit.log_decision(
                src_ip=src_ip, risk_score=effective_score,
                reason=decision.reason, dry_run=True,
                action="allowed", result="skipped",
            )
            return {"action": "allowed", "success": True, "blocked": False}

        if effective_score < settings.AI_BLOCK_RISK_SCORE and not rule_result.matched:
            await self._audit.log_decision(
                src_ip=src_ip, risk_score=effective_score,
                reason=f"Risk score {effective_score} below threshold {settings.AI_BLOCK_RISK_SCORE}",
                dry_run=True, action="below_threshold", result="skipped",
            )
            return {"action": "below_threshold", "success": True, "blocked": False}

        # ---------------------------------------------------------------
        # 4. Escalation timeout — record offense first so count is correct
        # ---------------------------------------------------------------
        self._rule_engine.record_offense(src_ip)
        timeout, offense_count = self._get_escalation_timeout(src_ip)

        # ---------------------------------------------------------------
        # 5. Idempotency check
        # ---------------------------------------------------------------
        id_key = self._make_idempotency_key(src_ip, aggregated.window_start.isoformat())
        if self._is_duplicate(id_key):
            logger.info("Duplicate mitigation skipped: %s", id_key)
            return {"action": "duplicate_skipped", "success": True, "blocked": False}

        # ---------------------------------------------------------------
        # 6. Dry-run gate
        # ---------------------------------------------------------------
        if settings.DRY_RUN:
            logger.info("DRY-RUN: Would block IP %s (risk=%d, timeout=%s)", src_ip, effective_score, timeout)
            await self._audit.log_decision(
                src_ip=src_ip, risk_score=effective_score,
                reason=decision.reason or rule_result.reason,
                dry_run=True, action="would_block", result="dry_run_skipped",
            )
            await self._telegram.send_alert(
                ip=src_ip, risk_score=effective_score,
                action="DRY_RUN_BLOCKED", reason=decision.reason, dry_run=True,
            )
            return {"action": "dry_run_blocked", "success": True, "blocked": False}

        # ---------------------------------------------------------------
        # 7. Two-phase MikroTik operation (prepare → execute → verify)
        # ---------------------------------------------------------------
        comment = f"AI Shield: {sanitize_ros_comment(decision.reason or rule_result.reason)}"

        # Phase 1: Prepare
        if not validate_ros_timeout(timeout):
            return {"action": "invalid_timeout", "success": False, "blocked": False}
        if not validate_ros_list_name("ai_blacklist"):
            return {"action": "invalid_list_name", "success": False, "blocked": False}

        # Phase 2: Execute
        result = await self._mikrotik.add_to_address_list(
            ip=src_ip, list_name="ai_blacklist",
            timeout_str=timeout, comment=comment,
        )

        # Phase 3: Verify (read back)
        if result["success"]:
            is_blocked = await self._mikrotik.is_ip_blocked(src_ip)
            if not is_blocked:
                logger.error("Verification failed: %s not found in address-list after add", src_ip)
                result = {"success": False, "action": "verification_failed",
                          "output": "IP not found in address-list after add", "error": "verification_failed"}

        # ---------------------------------------------------------------
        # 8. Audit + notify
        # ---------------------------------------------------------------
        await self._audit.log_decision(
            src_ip=src_ip, risk_score=effective_score,
            reason=decision.reason or rule_result.reason,
            dry_run=False,
            action="mikrotik_address_list_add",
            result="success" if result["success"] else "failed",
        )

        if result["success"]:
            await self._telegram.send_alert(
                ip=src_ip, risk_score=effective_score,
                action="BLOCKED", reason=decision.reason, dry_run=False,
            )

        return {
            "action": "blocked" if result["success"] else "block_failed",
            "success": result["success"],
            "blocked": result["success"],
            "reason": decision.reason or rule_result.reason,
            "decision_source": decision_source.value,
            "timeout": timeout,
            "mikrotik_result": result,
        }
