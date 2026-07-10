"""ntopng API — interface discovery, statistics, applications, hosts, flows, diagnostics."""

import logging

from fastapi import APIRouter, Depends, Query, Request

from app.auth.dependencies import get_current_user, get_current_admin
from app.models.user import User
from app.services.ntopng_collector import NtopngStatisticsCollector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ntopng", tags=["ntopng"])


def _get_collector(request: Request):
    client = getattr(request.app.state, "ntopng", None)
    if client is None:
        return None
    return NtopngStatisticsCollector(client)


# ------------------------------------------------------------------
# Overview / statistics
# ------------------------------------------------------------------

@router.get("/statistics")
async def get_statistics(
    request: Request,
    ifid: int | None = Query(None),
    _current_user: User = Depends(get_current_user),
):
    """Complete ntopng overview with interface stats, apps, hosts, flows."""
    collector = _get_collector(request)
    if collector is None:
        return {"success": False, "reachable": False,
                "error": {"code": "NTOPNG_NOT_CONFIGURED", "message": "ntopng service not initialized"}}

    result = await collector.collect_overview(ifid)
    return {
        "success": result.success,
        "reachable": result.reachable,
        "partial": result.partial,
        "stale": result.stale,
        "cache_age_seconds": result.cache_age_seconds,
        "collected_at": result.collected_at,
        "latency_ms": result.latency_ms,
        "selected_ifid": result.selected_ifid,
        "interfaces": result.interfaces,
        "statistics": result.statistics,
        "applications": result.applications,
        "hosts": result.hosts,
        "flows": result.flows,
        "alerts": result.alerts,
        "system": result.system,
        "warnings": result.warnings,
        "errors": result.errors,
    }


# ------------------------------------------------------------------
# Individual endpoints
# ------------------------------------------------------------------

@router.get("/interfaces")
async def get_interfaces(request: Request, _current_user: User = Depends(get_current_user)):
    """List discovered ntopng interfaces."""
    client = getattr(request.app.state, "ntopng", None)
    if client is None:
        return {"data": []}
    ifaces = await client.get_interfaces()
    return {"data": ifaces}


@router.get("/interfaces/{ifid}")
async def get_interface_detail(
    ifid: int,
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    """Get statistics for a specific interface."""
    collector = _get_collector(request)
    if collector is None:
        return {"data": {}}
    result = await collector.collect_overview(ifid)
    return {"data": result.statistics}


@router.get("/interfaces/{ifid}/applications")
async def get_applications(
    ifid: int,
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    """Get L7 application stats for a specific interface."""
    collector = _get_collector(request)
    if collector is None:
        return {"data": []}
    result = await collector.collect_overview(ifid)
    return {"data": result.applications}


@router.get("/interfaces/{ifid}/hosts")
async def get_hosts(
    ifid: int,
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    """Get top hosts for a specific interface."""
    collector = _get_collector(request)
    if collector is None:
        return {"data": []}
    result = await collector.collect_overview(ifid)
    return {"data": result.hosts}


@router.get("/interfaces/{ifid}/flows")
async def get_flows(
    ifid: int,
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    """Get active flows for a specific interface."""
    collector = _get_collector(request)
    if collector is None:
        return {"data": []}
    result = await collector.collect_overview(ifid)
    return {"data": result.flows}


# ------------------------------------------------------------------
# Diagnostics (admin only)
# ------------------------------------------------------------------

@router.get("/diagnostics")
async def get_diagnostics(
    request: Request,
    _current_admin: User = Depends(get_current_admin),
):
    """Admin-only diagnostics — connectivity, auth, interface discovery."""
    from app.config import settings

    client = getattr(request.app.state, "ntopng", None)
    if client is None:
        return {"configured_url": settings.NTOPNG_BASE_URL, "reachable": False,
                "error": "ntopng service not initialized"}

    ifaces = await client.get_interfaces()
    ok, latency = await client.ping()

    return {
        "configured_url": settings.NTOPNG_BASE_URL,
        "reachable": ok,
        "authentication": "success" if ok else "check_credentials",
        "latency_ms": latency,
        "interfaces_count": len(ifaces),
        "interfaces": ifaces,
        "last_error": client.last_error if hasattr(client, 'last_error') else "",
    }
