"""SSH connection manager using asyncssh for async operations."""

import asyncio
import logging

import asyncssh

from config import settings

logger = logging.getLogger(__name__)


class PermissionDeniedError(Exception):
    """Raised when the remote command fails due to file permission issues."""


class SSHClient:
    """Async SSH client manager with auto-reconnect."""

    def __init__(self, host: str, port: int, username: str, password: str, label: str = "", use_sudo: bool = False):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.label = label or host
        self.use_sudo = use_sudo
        self._conn: asyncssh.SSHClientConnection | None = None
        self._lock = asyncio.Lock()
        self._perm_denied_logged: set[str] = set()  # paths we already warned about

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
            stderr = result.stderr.strip()
            # Deduplicate permission-denied warnings per path to avoid log spam
            if self._is_perm_denied(stderr):
                # Extract path from command for dedup key
                if stderr not in self._perm_denied_logged:
                    self._perm_denied_logged.add(stderr)
                    logger.error(
                        "SSH [%s] Permission denied for user '%s'. "
                        "Grant read access on the remote file or enable use_sudo=True. "
                        "Command: %s",
                        self.label, self.username, command[:80]
                    )
            else:
                logger.warning(f"SSH [{self.label}] command '{command[:60]}...' stderr: {stderr}")
        return result.stdout or ""

    async def tail_file(self, path: str) -> str:
        """Read new lines from a file (like tail -n)."""
        return await self.execute(self._sudo(f"tail -n 500 '{path}'"))

    async def tail_follow(self, path: str) -> str:
        """Get last line of file."""
        return await self.execute(self._sudo(f"tail -n 1 '{path}'"))

    async def file_exists(self, path: str) -> bool:
        """Check if a file exists on the remote."""
        result = await self.execute(self._sudo(f"test -f '{path}' && echo YES || echo NO"))
        return "YES" in result

    def _sudo(self, cmd: str) -> str:
        """Prepend sudo if use_sudo is enabled."""
        return f"sudo {cmd}" if self.use_sudo else cmd

    def _is_perm_denied(self, stderr: str) -> bool:
        """Check if stderr indicates a permission denied error."""
        return stderr is not None and "permission denied" in stderr.lower()

    async def get_file_size(self, path: str) -> int:
        """Get remote file size in bytes."""
        result = await self.execute(
            self._sudo(f"stat -c%s '{path}' 2>/dev/null || wc -c < '{path}'")
        )
        try:
            return int(result.strip())
        except ValueError:
            if result:
                logger.warning("get_file_size(%s): unexpected output: %r", path, result[:200])
            return 0

    async def read_file_offset(self, path: str, offset: int) -> tuple[str, int]:
        """Read file from offset, return (content, new_offset)."""
        size = await self.get_file_size(path)
        if size <= offset:
            return "", offset
        result = await self.execute(self._sudo(f"tail -c +{offset + 1} '{path}'"))
        return result, size

    async def close(self):
        if self._conn and not self._conn.is_closed():
            self._conn.close()
            await self._conn.wait_closed()
            logger.info(f"SSH disconnected from {self.label}")


# ── Global client factories ─────────────────────────────

_mikrotik_client: SSHClient | None = None


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
