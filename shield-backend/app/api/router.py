"""Aggregated API router — includes all sub-routers under /api."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.alerts import router as alerts_router
from app.api.threats import router as threats_router
from app.api.blocked import router as blocked_router
from app.api.mikrotik import router as mikrotik_router
from app.api.ntopng import router as ntopng_router
from app.api.audit import router as audit_router
from app.api.settings import router as settings_router
from app.api.overview import router as overview_router
from app.api.events import router as events_router
from app.api.capabilities import router as capabilities_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(alerts_router)
api_router.include_router(threats_router)
api_router.include_router(blocked_router)
api_router.include_router(mikrotik_router)
api_router.include_router(ntopng_router)
api_router.include_router(audit_router)
api_router.include_router(settings_router)
api_router.include_router(overview_router)
api_router.include_router(events_router)
api_router.include_router(capabilities_router)
