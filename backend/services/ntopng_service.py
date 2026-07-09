"""ntopng REST API client accessed via SSH tunnel."""

import asyncio
import logging
from datetime import datetime

import httpx

from database import HostTrafficStat, TrafficStat, get_session
from services.ssh_client import get_suricata_client

logger = logging.getLogger(__name__)


class NtopngService:
    """Access ntopng REST API through SSH port-forward tunnel."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._tunnel_task: asyncio.Task | None = None
        self._local_port = 13000  # Local port for SSH tunnel
        self._running = False
        self._ws_manager = None

    def set_ws_manager(self, manager):
        self._ws_manager = manager

    async def _ensure_tunnel(self):
        """Create SSH local port forward to ntopng on remote server."""
        if self._client is not None:
            return

        ssh = get_suricata_client()
        conn = await ssh.connect()

        # Port forward: local 13000 -> remote localhost:3000 (ntopng)
        try:
            listener = await conn.forward_local_port(
                '', self._local_port, '127.0.0.1', 3000
            )
            logger.info(f"SSH tunnel established: localhost:{self._local_port} -> ntopng:3000")
        except Exception as e:
            logger.warning(f"Port forward may already exist: {e}")

        self._client = httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{self._local_port}",
            auth=(self._get_ntopng_user(), self._get_ntopng_pass()),
            timeout=15.0,
        )

    def _get_ntopng_user(self) -> str:
        from config import settings
        return settings.ntopng_user

    def _get_ntopng_pass(self) -> str:
        from config import settings
        return settings.ntopng_pass

    async def get_interface_data(self) -> dict:
        """Get main interface statistics."""
        await self._ensure_tunnel()
        try:
            resp = await self._client.get("/lua/rest/v2/get/interface/data.lua")
            resp.raise_for_status()
            data = resp.json()
            if data.get("rc") != 0:
                logger.warning(f"ntopng API error: {data.get('rc_str', 'unknown')}")
                return {}
            return data.get("rsp", {})
        except Exception as e:
            logger.error(f"ntopng interface data error: {e}")
            return {}

    async def get_active_hosts(self) -> list[dict]:
        """Get list of active hosts."""
        await self._ensure_tunnel()
        try:
            resp = await self._client.get("/lua/rest/v2/get/host/active.lua")
            resp.raise_for_status()
            data = resp.json()
            return data.get("rsp", [])
        except Exception as e:
            logger.error(f"ntopng active hosts error: {e}")
            return []

    async def get_host_data(self, host_ip: str) -> dict:
        """Get per-host traffic statistics."""
        await self._ensure_tunnel()
        try:
            resp = await self._client.get(f"/lua/rest/v2/get/host/data.lua?host={host_ip}")
            resp.raise_for_status()
            data = resp.json()
            return data.get("rsp", {})
        except Exception as e:
            logger.error(f"ntopng host data error for {host_ip}: {e}")
            return {}

    async def get_top_talkers(self, limit: int = 10) -> list[dict]:
        """Get top talkers sorted by traffic."""
        await self._ensure_tunnel()
        try:
            resp = await self._client.get("/lua/rest/v2/get/host/top/talkers.lua")
            resp.raise_for_status()
            data = resp.json()
            hosts = data.get("rsp", [])
            return hosts[:limit] if isinstance(hosts, list) else []
        except Exception as e:
            logger.error(f"ntopng top talkers error: {e}")
            return []

    async def poll_and_store(self):
        """Poll ntopng API and store traffic stats."""
        await self._ensure_tunnel()
        try:
            iface = await self.get_interface_data()

            # Store traffic snapshot
            session = get_session()
            try:
                stat = TrafficStat(
                    bytes_in=iface.get("bytes", {}).get("rcvd", 0) if isinstance(iface.get("bytes"), dict) else 0,
                    bytes_out=iface.get("bytes", {}).get("sent", 0) if isinstance(iface.get("bytes"), dict) else 0,
                    packets_in=iface.get("packets", {}).get("rcvd", 0) if isinstance(iface.get("packets"), dict) else 0,
                    packets_out=iface.get("packets", {}).get("sent", 0) if isinstance(iface.get("packets"), dict) else 0,
                    active_hosts=iface.get("num_hosts", 0) if isinstance(iface, dict) else 0,
                    active_flows=iface.get("num_flows", 0) if isinstance(iface, dict) else 0,
                )
                session.add(stat)
                session.commit()
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to store traffic stat: {e}")
            finally:
                session.close()

            # Broadcast via WebSocket
            if self._ws_manager:
                await self._ws_manager.broadcast({
                    "type": "traffic",
                    "payload": {
                        "interface": iface if isinstance(iface, dict) else {},
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                })

        except Exception as e:
            logger.error(f"ntopng poll error: {e}")

    async def run_poller(self):
        """Background task: poll ntopng periodically."""
        from config import settings
        self._running = True
        await asyncio.sleep(5)  # Initial delay

        while self._running:
            try:
                await self.poll_and_store()
            except Exception as e:
                logger.error(f"ntopng poller error: {e}")
            await asyncio.sleep(settings.ntopng_poll_interval)

    async def close(self):
        self._running = False
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton
ntopng_service = NtopngService()
