"""MikroTik RouterOS API routes."""

from fastapi import APIRouter, HTTPException, Query

from database import FirewallRule, get_session
from services.mikrotik_service import mikrotik_service

router = APIRouter(prefix="/api/mikrotik", tags=["mikrotik"])


@router.get("/status")
async def get_router_status():
    """Get MikroTik system resources (CPU, memory, uptime)."""
    try:
        resources = await mikrotik_service.get_system_resources()
        return resources
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"MikroTik unreachable: {str(e)}")


@router.get("/interfaces")
async def get_interfaces():
    """Get all interfaces with stats."""
    try:
        return await mikrotik_service.get_interface_list()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/arp")
async def get_arp_table():
    """Get ARP table for device discovery."""
    try:
        return await mikrotik_service.get_arp_table()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/dhcp-leases")
async def get_dhcp_leases():
    """Get DHCP leases for device discovery."""
    try:
        return await mikrotik_service.get_dhcp_leases()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/firewall")
async def get_firewall_rules():
    """Get all firewall filter rules."""
    try:
        return await mikrotik_service.get_firewall_rules()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/firewall/block")
async def block_ip(
    src_ip: str = Query(..., description="Source IP to block"),
    comment: str = Query("Manual block", description="Rule comment"),
):
    """Add a firewall rule to block an IP."""
    try:
        rule_id = await mikrotik_service.add_block_rule(src_ip, comment)
        return {"status": "blocked", "rule_id": rule_id, "src_ip": src_ip}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/firewall/{rule_id}/toggle")
async def toggle_rule(rule_id: str, disable: bool = Query(True)):
    """Enable or disable a firewall rule."""
    try:
        await mikrotik_service.toggle_rule(rule_id, disable)
        return {"status": "disabled" if disable else "enabled", "rule_id": rule_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/firewall/{rule_id}")
async def delete_rule(rule_id: str):
    """Delete a firewall rule."""
    try:
        await mikrotik_service.remove_rule(rule_id)
        return {"status": "deleted", "rule_id": rule_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/firewall/local")
async def get_local_firewall_rules():
    """Get locally cached firewall rules from DB."""
    session = get_session()
    try:
        rules = session.query(FirewallRule).order_by(
            FirewallRule.created_at.desc()
        ).limit(100).all()

        return [
            {
                "id": r.id,
                "mikrotik_id": r.mikrotik_id,
                "chain": r.chain,
                "action": r.action,
                "src_ip": r.src_ip,
                "comment": r.comment,
                "disabled": r.disabled,
                "source": r.source,
                "created_at": r.created_at,
                "expires_at": r.expires_at,
            }
            for r in rules
        ]
    finally:
        session.close()
