"""MikroTik Health Collector — comprehensive RouterOS data collection.

Runs commands sequentially over a single SSH connection for reliability.
Tries as-value first, falls back to standard output if unsupported.
Supports partial results and error diagnostics.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.services.mikrotik import MikroTikExecutor
from app.services.routeros_parser import (
    parse_routeros_records,
    parse_routeros_bool,
    parse_routeros_bytes,
    parse_routeros_duration,
    parse_routeros_number,
    parse_routeros_temperature,
    parse_routeros_voltage,
    parse_routeros_percent,
    format_bytes,
)

logger = logging.getLogger(__name__)


@dataclass
class CollectionResult:
    success: bool = True
    reachable: bool = True
    collected_at: str = ""
    latency_ms: float = 0.0
    partial: bool = False
    warnings: list[str] = field(default_factory=list)
    system: dict = field(default_factory=dict)
    memory: dict = field(default_factory=dict)
    storage: dict = field(default_factory=dict)
    health: dict = field(default_factory=dict)
    interfaces: dict = field(default_factory=dict)
    network: dict = field(default_factory=dict)
    errors: dict = field(default_factory=dict)
    diagnostics: dict = field(default_factory=dict)


class MikroTikHealthCollector:
    """Collects complete MikroTik health data using an SSH executor.

    Commands run sequentially for SSH reliability. Each command is tried
    with as-value first; if output is empty, retried without as-value.
    """

    def __init__(self, executor: MikroTikExecutor):
        self._executor = executor

    async def _run(self, command: str, fallback: str | None = None) -> tuple[bool, str, float]:
        """Execute a command. If output is empty and fallback provided, try fallback.

        Returns (ok, output, duration_ms).
        """
        start = time.monotonic()
        try:
            ok, out = await self._executor._execute_no_raise(command)
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            logger.warning("Command exception (%.0fms): %s → %s", elapsed, command[:80], e)
            return False, str(e), elapsed

        elapsed = (time.monotonic() - start) * 1000

        # If as-value produced empty output, try fallback (non-as-value)
        if ok and (not out or not out.strip()) and fallback:
            logger.info("as-value returned empty for %s — trying fallback: %s", command[:60], fallback[:60])
            start2 = time.monotonic()
            try:
                ok2, out2 = await self._executor._execute_no_raise(fallback)
                elapsed = (time.monotonic() - start) * 1000
                if ok2 and out2 and out2.strip():
                    logger.info("Fallback command OK for %s", fallback[:60])
                    return True, out2, elapsed
            except Exception:
                pass

        if not ok:
            logger.warning("Command failed (%.0fms): %s → %s", elapsed, command[:80], out[:100])
        elif not out or not out.strip():
            logger.warning("Command returned empty output: %s", command[:80])
            ok = False
            out = "empty"
        else:
            logger.info("Command OK (%.0fms): %s (%d bytes)", elapsed, command[:80], len(out))

        return ok, out, elapsed

    # ------------------------------------------------------------------
    # Complete collection
    # ------------------------------------------------------------------

    async def collect_all(self) -> CollectionResult:
        """Collect all MikroTik health data sequentially."""
        result = CollectionResult()
        start = time.monotonic()
        result.collected_at = datetime.now(timezone.utc).isoformat()

        # Run commands sequentially (SSH is single-connection, concurrent causes issues)
        diag: dict[str, dict] = {}

        # 1. System resource (critical — determines reachability)
        ok, out, dur = await self._run(
            "/system/resource/print as-value",
            fallback="/system/resource/print",
        )
        diag["system_resource"] = {"ok": ok, "duration_ms": dur, "bytes": len(out) if ok else 0}
        if not ok:
            result.reachable = False
            result.success = False
            result.errors["system_resource"] = "command_failed" if out != "empty" else "empty"
            result.warnings.append(f"System resource unavailable: {out}")
            result.diagnostics = diag
            return result
        self._parse_system_resource(result, out)

        # 2. Routerboard (static info)
        ok, out, dur = await self._run(
            "/system/routerboard/print as-value",
            fallback="/system/routerboard/print",
        )
        diag["routerboard"] = {"ok": ok, "duration_ms": dur, "bytes": len(out) if ok else 0}
        if ok:
            self._parse_routerboard(result, out)
        else:
            result.warnings.append("Routerboard info unavailable")

        # 3. Identity
        ok, out, dur = await self._run(
            "/system/identity/print as-value",
            fallback="/system/identity/print",
        )
        diag["identity"] = {"ok": ok, "duration_ms": dur, "bytes": len(out) if ok else 0}
        if ok:
            self._parse_identity(result, out)

        # 4. Health sensors (optional)
        ok, out, dur = await self._run(
            "/system/health/print as-value",
            fallback="/system/health/print",
        )
        diag["health"] = {"ok": ok, "duration_ms": dur, "bytes": len(out) if ok else 0}
        if ok:
            self._parse_health(result, out)
        else:
            result.warnings.append("Health sensors unavailable (permission or unsupported hardware)")

        # 5. Interfaces (critical for dashboard)
        ok, out, dur = await self._run(
            "/interface/print detail as-value without-paging",
            fallback="/interface/print detail without-paging",
        )
        diag["interfaces"] = {"ok": ok, "duration_ms": dur, "bytes": len(out) if ok else 0}
        if ok:
            self._parse_interfaces(result, out)
        else:
            result.warnings.append("Interfaces unavailable")
            result.errors["interfaces"] = "command_failed" if out != "empty" else "empty"

        result.partial = len(result.warnings) > 0
        result.latency_ms = (time.monotonic() - start) * 1000
        result.diagnostics = diag
        return result

    # ------------------------------------------------------------------
    # Parsers
    # ------------------------------------------------------------------

    def _parse_system_resource(self, result: CollectionResult, out: str) -> None:
        records = parse_routeros_records(out)
        if not records:
            result.errors["system_resource"] = "parse_empty"
            return
        r = records[0]

        total_mem = parse_routeros_bytes(r.get("total-memory"))
        free_mem = parse_routeros_bytes(r.get("free-memory"))
        used_mem = (total_mem - free_mem) if (total_mem is not None and free_mem is not None) else None

        result.system.update({
            "cpu_model": r.get("cpu"),
            "cpu_count": parse_routeros_number(r.get("cpu-count")),
            "cpu_frequency_mhz": parse_routeros_number(r.get("cpu-frequency")),
            "cpu_load_percent": parse_routeros_percent(r.get("cpu-load")),
            "uptime_seconds": parse_routeros_duration(r.get("uptime")),
            "uptime_display": r.get("uptime", ""),
            "architecture": r.get("architecture-name"),
            "board_name": r.get("board-name"),
            "platform": r.get("platform"),
            "routeros_version": r.get("version"),
        })

        result.memory.update({
            "total_bytes": total_mem,
            "free_bytes": free_mem,
            "used_bytes": used_mem,
            "usage_percent": round((used_mem / total_mem) * 100, 1) if (total_mem and used_mem is not None and total_mem > 0) else None,
            "total_display": format_bytes(total_mem) if total_mem else "N/A",
            "free_display": format_bytes(free_mem) if free_mem else "N/A",
            "used_display": format_bytes(used_mem) if used_mem else "N/A",
        })

        # Storage from resource
        total_hdd = parse_routeros_bytes(r.get("total-hdd-space"))
        free_hdd = parse_routeros_bytes(r.get("free-hdd-space"))
        result.storage.update({
            "total_bytes": total_hdd,
            "free_bytes": free_hdd,
            "used_bytes": (total_hdd - free_hdd) if (total_hdd is not None and free_hdd is not None) else None,
            "usage_percent": round(((total_hdd - free_hdd) / total_hdd) * 100, 1) if (total_hdd and free_hdd and total_hdd > 0) else None,
        })

    def _parse_routerboard(self, result: CollectionResult, out: str) -> None:
        records = parse_routeros_records(out)
        if records:
            r = records[0]
            result.system.update({
                "model": r.get("model"),
                "serial_number": r.get("serial-number"),
                "firmware_type": r.get("firmware-type"),
                "current_firmware": r.get("current-firmware"),
                "upgrade_firmware": r.get("upgrade-firmware"),
            })

    def _parse_identity(self, result: CollectionResult, out: str) -> None:
        records = parse_routeros_records(out)
        if records:
            result.system["identity"] = records[0].get("name", "")

    def _parse_health(self, result: CollectionResult, out: str) -> None:
        records = parse_routeros_records(out)
        if not records:
            return
        r = records[0]
        sensors: dict[str, str] = {k: v for k, v in r.items() if not k.startswith(".")}
        result.health.update({
            "cpu_temperature_c": parse_routeros_temperature(r.get("cpu-temperature") or r.get("temperature")),
            "board_temperature_c": parse_routeros_temperature(r.get("board-temperature1")),
            "voltage_v": parse_routeros_voltage(r.get("voltage")),
            "fan_state": r.get("fan-state") or r.get("fan1-state"),
            "sensors": sensors,
        })

    def _parse_interfaces(self, result: CollectionResult, out: str) -> None:
        records = parse_routeros_records(out)
        if not records:
            result.errors["interfaces"] = "parse_empty"
            return

        items: list[dict] = []
        summary = {"total": 0, "running": 0, "inactive": 0, "disabled": 0, "dynamic": 0}

        for r in records:
            name = r.get("name", "unknown")
            running = parse_routeros_bool(r.get("running"))
            disabled = parse_routeros_bool(r.get("disabled"))
            dynamic = parse_routeros_bool(r.get("dynamic"))

            if disabled:
                status = "disabled"
            elif running:
                status = "running"
            else:
                status = "inactive"

            summary["total"] += 1
            if running:
                summary["running"] += 1
            if disabled:
                summary["disabled"] += 1
            if not running and not disabled:
                summary["inactive"] += 1
            if dynamic:
                summary["dynamic"] += 1

            items.append({
                "id": r.get(".id", ""),
                "name": name,
                "default_name": r.get("default-name", name),
                "type": r.get("type", ""),
                "comment": r.get("comment", ""),
                "running": running,
                "disabled": disabled,
                "dynamic": dynamic,
                "slave": parse_routeros_bool(r.get("slave")),
                "status": status,
                "mac_address": r.get("mac-address", ""),
                "actual_mtu": parse_routeros_number(r.get("actual-mtu")),
                "l2mtu": parse_routeros_number(r.get("l2mtu")),
                "max_l2mtu": parse_routeros_number(r.get("max-l2mtu")),
                "rx_bytes": parse_routeros_number(r.get("rx-byte")),
                "tx_bytes": parse_routeros_number(r.get("tx-byte")),
                "rx_packets": parse_routeros_number(r.get("rx-packet")),
                "tx_packets": parse_routeros_number(r.get("tx-packet")),
                "rx_drops": parse_routeros_number(r.get("rx-drop")),
                "tx_drops": parse_routeros_number(r.get("tx-drop")),
                "rx_errors": parse_routeros_number(r.get("rx-error")),
                "tx_errors": parse_routeros_number(r.get("tx-error")),
                "last_link_up_time": r.get("last-link-up-time", ""),
                "last_link_down_time": r.get("last-link-down-time"),
                "link_downs": parse_routeros_number(r.get("link-downs")),
            })

        result.interfaces = {"summary": summary, "items": items}
        logger.info("Parsed %d interfaces (running=%d, inactive=%d, disabled=%d)",
                     summary["total"], summary["running"], summary["inactive"], summary["disabled"])
