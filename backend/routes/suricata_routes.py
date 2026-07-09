"""Suricata alert API routes."""

from fastapi import APIRouter, Query

from database import Alert, get_session
from services.suricata_service import suricata_service
from sqlalchemy import func

router = APIRouter(prefix="/api/suricata", tags=["suricata"])


@router.get("/alerts")
async def get_alerts(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    severity: int | None = None,
    src_ip: str | None = None,
    search: str | None = None,
):
    """Get paginated alerts with optional filters."""
    session = get_session()
    try:
        q = session.query(Alert)

        if severity is not None:
            q = q.filter(Alert.alert_severity == severity)
        if src_ip:
            q = q.filter(Alert.src_ip == src_ip)
        if search:
            q = q.filter(
                Alert.alert_signature.contains(search) |
                Alert.alert_category.contains(search)
            )

        total = q.count()
        alerts = q.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "data": [
                {
                    "id": a.id,
                    "timestamp": a.timestamp,
                    "src_ip": a.src_ip,
                    "src_port": a.src_port,
                    "dest_ip": a.dest_ip,
                    "dest_port": a.dest_port,
                    "proto": a.proto,
                    "alert_signature": a.alert_signature,
                    "alert_category": a.alert_category,
                    "alert_severity": a.alert_severity,
                    "alert_action": a.alert_action,
                    "created_at": a.created_at,
                }
                for a in alerts
            ],
        }
    finally:
        session.close()


@router.get("/alerts/{alert_id}")
async def get_alert_detail(alert_id: int):
    """Get full alert details including raw JSON."""
    session = get_session()
    try:
        alert = session.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return {"error": "Alert not found"}, 404

        import json
        return {
            "id": alert.id,
            "timestamp": alert.timestamp,
            "src_ip": alert.src_ip,
            "src_port": alert.src_port,
            "dest_ip": alert.dest_ip,
            "dest_port": alert.dest_port,
            "proto": alert.proto,
            "alert_signature": alert.alert_signature,
            "alert_category": alert.alert_category,
            "alert_severity": alert.alert_severity,
            "alert_action": alert.alert_action,
            "raw_json": json.loads(alert.raw_json) if alert.raw_json else {},
            "created_at": alert.created_at,
        }
    finally:
        session.close()


@router.get("/stats")
async def get_alert_stats():
    """Get alert statistics."""
    return await suricata_service.get_alert_stats()


@router.get("/recent")
async def get_recent_alerts(limit: int = Query(20, ge=1, le=200)):
    """Get most recent alerts quickly."""
    return await suricata_service.get_recent_alerts(limit)


@router.get("/top-sources")
async def get_top_sources(limit: int = Query(10, ge=1, le=50)):
    """Get top alerting source IPs."""
    session = get_session()
    try:
        results = (
            session.query(Alert.src_ip, func.count(Alert.id).label("count"))
            .group_by(Alert.src_ip)
            .order_by(func.count(Alert.id).desc())
            .limit(limit)
            .all()
        )
        return [{"ip": ip, "count": count} for ip, count in results]
    finally:
        session.close()
