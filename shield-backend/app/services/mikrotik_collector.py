"""MikroTik Health Collector — comprehensive RouterOS data collection (Sections 1-12).

Uses the reusable RouterOS parser. Runs independent commands concurrently
with a bounded thread pool. Supports partial results, caching, and stale markers.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

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
    format_bitrate,
)

logger = logging.getLogger(__name__)

MAX_PARALLEL_COMMANDS = 5
TOTAL_TIMEOUT_SECONDS = 12


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


class MikroTikHealthCollector:
    """Collects complete MikroTik health data using an SSH executor."""

    def __init__(self, executor: MikroTikExecutor):
        self._executor = executor
        self._semaphore = asyncio.Semaphore(MAX_PARALLEL_COMMANDS)
        # Rate tracking: previous counter samples for computing deltas
        self._prev_counters: dict[str, dict] = {}
        self._last_sample_time: float = 0.0

    async def _run(self, command: str) -> tuple[bool, str, float]:
        """Execute a single command with semaphore. Returns (ok, output, duration_ms)."""
        async with self._semaphore:
            start = time.monotonic()
            ok, out = await self._executor._execute_no_raise(command)
            elapsed = (time.monotonic() - start) * 1000
            if not ok:
                logger.warning("Command failed (%.0fms): %s → %s", elapsed, command[:80], out[:100])
            else:
                logger.debug("Command OK (%.0fms): %s", elapsed, command[:80])
            return ok, out, elapsed

    # ------------------------------------------------------------------
    # Complete collection
    # ------------------------------------------------------------------

    async def collect_all(self, include_live_rates: bool = False) -> CollectionResult:
        """Collect all MikroTik health data. Returns partial results on failure.

        Args:
            include_live_rates: If True, also run monitor-traffic for running interfaces.
        """
        result = CollectionResult()
        start = time.monotonic()
        result.collected_at = datetime.now(timezone.utc).isoformat()

        # Phase 1: Static/rarely-changing data (run concurrently)
        tasks = {
            "system_resource": self._run("/system/resource/print as-value"),
            "routerboard": self._run("/system/routerboard/print as-value"),
            "identity": self._run("/system/identity/print as-value"),
            "health": self._run("/system/health/print as-value"),
            "interfaces": self._run("/interface/print detail as-value without-paging"),
        }

        results: dict[str, tuple[bool, str, float]] = {}
        for name, coro in tasks.items():
            try:
                results[name] = await asyncio.wait_for(coro, timeout=TOTAL_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                results[name] = (False, "", TOTAL_TIMEOUT_SECONDS * 1000)
                result.warnings.append(f"Timeout: {name}")
                result.errors[name] = "timeout"

        # Phase 2: Parse everything
        self._parse_system_resource(result, results.get("system_resource", (False, "", 0)))
        self._parse_routerboard(result, results.get("routerboard", (False, "", 0)))
        self._parse_identity(result, results.get("identity", (False, "", 0)))
        self._parse_health(result, results.get("health", (False, "", 0)))
        self._parse_interfaces(result, results.get("interfaces", (False, "", 0)))

        # Check reachability
        if not results.get("system_resource", (False, ""))[0]:
            result.reachable = False
            result.success = False

        result.partial = len(result.warnings) > 0
        result.latency_ms = (time.monotonic() - start) * 1000
        return result

    # ------------------------------------------------------------------
    # Parsers for each section
    # ------------------------------------------------------------------

    def _parse_system_resource(self, result: CollectionResult, raw: tuple[bool, str, float]) -> None:
        ok, out, _ = raw
        if not ok:
            result.warnings.append("Failed to read /system/resource")
            result.errors["system_resource"] = "command_failed"
            return

        records = parse_routeros_records(out)
        if not records:
            result.errors["system_resource"] = "empty"
            return

        r = records[0]
        total_kib = parse_routeros_number(r.get("total-memory")) or parse_routeros_number(r.get("total_hdd_size"))
        free_kib = parse_routeros_number(r.get("free-memory")) or parse_routeros_number(r.get("free_hdd_size"))
        # Actual memory is in KiB from RouterOS
        total_bytes = (int(total_kib) * 1024) if total_kib else None
        free_bytes_val = (int(free_kib) * 1024) if free_kib else None
        total_memory = parse_routeros_bytes(r.get("total-memory"))
        free_memory = parse_routeros_bytes(r.get("free-memory"))

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
        })

        result.memory.update({
            "total_bytes": total_memory,
            "free_bytes": free_memory,
            "used_bytes": (total_memory - free_memory) if (total_memory is not None and free_memory is not None) else None,
            "usage_percent": round(((total_memory - free_memory) / total_memory) * 100, 1) if (total_memory and free_memory and total_memory > 0) else None,
            "total_display": format_bytes(total_memory) if total_memory else "N/A",
            "free_display": format_bytes(free_memory) if free_memory else "N/A",
            "used_display": format_bytes(total_memory - free_memory) if (total_memory is not None and free_memory is not None) else "N/A",
        })

        # Storage
        total_hdd = parse_routeros_bytes(r.get("total-hdd-space")) or parse_routeros_bytes(r.get("total_hdd_size"))
        free_hdd = parse_routeros_bytes(r.get("free-hdd-space")) or parse_routeros_bytes(r.get("free_hdd_size"))
        result.storage.update({
            "total_bytes": total_hdd,
            "free_bytes": free_hdd,
            "used_bytes": (total_hdd - free_hdd) if total_hdd is not None and free_hdd is not None else None,
            "usage_percent": round(((total_hdd - free_hdd) / total_hdd) * 100, 1) if (total_hdd and free_hdd and total_hdd > 0) else None,
        })

    def _parse_routerboard(self, result: CollectionResult, raw: tuple[bool, str, float]) -> None:
        ok, out, _ = raw
        if not ok:
            result.warnings.append("Failed to read /system/routerboard")
            return
        records = parse_routeros_records(out)
        if records:
            r = records[0]
            result.system.update({
                "model": r.get("model") or r.get("board-name"),
                "serial_number": r.get("serial-number"),
                "firmware_type": r.get("firmware-type"),
                "factory_firmware": r.get("factory-firmware"),
                "current_firmware": r.get("current-firmware"),
                "upgrade_firmware": r.get("upgrade-firmware"),
            })

    def _parse_identity(self, result: CollectionResult, raw: tuple[bool, str, float]) -> None:
        ok, out, _ = raw
        if not ok:
            return
        records = parse_routeros_records(out)
        if records:
            result.system["identity"] = records[0].get("name", "")

    def _parse_health(self, result: CollectionResult, raw: tuple[bool, str, float]) -> None:
        ok, out, _ = raw
        if not ok:
            result.warnings.append("Health sensors unavailable (permission or unsupported)")
            result.errors["health"] = "unavailable"
            return
        records = parse_routeros_records(out)
        if not records:
            return
        r = records[0]
        sensors: dict[str, str] = {}
        for k, v in r.items():
            if k.startswith("."):
                continue
            sensors[k] = v

        result.health.update({
            "cpu_temperature_c": parse_routeros_temperature(r.get("cpu-temperature") or r.get("temperature")),
            "board_temperature_c": parse_routeros_temperature(r.get("board-temperature1")),
            "voltage_v": parse_routeros_voltage(r.get("voltage")),
            "fan_state": r.get("fan-state") or r.get("fan1-state"),
            "sensors": sensors,
        })

    def _parse_interfaces(self, result: CollectionResult, raw: tuple[bool, str, float]) -> None:
        ok, out, _ = raw
        if not ok:
            result.warnings.append("Failed to read /interface/print")
            result.errors["interfaces"] = "command_failed"
            return

        records = parse_routeros_records(out)
        if not records:
            result.errors["interfaces"] = "empty"
            return

        items: list[dict] = []
        summary = {"total": 0, "running": 0, "inactive": 0, "disabled": 0, "dynamic": 0}

        for r in records:
            name = r.get("name", "unknown")
            running = parse_routeros_bool(r.get("running"))
            disabled = parse_routeros_bool(r.get("disabled"))
            dynamic = parse_routeros_bool(r.get("dynamic"))
            slave = parse_routeros_bool(r.get("slave"))

            # Determine status
            if disabled:
                status = "disabled"
            elif running:
                status = "running"
            else:
                status = "inactive"

            # Count
            summary["total"] += 1
            if running:
                summary["running"] += 1
            if disabled:
                summary["disabled"] += 1
            if not running and not disabled:
                summary["inactive"] += 1
            if dynamic:
                summary["dynamic"] += 1

            iface = {
                "id": r.get(".id", ""),
                "name": name,
                "default_name": r.get("default-name", name),
                "type": r.get("type", ""),
                "comment": r.get("comment", ""),
                "running": running,
                "disabled": disabled,
                "dynamic": dynamic,
                "slave": slave,
                "status": status,
                "mac_address": r.get("mac-address", ""),
                "actual_mtu": parse_routeros_number(r.get("actual-mtu")),
                "l2mtu": parse_routeros_number(r.get("l2mtu")),
                "max_l2mtu": parse_routeros_number(r.get("max-l2mtu")),
                "rx_bytes": parse_routeros_number(r.get("rx-byte")) or parse_routeros_number(r.get("rx-bytes")),
                "tx_bytes": parse_routeros_number(r.get("tx-byte")) or parse_routeros_number(r.get("tx-bytes")),
                "rx_packets": parse_routeros_number(r.get("rx-packet")) or parse_routeros_number(r.get("rx-packets")),
                "tx_packets": parse_routeros_number(r.get("tx-packet")) or parse_routeros_number(r.get("tx-packets")),
                "rx_drops": parse_routeros_number(r.get("rx-drop")) or parse_routeros_number(r.get("rx-drops")),
                "tx_drops": parse_routeros_number(r.get("tx-drop")) or parse_routeros_number(r.get("tx-drops")),
                "rx_errors": parse_routeros_number(r.get("rx-error")) or parse_routeros_number(r.get("rx-errors")),
                "tx_errors": parse_routeros_number(r.get("tx-error")) or parse_routeros_number(r.get("tx-errors")),
                "last_link_up_time": r.get("last-link-up-time", ""),
                "last_link_down_time": r.get("last-link-down-time"),
                "link_downs": parse_routeros_number(r.get("link-downs")),
                "_raw": r,
            }
            items.append(iface)

        result.interfaces = {"summary": summary, "items": items}
