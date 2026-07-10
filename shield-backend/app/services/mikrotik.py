"""MikroTik RouterOS SSH executor using asyncssh.

Handles address-list management, dedup checks, health stats collection,
with retry/backoff and graceful degradation.
"""

import asyncio
import logging
import time
from typing import Any, Optional

import asyncssh

from app.config import settings
from app.utils.retry import async_retry

logger = logging.getLogger(__name__)


class MikroTikExecutor:
    """Async SSH client for MikroTik RouterOS.

    Manages a persistent connection pool (single connection) with
    lazy connect/reconnect. All SSH commands are retried with
    exponential backoff.
    """

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
        """Get or create an SSH connection (lazy, with reconnect)."""
        if self._conn is not None and not self._conn.is_closed():
            return self._conn

        async with self._lock:
            # Double-check after acquiring lock
            if self._conn is not None and not self._conn.is_closed():
                return self._conn

            logger.info("Connecting to MikroTik %s:%d", settings.MIKROTIK_HOST, settings.MIKROTIK_PORT)
            self._conn = await asyncssh.connect(
                host=settings.MIKROTIK_HOST,
                port=settings.MIKROTIK_PORT,
                username=settings.MIKROTIK_USER,
                password=settings.MIKROTIK_PASSWORD if settings.MIKROTIK_PASSWORD else None,
                known_hosts=None,  # Internal LAN — skip host key verification
                connect_timeout=10,
            )
            logger.info("MikroTik SSH connected")
            return self._conn

    async def _execute(self, command: str) -> str:
        """Execute a RouterOS command and return the output.

        Args:
            command: The RouterOS CLI command to execute.

        Returns:
            The command's stdout output.

        Raises:
            asyncssh.Error: On SSH or command failure.
        """
        async def _run():
            conn = await self._connect()
            result = await conn.run(command, check=True)
            return result.stdout.strip()

        return await async_retry(
            _run,
            max_attempts=3,
            base_delay=1.0,
            max_delay=10.0,
            retryable_exceptions=(asyncssh.Error, OSError, ConnectionError),
        )

    async def _execute_no_raise(self, command: str) -> tuple[bool, str]:
        """Execute a command, returning (success, output_or_error)."""
        try:
            output = await self._execute(command)
            return True, output
        except Exception as e:
            return False, str(e)

    # ------------------------------------------------------------------
    # Address-list management
    # ------------------------------------------------------------------

    async def add_to_address_list(
        self,
        ip: str,
        list_name: str = "ai_blacklist",
        timeout_str: str = "7d",
        comment: str = "",
    ) -> dict:
        """Add an IP to a MikroTik firewall address-list.

        Uses timeout-based entries so stale blocks expire automatically.

        Args:
            ip: IP address to block.
            list_name: Name of the address-list.
            timeout_str: RouterOS time string (e.g., '7d', '24h').
            comment: Comment for the address-list entry.

        Returns:
            dict with keys: success (bool), action (str), output (str), error (str|None)
        """
        start = time.monotonic()

        # First check if already blocked (dedup)
        already = await self.is_ip_blocked(ip, list_name)
        if already:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            logger.info("IP %s already in address-list %s — skipping", ip, list_name)
            return {
                "success": True,
                "action": "already_blocked",
                "output": f"IP {ip} already in {list_name}",
                "error": None,
            }

        # Escape double quotes in comment
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

        result = {
            "success": success,
            "action": "added" if success else "failed",
            "output": output,
            "error": None if success else output,
        }
        logger.info("MikroTik address-list add: %s -> %s (%s)", ip, list_name, result["action"])
        return result

    async def is_ip_blocked(self, ip: str, list_name: str = "ai_blacklist") -> bool:
        """Check if an IP is already in the address-list (dedup)."""
        success, output = await self._execute_no_raise(
            f'/ip/firewall/address-list/print where list={list_name} and address={ip}'
        )
        if not success:
            logger.warning("Failed to check address-list: %s", output)
            return False
        return ip in output

    async def remove_from_address_list(self, ip: str, list_name: str = "ai_blacklist") -> bool:
        """Remove an IP from the address-list (for manual unblock)."""
        success, output = await self._execute_no_raise(
            f'/ip/firewall/address-list/remove [find where list={list_name} and address={ip}]'
        )
        return success

    # ------------------------------------------------------------------
    # Health / System stats
    # ------------------------------------------------------------------

    async def get_system_health(self) -> dict[str, Any]:
        """Collect MikroTik system health: CPU, RAM, uptime, interfaces.

        Returns:
            dict with cpu_percent, memory_percent, uptime, interfaces, etc.
            Values are None when collection fails.
        """
        start = time.monotonic()
        health: dict[str, Any] = {
            "cpu_percent": None,
            "memory_percent": None,
            "total_memory_mb": None,
            "free_memory_mb": None,
            "uptime": None,
            "version": None,
            "interfaces": [],
        }

        try:
            # CPU
            ok, out = await self._execute_no_raise("/system/resource/print")
            if ok:
                for line in out.split("\n"):
                    line = line.strip()
                    if "cpu-load" in line:
                        health["cpu_percent"] = int(line.split(":")[-1].strip().rstrip("%") or 0)
                    elif "free-memory" in line:
                        health["free_memory_mb"] = int(line.split(":")[-1].strip().rstrip("KiB") or 0) // 1024
                    elif "total-memory" in line:
                        health["total_memory_mb"] = int(line.split(":")[-1].strip().rstrip("KiB") or 0) // 1024
                    elif "uptime" in line:
                        health["uptime"] = line.split(":")[-1].strip()
                    elif "version" in line:
                        health["version"] = line.split(":")[-1].strip()

            if health["total_memory_mb"] and health["free_memory_mb"]:
                used = health["total_memory_mb"] - health["free_memory_mb"]
                health["memory_percent"] = round((used / health["total_memory_mb"]) * 100, 1)

            # Interfaces
            ok, out = await self._execute_no_raise("/interface/print stats-detail")
            if ok:
                health["interfaces"] = self._parse_interface_stats(out)

            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._healthy = True

        except Exception as e:
            self._healthy = False
            logger.warning("Failed to collect MikroTik health: %s", e)

        return health

    async def get_address_list_entries(self, list_name: str = "ai_blacklist") -> list[dict]:
        """Get all entries in a firewall address-list."""
        success, output = await self._execute_no_raise(
            f'/ip/firewall/address-list/print where list={list_name}'
        )
        if not success:
            return []
        entries = []
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            entries.append({"raw": line})
        return entries

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_interface_stats(raw: str) -> list[dict]:
        """Parse MikroTik interface stats output into structured data."""
        interfaces = []
        for line in raw.split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split()]
            if len(parts) >= 3:
                interfaces.append({
                    "name": parts[0] if len(parts) > 0 else "",
                    "rx_bytes": parts[1] if len(parts) > 1 else "0",
                    "tx_bytes": parts[2] if len(parts) > 2 else "0",
                })
        return interfaces

    async def ping(self) -> tuple[bool, Optional[float]]:
        """Health-check ping: execute a trivial command and measure latency."""
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
