"""SSH connection manager using asyncssh for async operations."""

import asyncio
import logging
from contextlib import asynccontextmanager

import asyncssh

from config import settings

logger = logging.getLogger(__name__)


class SSHClient:
    """Async SSH client manager with auto-reconnect."""

    def __init__(self, host: str, port: int, username: str, password: str, label: str = ""):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.label = label or host
        self._conn: asyncssh.SSHClientConnection | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> asyncssh.SSHClientConnection:
        async with self._lock:
            if self._conn is None or self._conn.is_closed():
                self._conn = await asyncssh.connect(
                    host=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    known_hosts=None,  # Accept any host on LAN
                    keepalive_interval=30,
                    keepalive_count_max=3,
                )
                logger.info(f"SSH connected to {self.label} ({self.host}:{self.port})")
            return self._conn

    async def execute(self, command: str, timeout: int = 30) -> str:
        """Execute a command and return stdout."""
        conn = await self.connect()
        result = await asyncio.wait_for(conn.run(command), timeout=timeout)
        if result.exit_status != 0 and result.stderr:
            logger.warning(f"SSH [{self.label}] command '{command[:60]}...' stderr: {result.stderr}")
        return result.stdout or ""

    async def tail_file(self, path: str) -> str:
        """Read new lines from a file (like tail -n)."""
        return await self.execute(f"tail -n 500 '{path}'")

    async def tail_follow(self, path: str) -> str:
        """Get last line of file."""
        return await self.execute(f"tail -n 1 '{path}'")

    async def file_exists(self, path: str) -> bool:
        """Check if a file exists on the remote."""
        result = await self.execute(f"test -f '{path}' && echo YES || echo NO")
        return "YES" in result

    async def get_file_size(self, path: str) -> int:
        """Get remote file size in bytes."""
        result = await self.execute(f"stat -c%s '{path}' 2>/dev/null || wc -c < '{path}'")
        try:
            return int(result.strip())
        except ValueError:
            return 0

    async def read_file_offset(self, path: str, offset: int) -> tuple[str, int]:
        """Read file from offset, return (content, new_offset)."""
        size = await self.get_file_size(path)
        if size <= offset:
            return "", offset
        result = await self.execute(f"tail -c +{offset + 1} '{path}'")
        return result, size

    async def close(self):
        if self._conn and not self._conn.is_closed():
            self._conn.close()
            await self._conn.wait_closed()
            logger.info(f"SSH disconnected from {self.label}")


# ── Global client factories ─────────────────────────────

_suricata_client: SSHClient | None = None
_mikrotik_client: SSHClient | None = None


def get_suricata_client() -> SSHClient:
    global _suricata_client
    if _suricata_client is None:
        _suricata_client = SSHClient(
            host=settings.suricata_server_host,
            port=settings.suricata_server_port,
            username=settings.suricata_server_user,
            password=settings.suricata_server_pass,
            label="suricata-ntopng",
        )
    return _suricata_client


def get_mikrotik_client() -> SSHClient:
    global _mikrotik_client
    if _mikrotik_client is None:
        _mikrotik_client = SSHClient(
            host=settings.mikrotik_host,
            port=settings.mikrotik_port,
            username=settings.mikrotik_user,
            password=settings.mikrotik_pass,
            label="mikrotik",
        )
    return _mikrotik_client
