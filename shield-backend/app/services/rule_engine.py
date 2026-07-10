"""Deterministic rule engine (Section 1).

Evaluates Suricata events against deterministic rules BEFORE any AI analysis.
AI should enrich and classify ambiguous aggregated activity, not replace
deterministic security controls.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class DecisionSource(str, Enum):
    RULE_ENGINE = "rule_engine"
    DEEPSEEK = "deepseek"
    MANUAL = "manual"
    REPUTATION = "reputation"
    COMBINED = "combined"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class RuleResult:
    matched: bool
    rule_name: str
    action: str  # "observe", "temporary_block", "permanent_block"
    timeout: Optional[str] = None
    risk_score: int = 0
    source: DecisionSource = DecisionSource.RULE_ENGINE
    reason: str = ""


@dataclass
class DeterministicRule:
    name: str
    description: str = ""
    # Match conditions
    signature_ids: set[int] = field(default_factory=set)
    categories: set[str] = field(default_factory=set)
    min_severity: int = 0
    min_count: int = 1
    min_unique_ports: int = 0
    min_unique_hosts: int = 0
    # Action
    action: str = "observe"
    timeout: Optional[str] = None
    risk_score: int = 5
    # Control
    enabled: bool = True
    priority: int = 100  # lower = higher priority


class DeterministicRuleEngine:
    """Evaluates events against deterministic rules before AI analysis.

    Rules are checked in priority order. First matching rule wins.
    """

    def __init__(self):
        self._rules: list[DeterministicRule] = []
        self._offense_history: dict[str, list[datetime]] = {}  # IP -> list of offense timestamps
        self._load_default_rules()

    def _load_default_rules(self) -> None:
        """Load built-in deterministic rules."""
        self._rules = [
            DeterministicRule(
                name="critical_exploit",
                description="Known exploit signatures — immediate block",
                signature_ids={2025788},  # ET EXPLOIT
                min_severity=1,
                min_count=1,
                action="temporary_block",
                timeout="24h",
                risk_score=10,
                priority=10,
            ),
            DeterministicRule(
                name="ssh_brute_force_deterministic",
                description="High-volume SSH brute force",
                categories={"Attempted Administrator Privilege Gain"},
                min_severity=2,
                min_count=20,
                min_unique_ports=1,
                action="temporary_block",
                timeout="1h",
                risk_score=8,
                priority=20,
            ),
            DeterministicRule(
                name="port_scan_deterministic",
                description="Wide port scan (> 50 unique ports)",
                categories={"Network Trojan was detected", "Attempted Information Leak"},
                min_count=5,
                min_unique_ports=50,
                action="temporary_block",
                timeout="1h",
                risk_score=7,
                priority=30,
            ),
            DeterministicRule(
                name="critical_suricata_rule",
                description="Any critical-severity Suricata alert at volume",
                min_severity=1,
                min_count=5,
                action="temporary_block",
                timeout="1h",
                risk_score=8,
                priority=40,
            ),
            DeterministicRule(
                name="repeat_offender",
                description="Previously blocked IP offending again within 7 days",
                min_count=1,
                action="temporary_block",
                timeout="24h",
                risk_score=9,
                priority=15,
            ),
            DeterministicRule(
                name="high_severity_volume",
                description="High-severity alerts at moderate volume",
                min_severity=2,
                min_count=10,
                action="observe",
                risk_score=6,
                priority=50,
            ),
        ]

    def evaluate(
        self,
        src_ip: str,
        signature_id: Optional[int] = None,
        category: Optional[str] = None,
        severity: Optional[int] = None,
        count: int = 1,
        unique_ports: int = 0,
        unique_hosts: int = 0,
    ) -> RuleResult:
        """Evaluate an aggregated event against deterministic rules.

        Returns the first matching rule, or a default "observe" result.
        """
        for rule in sorted(self._rules, key=lambda r: r.priority):
            if not rule.enabled:
                continue

            # Check signature IDs
            if rule.signature_ids and signature_id:
                if signature_id not in rule.signature_ids:
                    continue

            # Check categories
            if rule.categories and category:
                if not any(c.lower() in (category or "").lower() for c in rule.categories):
                    continue

            # Check severity
            if severity is not None and rule.min_severity > 0:
                # Suricata severity: 1=critical, 4=info (lower is worse)
                if severity > rule.min_severity:
                    continue

            # Check volume
            if count < rule.min_count:
                continue
            if unique_ports < rule.min_unique_ports:
                continue
            if unique_hosts < rule.min_unique_hosts:
                continue

            # Check repeat offender
            if rule.name == "repeat_offender":
                if not self._is_repeat_offender(src_ip):
                    continue

            logger.info(
                "Rule '%s' matched for %s (count=%d, sev=%d)",
                rule.name, src_ip, count, severity,
            )
            return RuleResult(
                matched=True,
                rule_name=rule.name,
                action=rule.action,
                timeout=rule.timeout,
                risk_score=rule.risk_score,
                reason=f"Deterministic rule: {rule.description}",
            )

        # No rule matched
        return RuleResult(
            matched=False,
            rule_name="default",
            action="observe",
            risk_score=0,
            reason="No deterministic rule matched",
        )

    def record_offense(self, ip: str) -> None:
        """Record an offense for repeat-offender tracking."""
        now = datetime.now(timezone.utc)
        if ip not in self._offense_history:
            self._offense_history[ip] = []
        self._offense_history[ip].append(now)

        # Prune old entries (>30 days)
        cutoff = now - timedelta(days=30)
        self._offense_history[ip] = [
            t for t in self._offense_history[ip] if t > cutoff
        ]

    def _is_repeat_offender(self, ip: str) -> bool:
        """Check if IP has offended in the last 7 days."""
        if ip not in self._offense_history:
            return False
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        recent = [t for t in self._offense_history[ip] if t > cutoff]
        return len(recent) >= 2

    @property
    def rule_count(self) -> int:
        return len(self._rules)

    def get_offense_count(self, ip: str) -> int:
        if ip not in self._offense_history:
            return 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        return len([t for t in self._offense_history[ip] if t > cutoff])
