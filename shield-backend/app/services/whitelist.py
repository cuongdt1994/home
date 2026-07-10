"""Whitelist engine — ensures critical IPs are never blocked."""

import asyncio
import logging
import os
from typing import List

import ipaddress

from app.utils.cidr import parse_cidrs, is_ip_in_cidrs

logger = logging.getLogger(__name__)

# Hardcoded protections — these are ALWAYS whitelisted regardless of config
BUILTIN_CIDRS = [
    ipaddress.ip_network("10.100.101.1/32"),     # MikroTik router
    ipaddress.ip_network("10.100.101.250/32"),    # Ubuntu server
    ipaddress.ip_network("127.0.0.0/8"),          # Loopback
    ipaddress.ip_network("10.0.0.0/8"),           # RFC1918
    ipaddress.ip_network("172.16.0.0/12"),        # RFC1918
    ipaddress.ip_network("192.168.0.0/16"),       # RFC1918
]


class WhitelistEngine:
    """Thread-safe whitelist engine with hot-reload support.

    IPs/CIDRs in the whitelist will NEVER be blocked, even if DeepSeek
    classifies them as malicious. The whitelist always wins.
    """

    def __init__(self, file_path: str, extra_cidrs: str = ""):
        self._file_path = file_path
        self._extra_cidrs_str = extra_cidrs
        self._lock = asyncio.Lock()
        self._networks: list = []
        self.reload()

    def reload(self) -> None:
        """Reload whitelist from disk and env. Call under lock for thread safety."""
        networks = list(BUILTIN_CIDRS)

        # Load from whitelist.txt
        if os.path.exists(self._file_path):
            try:
                with open(self._file_path, "r") as f:
                    networks.extend(parse_cidrs(f.readlines()))
                logger.info("Loaded %d entries from %s", len(networks), self._file_path)
            except Exception:
                logger.exception("Failed to read whitelist file %s", self._file_path)
        else:
            logger.warning("Whitelist file not found: %s", self._file_path)

        # Load from WHITELIST_CIDRS env var
        if self._extra_cidrs_str:
            extra = [c.strip() for c in self._extra_cidrs_str.split(",") if c.strip()]
            networks.extend(parse_cidrs(extra))
            logger.info("Loaded %d extra CIDRs from env", len(extra))

        self._networks = networks
        logger.info("Whitelist ready: %d total networks", len(self._networks))

    async def async_reload(self) -> None:
        """Hot-reload with lock protection."""
        async with self._lock:
            self.reload()

    def is_whitelisted(self, ip_str: str) -> bool:
        """Check if an IP address is whitelisted. Always returns True for private IPs."""
        if not ip_str:
            return True  # Err on the safe side

        # Always protect private IPs
        try:
            addr = ipaddress.ip_address(ip_str)
            if addr.is_private or addr.is_loopback or addr.is_link_local:
                return True
        except ValueError:
            return True  # Invalid IP — don't block

        return is_ip_in_cidrs(ip_str, self._networks)
