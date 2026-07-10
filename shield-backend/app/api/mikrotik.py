"""MikroTik API — complete health, interfaces, address-list, and manual actions (Section 9)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel

from app.auth.dependencies import get_current_admin, get_current_user
from app.config import settings
from app.models.user import User
from app.services.audit import AuditLogger
from app.services.event_bus import event_bus
from app.services.mikrotik_collector import MikroTikHealthCollector
from app.services.whitelist import WhitelistEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mikrotik", tags=["mikrotik"])


# --- Request/Response schemas ---
class BlockIPRequest(BaseModel):
    ip: str
    reason: str = "Manual block from dashboard"
    timeout: str = "7d"


class ExtendTimeoutRequest(BaseModel):
    timeout: str = "7d"


# --- Health (new collector-based) ---
@router.get("/health")
async def get_mikrotik_health(request: Request, _current_user: User = Depends(get_current_user)):
    """Complete MikroTik health — system, memory, storage, health sensors, interfaces."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        return {"success": False, "reachable": False,
                "error": {"code": "MIKROTIK_NOT_CONFIGURED", "message": "MikroTik service not initialized"}}

    collector = MikroTikHealthCollector(mikrotik)
    result = await collector.collect_all()

    return {
        "success": result.success,
        "reachable": result.reachable,
        "collected_at": result.collected_at,
        "latency_ms": result.latency_ms,
        "partial": result.partial,
        "warnings": result.warnings,
        "system": result.system,
        "memory": result.memory,
        "storage": result.storage,
        "health": result.health,
        "interfaces": result.interfaces,
        "network": result.network,
        "errors": result.errors,
    }


# --- Interfaces (standalone, for frontend table) ---
@router.get("/interfaces")
async def get_interfaces(request: Request, _current_user: User = Depends(get_current_user)):
    """Get interfaces only (lighter than full health)."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        return {"data": []}
    collector = MikroTikHealthCollector(mikrotik)
    result = await collector.collect_all()
    return {"data": result.interfaces.get("items", []),
            "summary": result.interfaces.get("summary", {})}


# --- Address-list ---
@router.get("/address-list")
async def get_address_list(
    list_name: str = Query("ai_blacklist"),
    request: Request = None,
    _current_user: User = Depends(get_current_user),
):
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        return {"error": "MikroTik service not initialized", "data": []}
    entries = await mikrotik.get_address_list_entries(list_name)
    return {"data": entries, "list_name": list_name}


# --- Manual actions (admin only) ---
@router.post("/block-ip")
async def manually_block_ip(
    body: BlockIPRequest,
    request: Request,
    _current_admin: User = Depends(get_current_admin),
):
    whitelist: WhitelistEngine = getattr(request.app.state, "whitelist", None)
    if whitelist and whitelist.is_whitelisted(body.ip):
        raise HTTPException(status_code=400, detail=f"IP {body.ip} is whitelisted — cannot block")

    if settings.DRY_RUN:
        logger.info("DRY-RUN: Would manually block IP %s: %s", body.ip, body.reason)
        return {"status": "dry_run", "message": f"DRY-RUN: Would block {body.ip}"}

    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        raise HTTPException(status_code=503, detail="MikroTik service not available")

    result = await mikrotik.add_to_address_list(body.ip, "ai_blacklist", body.timeout, f"Manual: {body.reason}")

    audit: AuditLogger = getattr(request.app.state, "audit", None)
    if audit:
        await audit.log_decision(src_ip=body.ip, risk_score=0, reason=body.reason,
                                 dry_run=False, action="manual_block",
                                 result="success" if result["success"] else "failed")

    return {"status": "ok" if result["success"] else "error", "result": result}


@router.delete("/blocked-ips/{ip}")
async def unblock_ip(ip: str, request: Request, _current_admin: User = Depends(get_current_admin)):
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        raise HTTPException(status_code=503, detail="MikroTik service not available")
    removed = await mikrotik.remove_from_address_list(ip)
    return {"status": "ok" if removed else "not_found", "message": f"IP {ip} {'unblocked' if removed else 'not found'}"}


@router.put("/blocked-ips/{ip}/timeout")
async def extend_block_timeout(
    ip: str, body: ExtendTimeoutRequest, request: Request,
    _current_admin: User = Depends(get_current_admin),
):
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        raise HTTPException(status_code=503, detail="MikroTik service not available")
    await mikrotik.remove_from_address_list(ip)
    result = await mikrotik.add_to_address_list(ip, "ai_blacklist", body.timeout, f"Timeout extended to {body.timeout}")
    return {"status": "ok" if result["success"] else "error", "result": result}
