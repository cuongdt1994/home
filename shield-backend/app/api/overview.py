"""Dashboard overview API — aggregated stats for the landing page."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.config import settings
from app.models.suricata_alert import SuricataAlert
from app.models.ai_report import AIThreatReport
from app.models.blocked_ip import BlockedIP
from app.models.user import User

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("")
async def get_overview(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get dashboard overview statistics."""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)

    # Total alerts in last 24h
    alert_total = await db.execute(
        select(func.count(SuricataAlert.id)).where(SuricataAlert.timestamp >= last_24h)
    )

    # AI reports in last 24h
    report_total = await db.execute(
        select(func.count(AIThreatReport.id)).where(AIThreatReport.created_at >= last_24h)
    )

    # Malicious count
    malicious_count = await db.execute(
        select(func.count(AIThreatReport.id))
        .where(AIThreatReport.created_at >= last_24h)
        .where(AIThreatReport.is_malicious == True)  # noqa: E712
    )

    # Total blocked IPs
    blocked_total = await db.execute(select(func.count(BlockedIP.id)))

    # Health state from app.state
    health_state = getattr(request.app.state, "health_state", {})

    return {
        "alerts_24h": alert_total.scalar() or 0,
        "ai_reports_24h": report_total.scalar() or 0,
        "malicious_24h": malicious_count.scalar() or 0,
        "total_blocked_ips": blocked_total.scalar() or 0,
        "dry_run": settings.DRY_RUN,
        "services": health_state,
    }
