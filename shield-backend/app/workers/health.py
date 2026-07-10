"""Periodic health check collector — probes all external services."""

import asyncio
import logging

logger = logging.getLogger(__name__)

HEALTH_CHECK_INTERVAL = 30  # seconds


async def run_health_checker(
    shutdown_event: asyncio.Event,
    app_state,
    mikrotik,
    ntopng,
    deepseek,
    eve_tailer,
) -> None:
    """Periodically probe all external services and update app.state.health_state.

    Args:
        shutdown_event: Set to stop checking.
        app_state: FastAPI app.state with health_state dict.
        mikrotik: MikroTikExecutor instance.
        ntopng: NtopngClient instance.
        deepseek: DeepSeekClient instance.
        eve_tailer: EveTailer instance.
    """
    logger.info("Health checker started (interval=%ds)", HEALTH_CHECK_INTERVAL)

    while not shutdown_event.is_set():
        try:
            # Database (always ok if we're running)
            app_state.health_state["database"] = {"ok": True}

            # MikroTik SSH
            if mikrotik:
                ok, latency = await mikrotik.ping()
                app_state.health_state["mikrotik_ssh"] = {"ok": ok, "latency_ms": latency}

            # ntopng
            if ntopng:
                ok, latency = await ntopng.ping()
                app_state.health_state["ntopng"] = {"ok": ok, "latency_ms": latency}

            # DeepSeek
            if deepseek:
                ok, latency = await deepseek.ping()
                app_state.health_state["deepseek"] = {"ok": ok, "latency_ms": latency}

            # Eve tailer
            if eve_tailer:
                last_event = eve_tailer.last_event_at
                app_state.health_state["eve_tailer"] = {
                    "ok": eve_tailer._running if hasattr(eve_tailer, '_running') else True,
                    "last_event_at": last_event.isoformat() if last_event else None,
                }

        except Exception:
            logger.exception("Health check cycle failed")

        # Sleep in 1s chunks for responsive shutdown
        for _ in range(HEALTH_CHECK_INTERVAL):
            if shutdown_event.is_set():
                break
            await asyncio.sleep(1)

    logger.info("Health checker stopped")
