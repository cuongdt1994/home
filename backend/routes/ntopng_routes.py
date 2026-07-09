"""ntopng traffic API routes."""

from fastapi import APIRouter, Query

from database import HostTrafficStat, TrafficStat, get_session
from services.ntopng_service import ntopng_service
from sqlalchemy import func

router = APIRouter(prefix="/api/ntopng", tags=["ntopng"])


@router.get("/interface")
async def get_interface_data():
    """Get current interface statistics from ntopng."""
    return await ntopng_service.get_interface_data()


@router.get("/hosts")
async def get_active_hosts():
    """Get list of active hosts from ntopng."""
    return await ntopng_service.get_active_hosts()


@router.get("/top-talkers")
async def get_top_talkers(limit: int = Query(10, ge=1, le=100)):
    """Get top bandwidth consumers from ntopng."""
    return await ntopng_service.get_top_talkers(limit)


@router.get("/host/{host_ip}")
async def get_host_detail(host_ip: str):
    """Get detailed stats for a specific host."""
    return await ntopng_service.get_host_data(host_ip)


@router.get("/traffic-history")
async def get_traffic_history(limit: int = Query(100, ge=1, le=1000)):
    """Get historical traffic snapshots from DB."""
    session = get_session()
    try:
        stats = session.query(TrafficStat).order_by(
            TrafficStat.recorded_at.desc()
        ).limit(limit).all()

        return [
            {
                "time": s.recorded_at,
                "bytes_in": s.bytes_in,
                "bytes_out": s.bytes_out,
                "packets_in": s.packets_in,
                "packets_out": s.packets_out,
                "active_hosts": s.active_hosts,
                "active_flows": s.active_flows,
            }
            for s in reversed(stats)
        ]
    finally:
        session.close()
