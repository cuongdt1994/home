"""Block safety guardrails — validates every blocking action before execution.

Implements Sections 3, 17, and 19 of the hardening spec:
- IP validation (private, multicast, reserved, etc.)
- Infrastructure protection (router, server, DNS, DHCP, etc.)
- Self-protection against admin lockout
- RouterOS command sanitization
"""

import ipaddress
import logging
import re
from dataclasses import dataclass
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Reserved/special-purpose ranges that must never be blocked
_RESERVED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),         # Current network
    ipaddress.ip_network("10.0.0.0/8"),         # RFC1918
    ipaddress.ip_network("100.64.0.0/10"),      # CGNAT
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-local
    ipaddress.ip_network("172.16.0.0/12"),      # RFC1918
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # TEST-NET-1
    ipaddress.ip_network("192.168.0.0/16"),     # RFC1918
    ipaddress.ip_network("198.18.0.0/15"),      # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),    # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),     # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
]


@dataclass
class BlockDecision:
    allowed: bool
    reason: str
    category: str  # "ok", "invalid_ip", "reserved", "infrastructure", "self_lockout", "whitelist", "disabled"


class SafetyGuard:
    """Validates every block action before execution.

    Checks (in order):
    1. MITIGATION_ENABLED global kill switch
    2. IP syntactic validity
    3. IP is not reserved/private/multicast/loopback (unless explicitly permitted)
    4. IP is not critical infrastructure
    5. IP is not the current admin
    6. IP is not whitelisted
    """

    def __init__(self, whitelist_engine):
        self._whitelist = whitelist_engine
        self._infrastructure_ips: set[str] = {
            settings.MIKROTIK_HOST,
            "10.100.101.250",   # Ubuntu server
            "10.100.101.1",     # MikroTik router
        }

    def validate_block(
        self,
        ip: str,
        admin_ip: Optional[str] = None,
        allow_private: bool = False,
    ) -> BlockDecision:
        """Run all safety checks on a proposed block.

        Args:
            ip: The IP address to block.
            admin_ip: The current admin's source IP (to prevent self-lockout).
            allow_private: If True, allows blocking private IPs. Default False.

        Returns:
            BlockDecision with allowed=True only if all checks pass.
        """
        # 0. Global kill switch
        if not getattr(settings, 'MITIGATION_ENABLED', True):
            return BlockDecision(False, "MITIGATION_ENABLED=false — all mitigation disabled", "disabled")

        # 1. Syntactic validity
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return BlockDecision(False, f"Invalid IP address: {ip}", "invalid_ip")

        # 2. Reserved/special-purpose check
        if not allow_private:
            for net in _RESERVED_NETWORKS:
                if addr in net:
                    return BlockDecision(
                        False,
                        f"IP {ip} is in reserved range {net} — refusing to block",
                        "reserved",
                    )

        # 3. Infrastructure protection
        if ip in self._infrastructure_ips:
            return BlockDecision(
                False,
                f"IP {ip} is critical infrastructure — refusing to block",
                "infrastructure",
            )

        # 4. Self-protection against admin lockout
        if admin_ip and ip == admin_ip:
            return BlockDecision(
                False,
                f"IP {ip} is the administrator's current source IP — refusing to block to prevent lockout",
                "self_lockout",
            )

        # 5. Whitelist check (final safety net)
        if self._whitelist and self._whitelist.is_whitelisted(ip):
            return BlockDecision(
                False,
                f"IP {ip} is whitelisted — refusing to block",
                "whitelist",
            )

        return BlockDecision(True, "OK", "ok")

    def add_infrastructure_ip(self, ip: str) -> None:
        """Register an additional infrastructure IP to protect."""
        self._infrastructure_ips.add(ip)


# RouterOS command sanitization
_TIMEOUT_RE = re.compile(r"^\d+[smhdw]$")
_LIST_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_COMMENT_MAX_LEN = 240


def sanitize_ros_comment(comment: str, max_len: int = _COMMENT_MAX_LEN) -> str:
    """Sanitize a comment string for RouterOS. Strips quotes and truncates."""
    if not comment:
        return ""
    clean = comment.replace('"', "'").replace("\\", "").replace("\n", " ").replace("\r", "")
    return clean[:max_len]


def validate_ros_timeout(timeout: str) -> bool:
    """Validate RouterOS timeout format (e.g. '7d', '24h', '30m')."""
    return bool(_TIMEOUT_RE.match(timeout))


def validate_ros_list_name(name: str) -> bool:
    """Validate address-list name format."""
    return bool(_LIST_NAME_RE.match(name))


def validate_ip_for_ros(ip: str) -> bool:
    """Validate an IP address is safe to pass to RouterOS."""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False
