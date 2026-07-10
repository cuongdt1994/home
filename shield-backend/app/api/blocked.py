"""Blocked IPs API."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.models.blocked_ip import BlockedIP
from app.models.user import User

router = APIRouter(prefix="/blocked-ips", tags=["blocked-ips"])


@router.get("")
async def list_blocked(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    src_ip: str | None = Query(None),
    dry_run: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = select(BlockedIP)
    count_q = select(func.count(BlockedIP.id))

    if src_ip:
        query = query.where(BlockedIP.ip_address == src_ip)
        count_q = count_q.where(BlockedIP.ip_address == src_ip)
    if dry_run is not None:
        query = query.where(BlockedIP.dry_run == dry_run)
        count_q = count_q.where(BlockedIP.dry_run == dry_run)

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(desc(BlockedIP.blocked_at)).offset(offset).limit(limit)
    )
    items = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": i.id,
                "ip_address": i.ip_address,
                "risk_score": i.risk_score,
                "reason": i.reason,
                "action": i.action,
                "dry_run": i.dry_run,
                "mikrotik_result": i.mikrotik_result,
                "blocked_at": i.blocked_at.isoformat() if i.blocked_at else None,
                "expires_at": i.expires_at.isoformat() if i.expires_at else None,
            }
            for i in items
        ],
    }
