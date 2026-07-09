"""MikroTik RouterOS integration via SSH."""

import logging
import re
from datetime import datetime
from typing import Any

from database import FirewallRule, get_session
from services.ssh_client import get_mikrotik_client

logger = logging.getLogger(__name__)


class MikrotikService:
    """Interact with MikroTik RouterOS over SSH."""

    def __init__(self):
        self._ws_manager = None

    def set_ws_manager(self, manager):
        self._ws_manager = manager

    # ── System ──────────────────────────────────────────

    async def get_system_resources(self) -> dict[str, Any]:
        """Get CPU, memory, uptime from /system/resource/print."""
        client = get_mikrotik_client()
        raw = await client.execute("/system/resource/print")
        return self._parse_key_value(raw)

    async def get_interface_list(self) -> list[dict]:
        """Get all interfaces with stats."""
        client = get_mikrotik_client()
        raw = await client.execute("/interface/print detail")
        return self._parse_routeros_table(raw)

    async def get_interface_traffic(self, name: str = "") -> dict:
        """Get traffic for a specific interface or all."""
        client = get_mikrotik_client()
        cmd = "/interface/monitor-traffic once"
        if name:
            cmd += f" interface={name}"
        raw = await client.execute(cmd)
        return self._parse_key_value(raw)

    # ── Firewall ─────────────────────────────────────────

    async def get_firewall_rules(self) -> list[dict]:
        """Get all firewall filter rules."""
        client = get_mikrotik_client()
        raw = await client.execute("/ip/firewall/filter/print detail")
        return self._parse_routeros_table(raw)

    async def add_block_rule(
        self, src_ip: str, comment: str = "", timeout_hours: int = 24
    ) -> str | None:
        """Add a firewall rule to block an IP. Returns rule ID if successful."""
        safe_comment = comment.replace('"', "'").replace("\\", "")[:200]
        cmd = (
            f'/ip/firewall/filter/add chain=forward '
            f'src-address={src_ip} action=drop '
            f'comment="AI-BLOCK: {safe_comment}"'
        )
        client = get_mikrotik_client()
        result = await client.execute(cmd)
        # Returned value is the new rule's internal ID
        rule_id = result.strip()
        logger.info(f"Blocked {src_ip} — MikroTik rule #{rule_id}")

        # Also store locally
        session = get_session()
        try:
            rule = FirewallRule(
                mikrotik_id=rule_id,
                chain="forward",
                action="drop",
                src_ip=src_ip,
                comment=f"AI-BLOCK: {safe_comment}",
                source="ai",
                expires_at=(datetime.utcnow().isoformat() if timeout_hours > 0 else None),
            )
            session.add(rule)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to store firewall rule: {e}")
        finally:
            session.close()

        return rule_id

    async def remove_rule(self, rule_id: str) -> bool:
        """Remove a firewall rule by its MikroTik ID."""
        client = get_mikrotik_client()
        await client.execute(f"/ip/firewall/filter/remove numbers={rule_id}")
        logger.info(f"Removed MikroTik rule #{rule_id}")
        return True

    async def toggle_rule(self, rule_id: str, disable: bool) -> bool:
        """Enable or disable a firewall rule."""
        action = "disable" if disable else "enable"
        client = get_mikrotik_client()
        await client.execute(f"/ip/firewall/filter/{action} numbers={rule_id}")
        return True

    # ── ARP & DHCP ──────────────────────────────────────

    async def get_arp_table(self) -> list[dict]:
        """Get ARP table for device discovery."""
        client = get_mikrotik_client()
        raw = await client.execute("/ip/arp/print detail")
        return self._parse_routeros_table(raw)

    async def get_dhcp_leases(self) -> list[dict]:
        """Get DHCP leases for device discovery."""
        client = get_mikrotik_client()
        raw = await client.execute("/ip/dhcp-server/lease/print detail")
        return self._parse_routeros_table(raw)

    # ── Parsers ─────────────────────────────────────────

    @staticmethod
    def _parse_key_value(text: str) -> dict[str, Any]:
        """Parse RouterOS key: value output."""
        result = {}
        for line in text.strip().splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                key = key.strip()
                val = val.strip()
                # Convert numeric values
                try:
                    if "." in val:
                        result[key] = float(val)
                    else:
                        result[key] = int(val)
                except ValueError:
                    result[key] = val
        return result

    @staticmethod
    def _parse_routeros_table(text: str) -> list[dict]:
        """Parse RouterOS 'print detail' tabular output."""
        entries = []
        current = {}
        for line in text.strip().splitlines():
            line = line.strip()
            if not line or line.startswith("Flags:"):
                if current:
                    entries.append(current)
                    current = {}
                continue

            # Parse: 0   chain=input action=accept protocol=tcp ...
            # or: key=value key=value ...
            parts = line.split(None, 1) if line else []
            if not parts:
                continue

            # If line starts with a number (rule number), skip it
            start_idx = 0
            if parts[0].isdigit():
                if len(parts) > 1:
                    content = parts[1]
                else:
                    continue
            else:
                content = line

            # Parse key=value pairs
            for match in re.finditer(r'(\S+?)=("[^"]*"|\S*)', content):
                key = match.group(1)
                val = match.group(2).strip('"')
                current[key] = val

        if current:
            entries.append(current)
        return entries


# Singleton
mikrotik_service = MikrotikService()
