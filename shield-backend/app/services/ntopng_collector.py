"""ntopng Statistics Collector — aggregation, caching, partial results (Sections 14-16)."""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import settings as app_settings
from app.services.ntopng import (
    NtopngClient,
    NtopngError,
    NtopngConnectionError,
    NtopngAuthenticationError,
    NtopngApiError,
)

logger = logging.getLogger(__name__)

MAX_CONCURRENCY = 5


@dataclass
class NtopngOverview:
    success: bool = True
    reachable: bool = True
    partial: bool = False
    stale: bool = False
    cache_age_seconds: float = 0.0
    collected_at: str = ""
    latency_ms: float = 0.0
    selected_ifid: int | None = None
    interfaces: list[dict] = field(default_factory=list)
    statistics: dict = field(default_factory=dict)
    applications: list[dict] = field(default_factory=list)
    hosts: list[dict] = field(default_factory=list)
    flows: list[dict] = field(default_factory=list)
    alerts: dict = field(default_factory=dict)
    system: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: dict = field(default_factory=dict)


class NtopngStatisticsCollector:
    """Collects ntopng data with bounded concurrency, caching, and partial results."""

    def __init__(self, client: NtopngClient):
        self._client = client
        self._sem = asyncio.Semaphore(MAX_CONCURRENCY)
        # Short-lived cache
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = app_settings.NTOPNG_CACHE_TTL

        # Last known good result (for stale fallback)
        self._last_good: Optional[NtopngOverview] = None

        # Single-flight tracking
        self._in_flight: dict[str, asyncio.Task] = {}

    async def _cached_request(self, path: str, params: dict | None, cache_key: str,
                               ttl: float | None = None) -> tuple[bool, Any, str]:
        """Request with cache and single-flight dedup."""
        ttl = ttl or self._cache_ttl

        # Cache hit
        if cache_key in self._cache:
            ts, val = self._cache[cache_key]
            if time.monotonic() - ts < ttl:
                return True, val, ""

        # Single-flight: reuse in-flight request
        if cache_key in self._in_flight:
            try:
                return await self._in_flight[cache_key]
            except Exception:
                pass

        async def _do():
            async with self._sem:
                ok, data, err = await self._client._request_safe(path, params)
                if ok:
                    self._cache[cache_key] = (time.monotonic(), data)
                return ok, data, err

        task = asyncio.create_task(_do())
        self._in_flight[cache_key] = task
        try:
            result = await task
            return result
        finally:
            self._in_flight.pop(cache_key, None)

    # ------------------------------------------------------------------
    # Main collection
    # ------------------------------------------------------------------

    async def collect_overview(self, ifid: int | None = None) -> NtopngOverview:
        """Collect all ntopng statistics for the dashboard overview."""
        result = NtopngOverview()
        start = time.monotonic()
        result.collected_at = datetime.now(timezone.utc).isoformat()

        # Phase 1: Discover interfaces
        ok, ifaces, err = await self._cached_request(
            "/lua/rest/v2/get/ntopng/interfaces.lua", None,
            "interfaces", ttl=30.0,
        )
        if not ok:
            result.success = False
            result.reachable = False
            result.errors["interfaces"] = err
            if err == "auth_failed":
                result.errors["message"] = "ntopng authentication failed — check credentials"
            elif err == "connection_failed":
                result.errors["message"] = "Cannot reach ntopng — check NTOPNG_BASE_URL and Docker networking"
            else:
                result.errors["message"] = f"ntopng error: {err}"
            # Return stale data if available
            if self._last_good:
                self._last_good.stale = True
                self._last_good.cache_age_seconds = (time.monotonic() - start) + 1
                return self._last_good
            result.latency_ms = (time.monotonic() - start) * 1000
            return result

        result.interfaces = ifaces

        # Resolve interface
        selected = await self._client.resolve_interface(ifid)
        if selected is None:
            result.errors["ifid"] = "no_interfaces"
            result.warnings.append("No ntopng interfaces found — check ntopng collector configuration")
            result.latency_ms = (time.monotonic() - start) * 1000
            return result
        result.selected_ifid = selected

        # Phase 2: Fetch statistics concurrently
        t_ifid = str(selected)

        tasks = {
            "statistics": self._cached_request(
                "/lua/rest/v2/get/interface/data.lua", {"ifid": t_ifid},
                f"stats:{selected}", ttl=5.0,
            ),
            "applications": self._cached_request(
                "/lua/rest/v2/get/interface/l7/stats.lua",
                {"ifid": t_ifid, "ndpistats_mode": "count"},
                f"l7:{selected}", ttl=10.0,
            ),
            "hosts": self._cached_request(
                "/lua/rest/v2/get/host/active.lua",
                {"ifid": t_ifid, "mode": "top_talkers", "limit": "20"},
                f"hosts:{selected}", ttl=10.0,
            ),
            "flows": self._cached_request(
                "/lua/rest/v2/get/interface/flows/active.lua",
                {"ifid": t_ifid, "limit": "50"},
                f"flows:{selected}", ttl=5.0,
            ),
            "alerts": self._cached_request(
                "/lua/rest/v2/get/interface/alerts.lua",
                {"ifid": t_ifid},
                f"alerts:{selected}", ttl=10.0,
            ),
            "system": self._cached_request(
                "/lua/rest/v2/get/ntopng/version.lua", None,
                "version", ttl=300.0,
            ),
        }

        gathered = {}
        for name, coro in tasks.items():
            try:
                ok, data, err = await coro
                gathered[name] = (ok, data, err)
            except Exception as e:
                gathered[name] = (False, None, str(e))

        # -- Parse results --
        ok, data, err = gathered.get("statistics", (False, None, ""))
        if ok and isinstance(data, dict):
            result.statistics = _normalize_interface_stats(data, selected)
        elif err:
            result.warnings.append(f"Interface stats unavailable: {err}")
            result.errors["statistics"] = err

        ok, data, err = gathered.get("applications", (False, None, ""))
        if ok:
            result.applications = _normalize_applications(data)
        elif err and err != "api_error_rc-2":
            result.warnings.append(f"L7 applications unavailable: {err}")
            result.errors["applications"] = err

        ok, data, err = gathered.get("hosts", (False, None, ""))
        if ok:
            result.hosts = _normalize_hosts(data)
        elif err:
            result.warnings.append(f"Hosts unavailable: {err}")
            result.errors["hosts"] = err

        ok, data, err = gathered.get("flows", (False, None, ""))
        if ok:
            result.flows = _normalize_flows(data)

        ok, data, err = gathered.get("alerts", (False, None, ""))
        if ok and isinstance(data, dict):
            result.alerts = data
        elif err:
            result.errors["alerts"] = err

        ok, data, err = gathered.get("system", (False, None, ""))
        if ok and isinstance(data, dict):
            result.system = {"version": data.get("version"), "edition": data.get("edition")}

        result.partial = len(result.warnings) > 0
        result.latency_ms = (time.monotonic() - start) * 1000

        # Cache last good result
        if result.success and not result.partial:
            self._last_good = result

        return result


# ------------------------------------------------------------------
# Normalizers (Section 8-11)
# ------------------------------------------------------------------

def _normalize_interface_stats(data: dict, ifid: int) -> dict:
    """Normalize interface statistics to a consistent schema."""
    # ntopng uses different key names across versions — handle both
    def _num(key, *alts):
        for k in (key,) + alts:
            v = data.get(k)
            if v is not None:
                try:
                    return int(v)
                except (ValueError, TypeError):
                    try:
                        return float(v)
                    except (ValueError, TypeError):
                        pass
        return None

    return {
        "ifid": ifid,
        "name": data.get("name", data.get("ifname", "")),
        "throughput_bps": _num("throughput", "throughput_bps", "num_throughput_bps"),
        "throughput_pps": _num("throughput_pps", "num_throughput_pps"),
        "download_bps": _num("bytes_rcvd", "download", "throughput_download"),
        "upload_bps": _num("bytes_sent", "upload", "throughput_upload"),
        "total_bytes": _num("num_bytes", "bytes", "tot_bytes"),
        "total_packets": _num("num_packets", "packets", "tot_packets"),
        "drops": _num("drops", "num_drops", "num_dropped_packets"),
        "active_hosts": _num("num_hosts", "active_hosts", "num_active_hosts"),
        "local_hosts": _num("num_local_hosts", "local_hosts"),
        "remote_hosts": _num("num_remote_hosts", "remote_hosts"),
        "active_flows": _num("num_flows", "active_flows", "num_active_flows"),
        "alerted_flows": _num("alerted_flows", "num_alerted_flows"),
        "engaged_alerts": _num("engaged_alerts", "num_engaged_alerts"),
        "_raw": data,
    }


def _normalize_applications(data: dict) -> list[dict]:
    """Normalize L7 application stats. Handles both dict and list formats."""
    apps_raw = data
    if isinstance(data, dict):
        apps_raw = data.get("stats", data.get("response", data.get("ndpi", [])))
    if not isinstance(apps_raw, (list, dict)):
        return []

    apps = []
    if isinstance(apps_raw, dict):
        for name, vals in apps_raw.items():
            if isinstance(vals, dict):
                apps.append({"name": name, "bytes": vals.get("bytes", 0),
                              "packets": vals.get("packets", 0),
                              "flows": vals.get("flows", 0)})
    elif isinstance(apps_raw, list):
        for item in apps_raw:
            if isinstance(item, dict):
                apps.append({
                    "name": item.get("name", item.get("label", "Unknown")),
                    "bytes": item.get("bytes", item.get("num_bytes", 0)),
                    "packets": item.get("packets", item.get("num_packets", 0)),
                    "flows": item.get("flows", item.get("num_flows", 0)),
                })

    total = sum(a.get("bytes", 0) or 0 for a in apps)
    for a in apps:
        b = a.get("bytes") or 0
        a["percentage"] = round((b / total) * 100, 1) if total > 0 else 0

    apps.sort(key=lambda a: a.get("bytes") or 0, reverse=True)
    return apps[:15]


def _normalize_hosts(data) -> list[dict]:
    hosts = data
    if isinstance(data, dict):
        hosts = data.get("hosts", data.get("response", []))
    if not isinstance(hosts, list):
        return []
    result = []
    for h in hosts[:20]:
        if isinstance(h, dict):
            result.append({
                "ip": h.get("ip", h.get("host", "")),
                "name": h.get("name", h.get("hostname", "")),
                "mac": h.get("mac", ""),
                "local": h.get("local", h.get("localhost", False)),
                "throughput": h.get("throughput", h.get("bytes", {}).get("throughput", 0) if isinstance(h.get("bytes"), dict) else 0),
                "total_bytes": h.get("bytes", h.get("total_bytes", 0)) if isinstance(h.get("bytes"), (int, float)) else 0,
                "active_flows": h.get("active_flows", h.get("num_flows", 0)),
            })
    return result


def _normalize_flows(data) -> list[dict]:
    flows = data
    if isinstance(data, dict):
        flows = data.get("flows", data.get("response", []))
    if not isinstance(flows, list):
        return []
    result = []
    for f in flows[:50]:
        if isinstance(f, dict):
            result.append({
                "client_ip": f.get("cli_ip", f.get("client_ip", "")),
                "server_ip": f.get("srv_ip", f.get("server_ip", "")),
                "client_port": f.get("cli_port", f.get("client_port")),
                "server_port": f.get("srv_port", f.get("server_port")),
                "proto": f.get("proto", f.get("protocol", "")),
                "application": f.get("proto_name", f.get("application", f.get("ndpi_proto", ""))),
                "bytes": f.get("bytes", f.get("total_bytes", 0)),
                "duration": f.get("duration", 0),
                "throughput": f.get("throughput", 0),
            })
    return result
