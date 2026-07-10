"""Audit logs API — read-only access to the audit trail."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.models.audit_log import AuditEntry
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    src_ip: str | None = Query(None),
    action: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = select(AuditEntry)
    count_q = select(func.count(AuditEntry.id))

    if src_ip:
        query = query.where(AuditEntry.src_ip == src_ip)
        count_q = count_q.where(AuditEntry.src_ip == src_ip)
    if action:
        query = query.where(AuditEntry.action == action)
        count_q = count_q.where(AuditEntry.action == action)

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(desc(AuditEntry.timestamp)).offset(offset).limit(limit)
    )
    items = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": i.id,
                "timestamp": i.timestamp.isoformat() if i.timestamp else None,
                "src_ip": i.src_ip,
                "risk_score": i.risk_score,
                "reason": i.reason,
                "dry_run": i.dry_run,
                "action": i.action,
                "result": i.result,
                "deepseek_latency_ms": i.deepseek_latency_ms,
            }
            for i in items
        ],
    }
