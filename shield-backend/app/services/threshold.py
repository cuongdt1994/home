"""Threshold evaluation engine — decides when aggregated events qualify for AI analysis."""

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

import yaml

from app.services.normalizer import NormalizedEvent

logger = logging.getLogger(__name__)


@dataclass
class ThresholdRule:
    """A single threshold rule from thresholds.yaml."""
    name: str
    min_count: int = 1
    min_unique_ports: int = 0
    window_seconds: int = 300
    match_event_types: list[str] = field(default_factory=list)
    match_categories: list[str] = field(default_factory=list)
    match_severity: Optional[int] = None


class ThresholdEngine:
    """Loads and evaluates threshold rules from thresholds.yaml.

    Supports hot-reload via reload().
    """

    def __init__(self, file_path: str):
        self._file_path = file_path
        self._default_window: int = 300
        self._rules: list[ThresholdRule] = []
        self._default_rule = ThresholdRule(name="default", min_count=15, window_seconds=300)
        self.reload()

    def reload(self) -> None:
        """Reload thresholds from YAML file. Call under app-level coordination."""
        if not os.path.exists(self._file_path):
            logger.warning("Thresholds file not found: %s — using defaults", self._file_path)
            return

        try:
            with open(self._file_path, "r") as f:
                config = yaml.safe_load(f) or {}
        except Exception:
            logger.exception("Failed to read thresholds file")
            return

        self._default_window = config.get("windows", {}).get("default_seconds", 300)

        rules = []
        rules_cfg = config.get("rules", {})
        for name, rule_cfg in rules_cfg.items():
            if name == "default":
                self._default_rule = ThresholdRule(name="default", **rule_cfg)
            else:
                rules.append(ThresholdRule(name=name, **rule_cfg))

        self._rules = rules
        logger.info(
            "Thresholds loaded: %d rules, default_window=%ds",
            len(self._rules), self._default_window,
        )

    def get_window_for_event(self, event: NormalizedEvent) -> int:
        """Return the appropriate window_seconds for a given event."""
        for rule in self._rules:
            if self._event_matches_rule(event, rule):
                return rule.window_seconds
        return self._default_window

    def evaluate(
        self,
        count: int,
        unique_ports: int,
        event: NormalizedEvent,
    ) -> tuple[bool, Optional[str]]:
        """Check if an aggregated bucket exceeds any threshold rule.

        Returns:
            (exceeded, rule_name) — rule_name is the matched rule or None.
        """
        # Check specific rules first — continue on non-match so later
        # rules with lower thresholds still get evaluated
        for rule in self._rules:
            if self._event_matches_rule(event, rule):
                exceeded = self._check_rule(count, unique_ports, rule)
                if exceeded:
                    return True, rule.name
                # Rule matched the event type but threshold not met —
                # continue checking other rules that may have lower thresholds
                continue

        # Fall back to default rule
        exceeded = self._check_rule(count, unique_ports, self._default_rule)
        return exceeded, "default"

    @staticmethod
    def _event_matches_rule(event: NormalizedEvent, rule: ThresholdRule) -> bool:
        """Check if a normalized event matches a threshold rule's criteria."""
        if rule.match_event_types:
            if event.event_type not in rule.match_event_types:
                return False
        if rule.match_categories:
            cat = event.alert_category or ""
            if not any(mc.lower() in cat.lower() for mc in rule.match_categories):
                return False
        if rule.match_severity is not None:
            if event.alert_severity != rule.match_severity:
                return False
        return True

    @staticmethod
    def _check_rule(count: int, unique_ports: int, rule: ThresholdRule) -> bool:
        """Evaluate a single rule against the given metrics."""
        if count < rule.min_count:
            return False
        if rule.min_unique_ports > 0 and unique_ports < rule.min_unique_ports:
            return False
        return True
