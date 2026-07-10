"""AI Threat Reports API."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.models.ai_report import AIThreatReport
from app.models.user import User

router = APIRouter(prefix="/ai-reports", tags=["ai-reports"])


@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    src_ip: str | None = Query(None),
    is_malicious: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = select(AIThreatReport)
    count_q = select(func.count(AIThreatReport.id))

    if src_ip:
        query = query.where(AIThreatReport.src_ip == src_ip)
        count_q = count_q.where(AIThreatReport.src_ip == src_ip)
    if is_malicious is not None:
        query = query.where(AIThreatReport.is_malicious == is_malicious)
        count_q = count_q.where(AIThreatReport.is_malicious == is_malicious)

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(desc(AIThreatReport.created_at)).offset(offset).limit(limit)
    )
    reports = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "src_ip": r.src_ip,
                "is_malicious": r.is_malicious,
                "risk_score": r.risk_score,
                "reason": r.reason,
                "action_taken": r.action_taken,
                "latency_ms": r.latency_ms,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reports
        ],
    }
