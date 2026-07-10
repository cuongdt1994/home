"""FastAPI application entry point with full lifespan management.

Wires together: database, background workers (pipeline, health checker,
pruner, config hot-reloader), and all API routes.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.database import init_database, close_database, async_session
from app.logger import setup_logging
from app.services.hot_reload import ConfigWatcher
from app.services.ntopng import NtopngClient
from app.services.pruning import run_pruning_scheduler
from app.workers.health import run_health_checker
from app.workers.pipeline import run_pipeline

logger = logging.getLogger(__name__)

_shutdown_event = asyncio.Event()


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ==================================================================
    # STARTUP
    # ==================================================================
    setup_logging(settings.LOG_LEVEL)
    logger.info("=== AI Shield Backend Starting ===")
    logger.info("DRY_RUN=%s | AI_BLOCK_RISK_SCORE=%d | LOG_LEVEL=%s",
                 settings.DRY_RUN, settings.AI_BLOCK_RISK_SCORE, settings.LOG_LEVEL)

    await init_database()

    # -- Shared state --
    app.state.shutdown_event = _shutdown_event
    app.state.health_state = {
        "mikrotik_ssh": {"ok": False, "latency_ms": None},
        "ntopng": {"ok": False, "latency_ms": None},
        "deepseek": {"ok": False, "latency_ms": None},
        "database": {"ok": True},
        "eve_tailer": {"ok": False, "last_event_at": None},
    }

    # -- External service clients (for API access) --
    app.state.ntopng = NtopngClient()

    # -- Config hot-reloader --
    config_watcher = ConfigWatcher()
    # (registered after pipeline sets up whitelist/threshold in app.state)

    # -- Background tasks --
    tasks: list[asyncio.Task] = []

    # 1. Pipeline (tailer → normalizer → aggregator → DeepSeek → MikroTik)
    pipeline_task = asyncio.create_task(
        run_pipeline(_shutdown_event, app.state),
        name="pipeline",
    )
    tasks.append(pipeline_task)

    # Let pipeline initialize services before registering watchers
    await asyncio.sleep(2)

    # Register config hot-reload watchers
    whitelist = getattr(app.state, "whitelist", None)
    threshold_engine = getattr(app.state, "threshold_engine", None)

    if whitelist:
        config_watcher.register("whitelist", settings.WHITELIST_PATH, whitelist.async_reload)
    if threshold_engine:
        config_watcher.register("thresholds", settings.THRESHOLDS_PATH, lambda: _sync_reload(threshold_engine))

    config_task = asyncio.create_task(
        config_watcher.run(_shutdown_event),
        name="config_watcher",
    )
    tasks.append(config_task)

    # 2. Pruning scheduler
    pruning_task = asyncio.create_task(
        run_pruning_scheduler(_shutdown_event),
        name="pruner",
    )
    tasks.append(pruning_task)

    # 3. Health checker
    # Access services once pipeline has set them on app.state
    health_task = asyncio.create_task(
        run_health_checker(
            _shutdown_event,
            app.state,
            mikrotik=getattr(app.state, "mikrotik", None),
            ntopng=app.state.ntopng,
            deepseek=getattr(app.state, "deepseek", None),
            eve_tailer=getattr(app.state, "eve_tailer", None),
        ),
        name="health_checker",
    )
    tasks.append(health_task)

    logger.info("=== Startup complete — %d background tasks running ===", len(tasks))

    yield

    # ==================================================================
    # SHUTDOWN
    # ==================================================================
    logger.info("=== AI Shield Backend Shutting Down ===")
    _shutdown_event.set()

    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    logger.info("All background tasks cancelled")

    # Close external connections
    mikrotik = getattr(app.state, "mikrotik", None)
    if mikrotik:
        await mikrotik.close()
    ntopng = getattr(app.state, "ntopng", None)
    if ntopng:
        await ntopng.close()
    deepseek = getattr(app.state, "deepseek", None)
    if deepseek:
        await deepseek.close()

    await close_database()
    logger.info("=== Shutdown complete ===")


async def _sync_reload(engine) -> None:
    """Wrapper to call sync reload() on threshold engine."""
    engine.reload()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Shield",
        description="Headless Monitoring & Security Shield",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount all API routes under /api
    app.include_router(api_router)

    # Health endpoints (Section 20)
    @app.get("/health")
    async def health():
        """Full health check — all services."""
        state = app.state.health_state
        ok_count = sum(1 for s in state.values() if isinstance(s, dict) and s.get("ok"))
        total = len([s for s in state.values() if isinstance(s, dict)])
        overall = "healthy" if ok_count == total else ("degraded" if ok_count > 0 else "unhealthy")
        return {"status": overall, "services": state}

    @app.get("/health/live")
    async def health_live():
        """Liveness check — process and event loop functioning."""
        return {"status": "healthy"}

    @app.get("/health/ready")
    async def health_ready():
        """Readiness check — API can serve requests, DB is available."""
        state = app.state.health_state
        db_ok = state.get("database", {}).get("ok", False)
        return {
            "status": "healthy" if db_ok else "unhealthy",
            "database": db_ok,
        }

    @app.get("/health/dependencies")
    async def health_dependencies():
        """Dependency status — Suricata, DB, ntopng, MikroTik, DeepSeek, Telegram."""
        state = app.state.health_state
        return {"status": "degraded" if not all(
            state.get(s, {}).get("ok") for s in ["database"]
        ) else "healthy", "services": state}

    return app


app = create_app()
