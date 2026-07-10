"""MikroTik API — health, interfaces, address-list management, and manual actions."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, IPvAnyAddress

from app.auth.dependencies import get_current_admin, get_current_user
from app.config import settings
from app.models.user import User
from app.services.audit import AuditLogger
from app.services.event_bus import event_bus
from app.services.whitelist import WhitelistEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mikrotik", tags=["mikrotik"])


# --- Request schemas ---
class BlockIPRequest(BaseModel):
    ip: str
    reason: str = "Manual block from dashboard"
    timeout: str = "7d"


class ExtendTimeoutRequest(BaseModel):
    timeout: str = "7d"


class WhitelistRequest(BaseModel):
    cidr: str
    reason: str = "Manual whitelist from dashboard"


# --- Health ---
@router.get("/health")
async def get_mikrotik_health(request: Request, _current_user: User = Depends(get_current_user)):
    """Get MikroTik system health (CPU, RAM, interfaces, uptime)."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        return {"error": "MikroTik service not initialized", "data": {}}
    health = await mikrotik.get_system_health()
    return {"data": health}


# --- Interfaces ---
@router.get("/interfaces")
async def get_interfaces(request: Request, _current_user: User = Depends(get_current_user)):
    """Get MikroTik interface list with stats."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        return {"error": "MikroTik service not initialized", "data": []}
    health = await mikrotik.get_system_health()
    return {"data": health.get("interfaces", [])}


# --- Address-list ---
@router.get("/address-list")
async def get_address_list(
    list_name: str = Query("ai_blacklist"),
    request: Request = None,
    _current_user: User = Depends(get_current_user),
):
    """Get entries from a MikroTik firewall address-list."""
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
    """Manually add an IP to the blacklist (admin only)."""
    whitelist: WhitelistEngine = getattr(request.app.state, "whitelist", None)
    if whitelist and whitelist.is_whitelisted(body.ip):
        raise HTTPException(status_code=400, detail=f"IP {body.ip} is whitelisted — cannot block")

    if settings.DRY_RUN:
        logger.info("DRY-RUN: Would manually block IP %s: %s", body.ip, body.reason)
        await event_bus.publish("blocked_ip", {
            "ip_address": body.ip, "risk_score": 0,
            "reason": body.reason, "dry_run": True, "action": "manual_dry_run",
        })
        return {"status": "dry_run", "message": f"DRY-RUN: Would block {body.ip}"}

    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        raise HTTPException(status_code=503, detail="MikroTik service not available")

    result = await mikrotik.add_to_address_list(
        body.ip, "ai_blacklist", body.timeout, f"Manual: {body.reason}"
    )

    # Audit
    audit: AuditLogger = getattr(request.app.state, "audit", None)
    if audit:
        await audit.log_decision(
            src_ip=body.ip, risk_score=0, reason=body.reason,
            dry_run=False, action="manual_block",
            result="success" if result["success"] else "failed",
        )

    await event_bus.publish("blocked_ip", {
        "ip_address": body.ip, "risk_score": 0,
        "reason": body.reason, "dry_run": False, "action": "manual_block",
    })

    return {"status": "ok" if result["success"] else "error", "result": result}


@router.delete("/blocked-ips/{ip}")
async def unblock_ip(
    ip: str,
    request: Request,
    _current_admin: User = Depends(get_current_admin),
):
    """Remove an IP from the blacklist (admin only)."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        raise HTTPException(status_code=503, detail="MikroTik service not available")

    removed = await mikrotik.remove_from_address_list(ip)
    if removed:
        logger.info("Manual unblock: %s removed from ai_blacklist", ip)
        return {"status": "ok", "message": f"IP {ip} unblocked"}
    else:
        return {"status": "not_found", "message": f"IP {ip} not found in blacklist"}


@router.put("/blocked-ips/{ip}/timeout")
async def extend_block_timeout(
    ip: str,
    body: ExtendTimeoutRequest,
    request: Request,
    _current_admin: User = Depends(get_current_admin),
):
    """Extend the timeout for a blocked IP by re-adding it (admin only)."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        raise HTTPException(status_code=503, detail="MikroTik service not available")

    # Remove then re-add with new timeout
    await mikrotik.remove_from_address_list(ip)
    result = await mikrotik.add_to_address_list(
        ip, "ai_blacklist", body.timeout, f"Timeout extended to {body.timeout}"
    )
    return {"status": "ok" if result["success"] else "error", "result": result}
