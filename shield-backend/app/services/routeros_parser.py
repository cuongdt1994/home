"""Reusable RouterOS output parser (Section 10).

Handles: as-value, key=value records, quoted strings, boolean conversion,
byte/duration/temperature/voltage parsing, and graceful degradation.
"""

import re
from dataclasses import dataclass, field
from typing import Any


# Regex for RouterOS as-value format: .id=*1 name="ether1" running=yes ...
_AS_VALUE_KV = re.compile(r'([\w.-]+)=("[^"]*"|\S+)')

# Regex for byte values: "64.0MiB", "1024KiB", "4.0GiB", "12345"
_BYTE_RE = re.compile(r'^([\d.]+)\s*(KiB|MiB|GiB|TiB|B)?$', re.IGNORECASE)

# Duration parts: 2w3d4h5m6s500ms
_DURATION_PARTS = re.compile(r'(\d+)\s*(w|d|h|m|ms|s)')

# Temperature: "43C" or "43"
_TEMP_RE = re.compile(r'^([\d.]+)\s*C?$', re.IGNORECASE)

# Voltage: "24.2V" or "24.2"
_VOLT_RE = re.compile(r'^([\d.]+)\s*V?$', re.IGNORECASE)

# Unit multipliers for bytes
_BYTE_UNITS = {"B": 1, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3, "TiB": 1024**4}

# Duration multipliers
_DURATION_UNITS = {"w": 604800, "d": 86400, "h": 3600, "m": 60, "s": 1, "ms": 0.001}


def parse_routeros_records(raw: str) -> list[dict[str, str]]:
    """Parse RouterOS 'as-value' or 'detail' key=value output into list of dicts.

    Each record starts with a line like '.id=*1 name="ether1" ...'
    Quoted values have quotes stripped. Handles multi-line records.
    """
    records: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for line in raw.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        # Detect start of new record (has .id= or starts with key=value pattern)
        pairs = _AS_VALUE_KV.findall(stripped)
        if not pairs:
            continue

        # Check if this line starts a new record (contains .id= or a fresh key set)
        has_id = any(k == ".id" for k, _ in pairs)
        if has_id or current is None:
            if current is not None:
                records.append(current)
            current = {}
            for k, v in pairs:
                current[k] = v.strip('"')

        elif current is not None:
            # Continuation of previous record
            for k, v in pairs:
                current[k] = v.strip('"')

    if current is not None:
        records.append(current)

    return records


def parse_routeros_bool(value: str | None) -> bool | None:
    """Convert 'yes'/'true' → True, 'no'/'false' → False, else None."""
    if value is None:
        return None
    v = value.strip().lower()
    if v in ("yes", "true"):
        return True
    if v in ("no", "false"):
        return False
    return None


def parse_routeros_bytes(value: str | None) -> int | None:
    """Parse RouterOS byte strings like '64.0MiB', '1024KiB', '12345' into bytes (int)."""
    if value is None:
        return None
    m = _BYTE_RE.match(str(value).strip())
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "B"
    return int(num * _BYTE_UNITS.get(unit, 1))


def parse_routeros_duration(value: str | None) -> float | None:
    """Parse RouterOS duration like '17h15m3s' → seconds (float)."""
    if value is None:
        return None
    total = 0.0
    for num_str, unit in _DURATION_PARTS.findall(str(value)):
        total += int(num_str) * _DURATION_UNITS.get(unit, 0)
    return total if total > 0 else None


def parse_routeros_number(value: str | None) -> int | float | None:
    """Parse a RouterOS numeric value, handling embedded spaces (thousand separators)."""
    if value is None:
        return None
    v = str(value).strip().replace(" ", "")
    if not v:
        return None
    try:
        return int(v)
    except ValueError:
        try:
            return float(v)
        except ValueError:
            return None


def parse_routeros_temperature(value: str | None) -> float | None:
    """Parse temperature like '43C' → 43.0."""
    if value is None:
        return None
    m = _TEMP_RE.match(str(value).strip())
    return float(m.group(1)) if m else None


def parse_routeros_voltage(value: str | None) -> float | None:
    """Parse voltage like '24.2V' → 24.2."""
    if value is None:
        return None
    m = _VOLT_RE.match(str(value).strip())
    return float(m.group(1)) if m else None


def parse_routeros_percent(value: str | None) -> float | None:
    """Parse percentage like '15%' → 15.0."""
    if value is None:
        return None
    v = str(value).strip().rstrip("%").strip()
    try:
        return float(v)
    except ValueError:
        return None


def format_bytes(n: int | None, precision: int = 2) -> str:
    """Format bytes to human-readable string."""
    if n is None:
        return "N/A"
    if n == 0:
        return "0 B"
    if n < 1024:
        return f"{n} B"
    if n < 1048576:
        return f"{(n / 1024):.{precision}f} KiB"
    if n < 1073741824:
        return f"{(n / 1048576):.{precision}f} MiB"
    if n < 1099511627776:
        return f"{(n / 1073741824):.{precision}f} GiB"
    return f"{(n / 1099511627776):.{precision}f} TiB"


def format_bitrate(bps: float | None) -> str:
    """Format bits per second to human-readable string."""
    if bps is None or bps == 0:
        return "0 bps"
    if bps < 1000:
        return f"{bps:.0f} bps"
    if bps < 1000000:
        return f"{(bps / 1000):.1f} Kbps"
    if bps < 1000000000:
        return f"{(bps / 1000000):.1f} Mbps"
    return f"{(bps / 1000000000):.2f} Gbps"


@dataclass
class CommandResult:
    command: str
    stdout: str = ""
    stderr: str = ""
    exit_status: int | None = None
    duration_ms: float = 0.0
    timed_out: bool = False
