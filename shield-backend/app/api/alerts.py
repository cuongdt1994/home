"""Suricata alerts API — read-only access to parsed alerts."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.models.suricata_alert import SuricataAlert
from app.models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    src_ip: str | None = Query(None),
    dest_ip: str | None = Query(None),
    severity: int | None = Query(None, ge=1, le=4),
    event_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """List Suricata alerts with pagination and optional filters."""
    query = select(SuricataAlert)
    count_query = select(func.count(SuricataAlert.id))

    if src_ip:
        query = query.where(SuricataAlert.src_ip == src_ip)
        count_query = count_query.where(SuricataAlert.src_ip == src_ip)
    if dest_ip:
        query = query.where(SuricataAlert.dest_ip == dest_ip)
        count_query = count_query.where(SuricataAlert.dest_ip == dest_ip)
    if severity is not None:
        query = query.where(SuricataAlert.alert_severity == severity)
        count_query = count_query.where(SuricataAlert.alert_severity == severity)
    if event_type:
        query = query.where(SuricataAlert.event_type == event_type)
        count_query = count_query.where(SuricataAlert.event_type == event_type)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    offset = (page - 1) * limit
    query = query.order_by(desc(SuricataAlert.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": a.id,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "src_ip": a.src_ip,
                "src_port": a.src_port,
                "dest_ip": a.dest_ip,
                "dest_port": a.dest_port,
                "proto": a.proto,
                "event_type": a.event_type,
                "alert_category": a.alert_category,
                "alert_severity": a.alert_severity,
                "alert_signature": a.alert_signature,
            }
            for a in alerts
        ],
    }


@router.get("/stats")
async def alert_stats(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get alert statistics for the last N hours."""
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Total alerts
    total_result = await db.execute(
        select(func.count(SuricataAlert.id)).where(SuricataAlert.timestamp >= since)
    )
    total = total_result.scalar() or 0

    # Top source IPs
    top_src_result = await db.execute(
        select(SuricataAlert.src_ip, func.count(SuricataAlert.id).label("count"))
        .where(SuricataAlert.timestamp >= since)
        .group_by(SuricataAlert.src_ip)
        .order_by(desc("count"))
        .limit(10)
    )
    top_sources = [{"src_ip": row[0], "count": row[1]} for row in top_src_result.all()]

    # By severity
    sev_result = await db.execute(
        select(SuricataAlert.alert_severity, func.count(SuricataAlert.id).label("count"))
        .where(SuricataAlert.timestamp >= since)
        .group_by(SuricataAlert.alert_severity)
    )
    by_severity = {str(row[0] or "unknown"): row[1] for row in sev_result.all()}

    return {
        "hours": hours,
        "total_alerts": total,
        "top_sources": top_sources,
        "by_severity": by_severity,
    }
