"""Settings API — read/update runtime configuration."""

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user, get_current_admin
from app.config import settings as app_settings
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings(_current_user: User = Depends(get_current_user)):
    """Get current runtime configuration (safe view — no secrets)."""
    return {
        "dry_run": app_settings.DRY_RUN,
        "ai_block_risk_score": app_settings.AI_BLOCK_RISK_SCORE,
        "ai_max_concurrent_requests": app_settings.AI_MAX_CONCURRENT_REQUESTS,
        "deepseek_timeout_seconds": app_settings.DEEPSEEK_TIMEOUT_SECONDS,
        "mikrotik_host": app_settings.MIKROTIK_HOST,
        "mikrotik_blacklist_timeout": app_settings.MIKROTIK_BLACKLIST_TIMEOUT,
        "ntopng_base_url": app_settings.NTOPNG_BASE_URL,
        "retention_alert_days": app_settings.RETENTION_ALERT_DAYS,
        "retention_ai_report_days": app_settings.RETENTION_AI_REPORT_DAYS,
        "retention_audit_days": app_settings.RETENTION_AUDIT_DAYS,
        "prune_interval_hours": app_settings.PRUNE_INTERVAL_HOURS,
        "telegram_configured": bool(app_settings.TELEGRAM_BOT_TOKEN and app_settings.TELEGRAM_CHAT_ID),
        "deepseek_configured": bool(app_settings.DEEPSEEK_API_KEY),
    }


@router.put("")
async def update_settings(
    dry_run: bool | None = None,
    ai_block_risk_score: int | None = None,
    _current_user: User = Depends(get_current_admin),
):
    """Update runtime settings (admin only). Note: changes revert on restart unless .env is updated."""
    updated = {}
    if dry_run is not None:
        app_settings.DRY_RUN = dry_run
        updated["dry_run"] = dry_run
    if ai_block_risk_score is not None:
        if 0 <= ai_block_risk_score <= 10:
            app_settings.AI_BLOCK_RISK_SCORE = ai_block_risk_score
            updated["ai_block_risk_score"] = ai_block_risk_score
    return {"status": "ok", "updated": updated}
