"""ntopng REST API client — async HTTP with auth, response validation, and logging."""

import logging
import time
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ntopng response envelope
# {"rc": 0, "rc_str": "OK", "rsp": {...}}


class NtopngError(Exception):
    pass


class NtopngConnectionError(NtopngError):
    pass


class NtopngAuthenticationError(NtopngError):
    pass


class NtopngApiError(NtopngError):
    def __init__(self, rc: int, rc_str: str):
        self.rc = rc
        self.rc_str = rc_str
        super().__init__(f"ntopng API error: rc={rc} {rc_str}")


class NtopngInvalidResponseError(NtopngError):
    pass


class NtopngClient:
    """Async client for ntopng REST API v2 with proper validation."""

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._last_latency_ms: Optional[float] = None
        self._healthy = False
        self._last_error: str = ""

    @property
    def is_healthy(self) -> bool:
        return self._healthy

    @property
    def last_latency_ms(self) -> Optional[float]:
        return self._last_latency_ms

    @property
    def last_error(self) -> str:
        return self._last_error

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            connect_timeout = getattr(settings, 'NTOPNG_CONNECT_TIMEOUT', 5)
            read_timeout = getattr(settings, 'NTOPNG_READ_TIMEOUT', 15)
            auth = None
            if settings.NTOPNG_USER and settings.NTOPNG_PASSWORD:
                auth = httpx.BasicAuth(settings.NTOPNG_USER, settings.NTOPNG_PASSWORD)
            self._client = httpx.AsyncClient(
                base_url=settings.NTOPNG_BASE_URL,
                auth=auth,
                timeout=httpx.Timeout(connect=connect_timeout, read=read_timeout, write=10, pool=5),
                headers={"User-Agent": "AI-Shield/1.0", "Accept": "application/json"},
                follow_redirects=False,
            )
        return self._client

    # ------------------------------------------------------------------
    # Core request method with ntopng response validation
    # ------------------------------------------------------------------

    async def _request(self, path: str, params: dict | None = None) -> dict[str, Any]:
        """Execute a GET request against the ntopng REST API.

        Validates HTTP status, content-type, and ntopng 'rc' field.
        Returns the 'rsp' value on success (rc=0).

        Raises:
            NtopngConnectionError: Connection refused / timeout / DNS failure
            NtopngAuthenticationError: 401, redirect to login, HTML response
            NtopngApiError: rc != 0
            NtopngInvalidResponseError: Invalid JSON, missing rc field
        """
        client = await self._get_client()
        start = time.monotonic()

        try:
            resp = await client.get(path, params=params)
        except httpx.TimeoutException:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._healthy = False
            self._last_error = f"Timeout: {path}"
            logger.warning("ntopng timeout (%.0fms): %s", elapsed, path)
            raise NtopngConnectionError(f"ntopng timeout after {elapsed:.0f}ms: {path}")
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._healthy = False
            self._last_error = f"Connection failed: {e}"
            logger.warning("ntopng connection failed: %s", e)
            raise NtopngConnectionError(f"Cannot connect to ntopng at {settings.NTOPNG_BASE_URL}: {e}")

        elapsed = (time.monotonic() - start) * 1000
        self._last_latency_ms = elapsed

        # Check for redirect (login page)
        if resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("Location", "")
            self._healthy = False
            self._last_error = f"Redirect to {location}"
            logger.warning("ntopng redirect to: %s", location)
            if "login" in location.lower():
                raise NtopngAuthenticationError("ntopng redirected to login page — check credentials")
            raise NtopngInvalidResponseError(f"Unexpected redirect to: {location}")

        # Check HTTP status
        if resp.status_code == 401:
            self._healthy = False
            self._last_error = "Authentication failed"
            raise NtopngAuthenticationError("ntopng authentication failed — check NTOPNG_USER/NTOPNG_PASSWORD")
        if resp.status_code == 403:
            self._healthy = False
            self._last_error = "Permission denied"
            raise NtopngAuthenticationError("ntopng permission denied — check account permissions")

        # Detect HTML response (login page returned as 200)
        ct = resp.headers.get("Content-Type", "")
        if "text/html" in ct or resp.text.strip().startswith("<!DOCTYPE") or resp.text.strip().startswith("<html"):
            self._healthy = False
            self._last_error = "HTML login page returned"
            logger.warning("ntopng returned HTML instead of JSON — likely not authenticated")
            raise NtopngAuthenticationError("ntopng returned HTML login page — check credentials")

        # Parse JSON
        try:
            data = resp.json()
        except Exception:
            self._healthy = False
            self._last_error = "Invalid JSON response"
            raise NtopngInvalidResponseError(f"ntopng returned non-JSON response (status={resp.status_code})")

        # Validate ntopng response envelope
        if not isinstance(data, dict):
            self._healthy = False
            raise NtopngInvalidResponseError("ntopng response is not a JSON object")

        rc = data.get("rc")
        if rc is None:
            self._healthy = False
            raise NtopngInvalidResponseError("ntopng response missing 'rc' field")

        if rc != 0:
            rc_str = data.get("rc_str", "unknown error")
            self._healthy = False
            self._last_error = f"API error rc={rc}: {rc_str}"
            logger.warning("ntopng API error rc=%d: %s", rc, rc_str)
            raise NtopngApiError(rc, rc_str)

        rsp = data.get("rsp")
        self._healthy = True
        return rsp if rsp is not None else {}

    async def _request_safe(self, path: str, params: dict | None = None) -> tuple[bool, Any, str]:
        """Safe request that never raises. Returns (ok, data, error_code)."""
        try:
            rsp = await self._request(path, params)
            return True, rsp, ""
        except NtopngAuthenticationError as e:
            return False, None, "auth_failed"
        except NtopngConnectionError:
            return False, None, "connection_failed"
        except NtopngApiError as e:
            return False, None, f"api_error_rc{e.rc}"
        except NtopngInvalidResponseError:
            return False, None, "invalid_response"
        except Exception:
            return False, None, "unknown_error"

    # ------------------------------------------------------------------
    # Interface discovery (Section 4)
    # ------------------------------------------------------------------

    async def get_interfaces(self) -> list[dict]:
        """Discover ntopng interfaces. Returns list of {ifid, name, description, active}."""
        try:
            rsp = await self._request("/lua/rest/v2/get/ntopng/interfaces.lua")
        except NtopngError:
            # Fallback: try legacy endpoint
            try:
                rsp = await self._request("/lua/rest/v2/get/interfaces.lua")
            except NtopngError:
                return []

        if isinstance(rsp, list):
            result = rsp
        elif isinstance(rsp, dict):
            result = rsp.get("interfaces", rsp.get("response", []))
        else:
            return []

        normalized = []
        for iface in result:
            if not isinstance(iface, dict):
                continue
            ifid = iface.get("ifid") or iface.get("id")
            if ifid is None:
                continue
            normalized.append({
                "ifid": int(ifid),
                "name": iface.get("name", iface.get("ifname", str(ifid))),
                "description": iface.get("description", iface.get("name", "")),
                "active": bool(iface.get("active", True)),
                "type": iface.get("type", iface.get("iface_type", "")),
            })
        return normalized

    async def resolve_interface(self, ifid: int | None = None) -> int | None:
        """Resolve the interface to use. Priority:
        1. Explicit ifid parameter
        2. NTOPNG_DEFAULT_IFID config
        3. First active interface
        4. First interface
        """
        ifaces = await self.get_interfaces()
        if not ifaces:
            return None

        # If explicit ifid given, verify it exists
        if ifid is not None:
            for i in ifaces:
                if i["ifid"] == ifid:
                    return ifid

        # Config default
        config_ifid = getattr(settings, 'NTOPNG_DEFAULT_IFID', None)
        if config_ifid:
            for i in ifaces:
                if i["ifid"] == int(config_ifid):
                    return int(config_ifid)

        # Config default by name
        config_name = getattr(settings, 'NTOPNG_DEFAULT_INTERFACE', None)
        if config_name:
            for i in ifaces:
                if i["name"] == config_name:
                    return i["ifid"]

        # First active
        for i in ifaces:
            if i.get("active"):
                return i["ifid"]

        # First available
        return ifaces[0]["ifid"]

    # ------------------------------------------------------------------
    # Statistics (Sections 8-12)
    # ------------------------------------------------------------------

    async def get_interface_data(self, ifid: int) -> dict[str, Any]:
        """Get traffic statistics for an interface."""
        rsp = await self._request("/lua/rest/v2/get/interface/data.lua", {"ifid": str(ifid)})
        return rsp if isinstance(rsp, dict) else {}

    async def get_l7_statistics(self, ifid: int) -> dict[str, Any]:
        """Get L7 application statistics."""
        rsp = await self._request(
            "/lua/rest/v2/get/interface/l7/stats.lua",
            {"ifid": str(ifid), "ndpistats_mode": "count"},
        )
        return rsp if isinstance(rsp, dict) else {}

    async def get_active_hosts(self, ifid: int, limit: int = 20,
                                 mode: str = "top_talkers") -> list[dict]:
        """Get active hosts for an interface."""
        rsp = await self._request(
            "/lua/rest/v2/get/host/active.lua",
            {"ifid": str(ifid), "mode": mode, "limit": str(limit)},
        )
        if isinstance(rsp, dict):
            return rsp.get("hosts", rsp.get("response", []))
        return rsp if isinstance(rsp, list) else []

    async def get_active_flows(self, ifid: int, limit: int = 50) -> list[dict]:
        """Get active flows for an interface."""
        rsp = await self._request(
            "/lua/rest/v2/get/interface/flows/active.lua",
            {"ifid": str(ifid), "limit": str(limit)},
        )
        if isinstance(rsp, dict):
            return rsp.get("flows", rsp.get("response", []))
        return rsp if isinstance(rsp, list) else []

    async def get_alert_statistics(self, ifid: int) -> dict[str, Any]:
        """Get alert statistics for an interface."""
        try:
            rsp = await self._request("/lua/rest/v2/get/interface/alerts.lua", {"ifid": str(ifid)})
            return rsp if isinstance(rsp, dict) else {}
        except NtopngError:
            return {"available": False, "reason": "unsupported_by_edition"}

    async def get_ntopng_info(self) -> dict[str, Any]:
        """Get ntopng version and system info."""
        try:
            rsp = await self._request("/lua/rest/v2/get/ntopng/version.lua")
            return rsp if isinstance(rsp, dict) else {}
        except NtopngError:
            return {}

    # ------------------------------------------------------------------
    # Health / ping
    # ------------------------------------------------------------------

    async def ping(self) -> tuple[bool, Optional[float]]:
        try:
            start = time.monotonic()
            _ = await self._request("/lua/rest/v2/get/ntopng/interfaces.lua")
            elapsed = (time.monotonic() - start) * 1000
            self._last_latency_ms = elapsed
            self._healthy = True
            return True, elapsed
        except Exception:
            self._healthy = False
            return False, None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
