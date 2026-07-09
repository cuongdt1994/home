"""FastAPI main application — LAN Monitor Dashboard."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from config import settings
from database import init_db
from routes import router as ws_router
from routes.ai_routes import router as ai_router
from routes.auth_routes import router as auth_router
from routes.dashboard_routes import router as dashboard_router
from routes.mikrotik_routes import router as mikrotik_router
from routes.ntopng_routes import router as ntopng_router
from routes.suricata_routes import router as suricata_router
from services.deepseek_service import deepseek_service
from services.mikrotik_service import mikrotik_service
from services.ntopng_service import ntopng_service
from services.suricata_service import suricata_service
from websocket.manager import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting LAN Monitor Dashboard...")
    init_db()
    logger.info("Database initialized")

    # Wire WebSocket manager to services
    suricata_service.set_ws_manager(ws_manager)
    ntopng_service.set_ws_manager(ws_manager)
    mikrotik_service.set_ws_manager(ws_manager)
    deepseek_service.set_ws_manager(ws_manager)

    # Start background tasks
    suricata_task = asyncio.create_task(suricata_service.run_watcher())
    ntopng_task = asyncio.create_task(ntopng_service.run_poller())

    logger.info("All background tasks started")

    yield

    # Shutdown
    logger.info("Shutting down...")
    suricata_service.stop()
    ntopng_service._running = False

    suricata_task.cancel()
    ntopng_task.cancel()

    try:
        await suricata_task
    except asyncio.CancelledError:
        pass
    try:
        await ntopng_task
    except asyncio.CancelledError:
        pass

    await ntopng_service.close()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    description="LAN Network Monitoring Dashboard with AI-powered security",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes (no auth required)
app.include_router(auth_router)

# Protected routes (auth required)
app.include_router(ws_router, dependencies=[Depends(get_current_user)])
app.include_router(dashboard_router, dependencies=[Depends(get_current_user)])
app.include_router(suricata_router, dependencies=[Depends(get_current_user)])
app.include_router(ntopng_router, dependencies=[Depends(get_current_user)])
app.include_router(mikrotik_router, dependencies=[Depends(get_current_user)])
app.include_router(ai_router, dependencies=[Depends(get_current_user)])


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "ws": "/api/ws",
        "auth_required": True,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
