"""ntopng REST API client — async HTTP with basic auth."""

import logging
import time
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class NtopngClient:
    """Async client for ntopng REST API.

    Provides live network stats: top talkers, interface stats, active flows.
    Gracefully returns empty data when ntopng is unreachable.
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._last_latency_ms: Optional[float] = None
        self._healthy = False

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            auth = (
                httpx.BasicAuth(settings.NTOPNG_USER, settings.NTOPNG_PASSWORD)
                if settings.NTOPNG_USER and settings.NTOPNG_PASSWORD
                else None
            )
            self._client = httpx.AsyncClient(
                base_url=settings.NTOPNG_BASE_URL,
                auth=auth,
                timeout=httpx.Timeout(10.0),
            )
        return self._client

    @property
    def is_healthy(self) -> bool:
        return self._healthy

    @property
    def last_latency_ms(self) -> Optional[float]:
        return self._last_latency_ms

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        """Internal GET with error handling. Returns empty dict on failure."""
        try:
            client = await self._get_client()
            start = time.monotonic()
            resp = await client.get(path, params=params)
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            resp.raise_for_status()
            self._healthy = True
            data = resp.json()
            return data if isinstance(data, dict) else {"data": data}
        except httpx.TimeoutException:
            self._healthy = False
            logger.warning("ntopng API timeout: %s", path)
            return {}
        except httpx.HTTPStatusError as e:
            self._healthy = False
            logger.warning("ntopng HTTP %d on %s", e.response.status_code, path)
            return {}
        except Exception:
            self._healthy = False
            logger.exception("ntopng API error: %s", path)
            return {}

    async def get_interface_stats(self, ifid: int = 0) -> dict[str, Any]:
        """Get traffic statistics for an interface."""
        return await self._get(f"/lua/rest/v2/get/interface/data.lua", {"ifid": str(ifid)})

    async def get_top_hosts(self, limit: int = 20, ifid: int = 0) -> list[dict]:
        """Get top talkers by traffic volume."""
        result = await self._get(
            "/lua/rest/v2/get/interface/top/localstats.lua",
            {"ifid": str(ifid), "limit": str(limit)},
        )
        return result.get("response", [])

    async def get_active_flows(self, limit: int = 50, ifid: int = 0) -> list[dict]:
        """Get active flows."""
        result = await self._get(
            "/lua/rest/v2/get/interface/flows/active.lua",
            {"ifid": str(ifid), "limit": str(limit)},
        )
        return result.get("response", [])

    async def get_interface_list(self) -> list[dict]:
        """List available interfaces."""
        result = await self._get("/lua/rest/v2/get/interface/list.lua")
        return result.get("response", [])

    async def ping(self) -> tuple[bool, Optional[float]]:
        """Health-check: attempt to list interfaces."""
        try:
            start = time.monotonic()
            client = await self._get_client()
            resp = await client.get("/lua/rest/v2/get/interface/list.lua")
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            resp.raise_for_status()
            self._healthy = True
            return True, elapsed
        except Exception:
            self._healthy = False
            return False, None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
