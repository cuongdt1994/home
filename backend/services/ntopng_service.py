"""ntopng REST API client — direct localhost access (no SSH tunnel needed)."""

import asyncio
import logging
from datetime import datetime

import httpx

from database import HostTrafficStat, TrafficStat, get_session

logger = logging.getLogger(__name__)


class NtopngService:
    """Access ntopng REST API directly on localhost."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._running = False
        self._ws_manager = None

    def set_ws_manager(self, manager):
        self._ws_manager = manager

    async def _ensure_client(self):
        """Create httpx client for direct ntopng API access."""
        if self._client is not None:
            return

        from config import settings

        self._client = httpx.AsyncClient(
            base_url=f"http://{settings.ntopng_host}:{settings.ntopng_local_port}",
            auth=(settings.ntopng_user, settings.ntopng_pass),
            timeout=15.0,
        )
        logger.info("ntopng client initialized on %s:%s", settings.ntopng_host, settings.ntopng_local_port)

    async def get_interface_data(self) -> dict:
        """Get main interface statistics."""
        await self._ensure_client()
        try:
            resp = await self._client.get("/lua/rest/v2/get/interface/data.lua")
            resp.raise_for_status()
            data = resp.json()
            if data.get("rc") != 0:
                logger.warning("ntopng API error: %s", data.get("rc_str", "unknown"))
                return {}
            return data.get("rsp", {})
        except Exception as e:
            logger.error("ntopng interface data error: %s", e)
            return {}

    async def get_active_hosts(self) -> list[dict]:
        """Get list of active hosts."""
        await self._ensure_client()
        try:
            resp = await self._client.get("/lua/rest/v2/get/host/active.lua")
            resp.raise_for_status()
            data = resp.json()
            return data.get("rsp", [])
        except Exception as e:
            logger.error("ntopng active hosts error: %s", e)
            return []

    async def get_host_data(self, host_ip: str) -> dict:
        """Get per-host traffic statistics."""
        await self._ensure_client()
        try:
            resp = await self._client.get(f"/lua/rest/v2/get/host/data.lua?host={host_ip}")
            resp.raise_for_status()
            data = resp.json()
            return data.get("rsp", {})
        except Exception as e:
            logger.error("ntopng host data error for %s: %s", host_ip, e)
            return {}

    async def get_top_talkers(self, limit: int = 10) -> list[dict]:
        """Get top talkers sorted by traffic."""
        await self._ensure_client()
        try:
            resp = await self._client.get("/lua/rest/v2/get/host/top/talkers.lua")
            resp.raise_for_status()
            data = resp.json()
            hosts = data.get("rsp", [])
            return hosts[:limit] if isinstance(hosts, list) else []
        except Exception as e:
            logger.error("ntopng top talkers error: %s", e)
            return []

    async def poll_and_store(self):
        """Poll ntopng API and store traffic stats."""
        await self._ensure_client()
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
                logger.error("Failed to store traffic stat: %s", e)
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
            logger.error("ntopng poll error: %s", e)

    async def run_poller(self):
        """Background task: poll ntopng periodically."""
        from config import settings
        self._running = True
        await asyncio.sleep(5)  # Initial delay

        while self._running:
            try:
                await self.poll_and_store()
            except Exception as e:
                logger.error("ntopng poller error: %s", e)
            await asyncio.sleep(settings.ntopng_poll_interval)

    async def close(self):
        self._running = False
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton
ntopng_service = NtopngService()
