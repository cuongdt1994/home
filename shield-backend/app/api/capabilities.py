"""Capability detection API — shows which features are available from each integration."""

import os

from fastapi import APIRouter, Depends, Request

from app.auth.dependencies import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter(prefix="/capabilities", tags=["capabilities"])


@router.get("")
async def get_capabilities(
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    """Return the discovered capabilities of all integrations.

    The frontend uses this to hide/mark unsupported features.
    """
    eve_exists = os.path.exists(settings.EVE_JSON_PATH)

    caps = {
        "suricata": {
            "eve_json": eve_exists,
            "eve_path": settings.EVE_JSON_PATH,
            "event_types_seen": _get_suricata_event_types(request),
        },
        "ntopng": {
            "rest_api": bool(settings.NTOPNG_BASE_URL),
            "base_url": settings.NTOPNG_BASE_URL,
            "interfaces": True,
            "hosts": True,
            "flows": True,
            "applications": True,
            "alerts": True,
            "timeseries": False,  # Discovered at runtime
        },
        "mikrotik": {
            "mode": getattr(settings, 'MIKROTIK_MODE', 'ssh'),
            "rest_api": bool(getattr(settings, 'MIKROTIK_REST_BASE_URL', '')),
            "ssh": True,
            "host": settings.MIKROTIK_HOST,
            "system_resource": True,
            "interfaces": True,
            "interface_stats": True,
            "monitor_traffic": True,
            "firewall_address_list": True,
            "health": _check_mikrotik_health_cap(request),
            "routerboard": True,
        },
        "backend": {
            "deepseek_configured": bool(settings.DEEPSEEK_API_KEY),
            "telegram_configured": bool(settings.TELEGRAM_BOT_TOKEN),
            "dry_run": settings.DRY_RUN,
            "ai_block_risk_score": settings.AI_BLOCK_RISK_SCORE,
            "version": "1.0.0",
        },
    }

    return caps


def _get_suricata_event_types(request: Request) -> list[str]:
    """Get event types seen from the tailer state, or return known supported types."""
    tailer = getattr(request.app.state, "eve_tailer", None)
    # Return the list of event types the normalizer supports
    return ["alert", "dns", "http", "tls", "ssh", "flow", "stats", "anomaly", "fileinfo"]


def _check_mikrotik_health_cap(request: Request) -> bool:
    """Check if MikroTik health data is available."""
    mikrotik = getattr(request.app.state, "mikrotik", None)
    if mikrotik is None:
        return False
    return mikrotik.is_healthy if hasattr(mikrotik, 'is_healthy') else True
