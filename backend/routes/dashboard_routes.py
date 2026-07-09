"""Dashboard aggregate API routes."""

from fastapi import APIRouter

from database import Alert, Device, Analysis, BlockEvent, get_session
from services.mikrotik_service import mikrotik_service
from sqlalchemy import func

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary():
    """Get aggregate KPI data for the dashboard."""
    session = get_session()
    try:
        total_alerts = session.query(func.count(Alert.id)).scalar() or 0
        critical_alerts = session.query(func.count(Alert.id)).filter(
            Alert.alert_severity == 1
        ).scalar() or 0
        online_devices = session.query(func.count(Device.id)).filter(
            Device.is_online == True
        ).scalar() or 0
        total_devices = session.query(func.count(Device.id)).scalar() or 0
        total_blocks = session.query(func.count(BlockEvent.id)).scalar() or 0

        # Recent alerts (last 10)
        recent = session.query(Alert).order_by(
            Alert.created_at.desc()
        ).limit(10).all()

        recent_alerts = [
            {
                "id": a.id,
                "timestamp": a.timestamp,
                "src_ip": a.src_ip,
                "dest_ip": a.dest_ip,
                "signature": a.alert_signature,
                "severity": a.alert_severity,
                "category": a.alert_category,
            }
            for a in recent
        ]

        return {
            "stats": {
                "total_alerts": total_alerts,
                "critical_alerts": critical_alerts,
                "online_devices": online_devices,
                "total_devices": total_devices,
                "total_blocks": total_blocks,
            },
            "recent_alerts": recent_alerts,
        }
    finally:
        session.close()


@router.get("/health")
async def health_check():
    """Check health of all data sources."""
    health = {
        "suricata": "unknown",
        "ntopng": "unknown",
        "mikrotik": "unknown",
        "deepseek": "unknown",
    }

    # Test MikroTik
    try:
        await mikrotik_service.get_system_resources()
        health["mikrotik"] = "online"
    except Exception:
        health["mikrotik"] = "offline"

    return {"status": "ok", "services": health}
