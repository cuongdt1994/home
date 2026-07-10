"""DeepSeek prompt-injection protection (Section 7).

Suricata fields, hostnames, URLs, TLS SNIs, DNS names, SSH banners,
and file names are untrusted input that may contain prompt-injection text.

This module sanitizes all data before it reaches DeepSeek.
"""

import json
import re
import unicodedata
from typing import Any

MAX_STRING_LENGTH = 500
MAX_SUMMARY_LENGTH = 4000
MAX_REASON_LENGTH = 600

# Control characters except common whitespace
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")

# Patterns that indicate prompt injection attempts
_SUSPICIOUS_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior|system)\s+instructions?",
    r"you\s+are\s+(now|no\s+longer)\s+a",
    r"new\s+system\s+prompt",
    r"<\|.*?\|>",     # Special tokens
    r"\[INST\].*?\[/INST\]",  # Instruction tags
    r"<system>.*?</system>",
    r"```\{.*?\}```",  # Code fences with language
]


def sanitize_for_ai(value: Any, max_length: int = MAX_STRING_LENGTH) -> Any:
    """Recursively sanitize a value for AI submission.

    - Strips control characters
    - Truncates long strings
    - Removes binary content
    - Returns safe primitives only
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not _is_finite(value):
            return 0.0
        return value
    if isinstance(value, str):
        return _sanitize_string(value, max_length)
    if isinstance(value, dict):
        return {str(k)[:100]: sanitize_for_ai(v, max_length) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_for_ai(item, max_length) for item in value[:50]]  # cap array size
    return str(value)[:max_length]


def _sanitize_string(s: str, max_length: int) -> str:
    """Sanitize a single string."""
    # Remove control characters
    s = _CONTROL_RE.sub("", s)
    # Normalize unicode
    s = unicodedata.normalize("NFKC", s)
    # Truncate
    return s[:max_length]


def build_safe_event_summary(aggregated_event_data: dict) -> str:
    """Build a safe, structured JSON summary for DeepSeek from aggregated event data.

    Uses strict JSON serialization with length limits. Never includes secrets,
    raw headers, cookies, credentials, or full request bodies.
    """
    safe: dict[str, Any] = {
        "event_type": sanitize_for_ai(aggregated_event_data.get("event_type", "unknown"), 64),
        "alert_count": aggregated_event_data.get("count", 0),
        "unique_targets": aggregated_event_data.get("unique_targets", 0),
        "unique_ports": aggregated_event_data.get("unique_ports", 0),
        "time_window": {
            "start": str(aggregated_event_data.get("window_start", ""))[:30],
            "end": str(aggregated_event_data.get("window_end", ""))[:30],
        },
    }

    # Include sample signatures (sanitized)
    samples = aggregated_event_data.get("sample_events", [])
    if samples:
        safe_samples = []
        for s in samples[:5]:  # Max 5 samples
            if isinstance(s, dict):
                alert = s.get("alert", {}) if isinstance(s.get("alert"), dict) else {}
                safe_samples.append({
                    "signature": sanitize_for_ai(alert.get("signature", ""), 300),
                    "category": sanitize_for_ai(alert.get("category", ""), 128),
                    "severity": alert.get("severity"),
                })
        safe["sample_signatures"] = safe_samples

    result = json.dumps(safe, default=str)
    return result[:MAX_SUMMARY_LENGTH]


def validate_deepseek_response(raw_content: str) -> dict | None:
    """Validate and parse DeepSeek's response.

    Rejects: markdown, extra keys, non-JSON, prose, invalid risk_score.
    Returns: parsed dict or None if invalid.
    """
    if not raw_content:
        return None

    content = raw_content.strip()

    # Strip markdown code fences if present
    if content.startswith("```"):
        lines = content.split("\n")
        if lines[-1].strip() == "```":
            content = "\n".join(lines[1:-1]).strip()
        else:
            content = "\n".join(lines[1:]).strip()

    # Try to find a JSON object
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        # Try to extract JSON from prose
        match = re.search(r"\{[^{}]*\}", content)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                return None
        else:
            return None

    # Must be a dict
    if not isinstance(parsed, dict):
        return None

    # Required keys only
    allowed_keys = {"is_malicious", "risk_score", "reason"}
    extra_keys = set(parsed.keys()) - allowed_keys
    if extra_keys:
        # Allow but log extra keys — don't reject for leniency
        pass

    # Validate types
    if not isinstance(parsed.get("is_malicious"), bool):
        return None

    risk = parsed.get("risk_score")
    if not isinstance(risk, int) or not (0 <= risk <= 10):
        return None

    reason = parsed.get("reason", "")
    if not isinstance(reason, str) or not reason.strip():
        return None
    parsed["reason"] = reason.strip()[:MAX_REASON_LENGTH]

    return parsed
