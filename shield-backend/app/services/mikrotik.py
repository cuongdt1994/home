"""MikroTik RouterOS SSH executor using asyncssh.

Handles address-list management, dedup checks, health stats collection,
with retry/backoff and graceful degradation.
"""

import asyncio
import logging
import re
import time
from typing import Any, Optional

import asyncssh

from app.config import settings
from app.utils.retry import async_retry

logger = logging.getLogger(__name__)

# Regex to parse RouterOS key=value pairs (values may be quoted or numeric with spaces)
_KV_RE = re.compile(r'([\w-]+)=("[^"]*"|\S+)')


class MikroTikExecutor:
    """Async SSH client for MikroTik RouterOS."""

    def __init__(self):
        self._conn: Optional[asyncssh.SSHClientConnection] = None
        self._lock = asyncio.Lock()
        self._last_latency_ms: Optional[float] = None
        self._healthy = False

    @property
    def is_healthy(self) -> bool:
        return self._healthy

    @property
    def last_latency_ms(self) -> Optional[float]:
        return self._last_latency_ms

    async def _connect(self) -> asyncssh.SSHClientConnection:
        if self._conn is not None and not self._conn.is_closed():
            return self._conn
        async with self._lock:
            if self._conn is not None and not self._conn.is_closed():
                return self._conn
            logger.info("Connecting to MikroTik %s:%d", settings.MIKROTIK_HOST, settings.MIKROTIK_PORT)
            self._conn = await asyncssh.connect(
                host=settings.MIKROTIK_HOST,
                port=settings.MIKROTIK_PORT,
                username=settings.MIKROTIK_USER,
                password=settings.MIKROTIK_PASSWORD if settings.MIKROTIK_PASSWORD else None,
                known_hosts=None,
                connect_timeout=10,
            )
            logger.info("MikroTik SSH connected")
            return self._conn

    async def _execute(self, command: str) -> str:
        async def _run():
            conn = await self._connect()
            result = await conn.run(command, check=True)
            return result.stdout.strip()
        return await async_retry(
            _run, max_attempts=3, base_delay=1.0, max_delay=10.0,
            retryable_exceptions=(asyncssh.Error, OSError, ConnectionError),
        )

    async def _execute_no_raise(self, command: str) -> tuple[bool, str]:
        try:
            output = await self._execute(command)
            return True, output
        except Exception as e:
            return False, str(e)

    # ------------------------------------------------------------------
    # Address-list management
    # ------------------------------------------------------------------

    async def add_to_address_list(self, ip: str, list_name: str = "ai_blacklist",
                                   timeout_str: str = "7d", comment: str = "") -> dict:
        start = time.monotonic()
        already = await self.is_ip_blocked(ip, list_name)
        if already:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.info("IP %s already in address-list %s — skipping", ip, list_name)
            return {"success": True, "action": "already_blocked", "output": f"IP {ip} already in {list_name}", "error": None}

        safe_comment = comment.replace('"', "'")
        command = (
            f'/ip/firewall/address-list/add '
            f'list={list_name} address={ip} timeout={timeout_str} '
            f'comment="{safe_comment}"'
        )
        success, output = await self._execute_no_raise(command)
        elapsed = (time.monotonic() - start) * 1000
        self._last_latency_ms = elapsed
        self._healthy = success
        result = {"success": success, "action": "added" if success else "failed",
                   "output": output, "error": None if success else output}
        logger.info("MikroTik address-list add: %s -> %s (%s)", ip, list_name, result["action"])
        return result

    async def is_ip_blocked(self, ip: str, list_name: str = "ai_blacklist") -> bool:
        success, output = await self._execute_no_raise(
            f'/ip/firewall/address-list/print where list={list_name} and address={ip}'
        )
        if not success:
            return False
        return ip in output

    async def remove_from_address_list(self, ip: str, list_name: str = "ai_blacklist") -> bool:
        success, output = await self._execute_no_raise(
            f'/ip/firewall/address-list/remove [find where list={list_name} and address={ip}]'
        )
        return success

    # ------------------------------------------------------------------
    # Health / System stats
    # ------------------------------------------------------------------

    async def get_system_health(self) -> dict[str, Any]:
        """Collect MikroTik system health: CPU, RAM, uptime, interfaces."""
        start = time.monotonic()
        health: dict[str, Any] = {
            "cpu_percent": None, "memory_percent": None,
            "total_memory_mb": None, "free_memory_mb": None,
            "uptime": None, "version": None, "board_name": None,
            "interfaces": [],
        }
        try:
            # System resources (key: value format)
            ok, out = await self._execute_no_raise("/system/resource/print")
            if ok:
                res = _parse_colon_kv(out)
                health["cpu_percent"] = _int_or_none(res.get("cpu-load", "").rstrip("%"))
                health["uptime"] = res.get("uptime")
                health["version"] = res.get("version")
                free_kib = _int_or_none(res.get("free-memory", "").replace("KiB", "").replace("MiB", "").strip())
                total_kib = _int_or_none(res.get("total-memory", "").replace("KiB", "").replace("MiB", "").strip())
                if free_kib is not None:
                    health["free_memory_mb"] = free_kib // 1024
                if total_kib is not None:
                    health["total_memory_mb"] = total_kib // 1024
                if total_kib and free_kib and total_kib > 0:
                    health["memory_percent"] = round(((total_kib - free_kib) / total_kib) * 100, 1)

            # RouterBoard info
            ok, out = await self._execute_no_raise("/system/routerboard/print")
            if ok:
                rb = _parse_colon_kv(out)
                health["board_name"] = rb.get("board-name") or rb.get("model")

            # Interfaces — use detail format for structured key=value output
            ok, out = await self._execute_no_raise("/interface/print detail without-paging")
            if ok:
                health["interfaces"] = _parse_interface_detail(out)

            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._healthy = True
        except Exception as e:
            self._healthy = False
            logger.warning("Failed to collect MikroTik health: %s", e)

        return health

    async def get_address_list_entries(self, list_name: str = "ai_blacklist") -> list[dict]:
        """Get all entries in a firewall address-list with structured parsing."""
        success, output = await self._execute_no_raise(
            f'/ip/firewall/address-list/print detail without-paging where list={list_name}'
        )
        if not success:
            return []
        return _parse_interface_detail(output)  # Same key=value format

    async def ping(self) -> tuple[bool, Optional[float]]:
        try:
            start = time.monotonic()
            await self._execute("/system/resource/print")
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._healthy = True
            return True, elapsed
        except Exception:
            self._healthy = False
            return False, None

    async def close(self) -> None:
        if self._conn is not None and not self._conn.is_closed():
            self._conn.close()
            await self._conn.wait_closed()
            logger.info("MikroTik SSH connection closed")


# ------------------------------------------------------------------
# Parsing helpers — RouterOS output formats
# ------------------------------------------------------------------

def _parse_colon_kv(raw: str) -> dict[str, str]:
    """Parse RouterOS 'key: value' format (system resource, routerboard).

    Input:
        uptime: 3w5d12h34m56s
        version: 7.15.2 (stable)
        cpu-load: 15%

    Returns dict of lowercase key -> value.
    """
    result: dict[str, str] = {}
    for line in raw.split("\n"):
        line = line.strip()
        if not line:
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip().lower()] = value.strip()
    return result


def _parse_interface_detail(raw: str) -> list[dict]:
    """Parse RouterOS '/interface/print detail' key=value output.

    Format:
        Flags: X - disabled, D - dynamic, R - running
         0  R  name="ether1" mtu=1500 mac-address=AA:BB:CC:DD:EE:FF ...
         1     name="ether2" ...

    Each interface block starts with a numeric index and optional flags.
    Key=value pairs follow. Multi-word values are double-quoted.
    """
    interfaces: list[dict] = []
    current: dict[str, Any] | None = None
    # These are flag-only lines, not real interfaces
    skip_prefixes = ("Flags:", "--", "")

    for line in raw.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith(skip_prefixes):
            continue

        # Does line start with a numeric index? (new interface entry)
        # Lines look like: " 0  R  name=..." or " 0    name=..."
        idx_match = re.match(r'^\s*(\d+)\s+', stripped)
        if idx_match:
            # Save previous interface
            if current and "name" in current:
                interfaces.append(current)
            current = {}
            # Remove the leading index and flags (single-letter flags)
            rest = stripped[idx_match.end():]
            # Strip flag characters (single uppercase letters separated by spaces)
            rest = re.sub(r'^([A-Z]\s*)+', '', rest).strip()
            # Parse key=value pairs
            for m in _KV_RE.finditer(rest):
                k, v = m.groups()
                current[k] = v.strip('"')
        elif current is not None:
            # Continuation line — more key=value pairs for current interface
            for m in _KV_RE.finditer(stripped):
                k, v = m.groups()
                current[k] = v.strip('"')

    # Don't forget the last interface
    if current and "name" in current:
        interfaces.append(current)

    # Normalize: extract commonly needed fields with sensible names
    normalized = []
    for iface in interfaces:
        name = iface.get("name", "unknown")
        running = "R" in iface.get("flags", "") if "flags" not in iface else iface.get("running", "") == "true"
        rx_bytes = _int_or_none(iface.get("rx-byte") or iface.get("rx-bytes", "0"))
        tx_bytes = _int_or_none(iface.get("tx-byte") or iface.get("tx-bytes", "0"))
        rx_packets = _int_or_none(iface.get("rx-packet") or iface.get("rx-packets", "0"))
        tx_packets = _int_or_none(iface.get("tx-packet") or iface.get("tx-packets", "0"))
        disabled = iface.get("disabled") == "true"
        mac = iface.get("mac-address") or iface.get("mac_address", "")
        comment = iface.get("comment", "")

        normalized.append({
            "name": name,
            "running": running,
            "disabled": disabled,
            "rx_bytes": rx_bytes,
            "tx_bytes": tx_bytes,
            "rx_packets": rx_packets,
            "tx_packets": tx_packets,
            "mac_address": mac,
            "comment": comment,
            # Include raw for debugging
            "_raw": iface,
        })

    return normalized


def _int_or_none(val: str) -> int | None:
    """Parse a string to int, handling numbers with thousand-separator spaces."""
    if not val:
        return None
    try:
        return int(str(val).replace(" ", ""))
    except (ValueError, TypeError):
        return None
