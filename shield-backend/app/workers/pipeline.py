"""Main event processing pipeline — wires all stages together.

The pipeline topology:
  eve.json → tailer → normalizer → whitelist → aggregator → threshold
  → DeepSeek → risk check → dry-run gate → MikroTik → audit → Telegram
"""

import asyncio
import logging
from typing import Optional

from app.config import settings
from app.services.aggregator import AggregatedEvent, AggregationEngine
from app.services.audit import AuditLogger
from app.services.deepseek import DeepSeekClient, SAFE_DECISION
from app.services.event_bus import event_bus
from app.services.eve_tailer import EveTailer
from app.services.mikrotik import MikroTikExecutor
from app.services.mitigation import MitigationOrchestrator
from app.services.normalizer import Normalizer
from app.services.telegram import TelegramNotifier
from app.services.threshold import ThresholdEngine
from app.services.whitelist import WhitelistEngine
from app.database import async_session
from app.models.aggregated_event import AggregatedEvent as AggregatedEventModel
from app.models.ai_report import AIThreatReport
from app.models.blocked_ip import BlockedIP
from app.models.suricata_alert import SuricataAlert

logger = logging.getLogger(__name__)

# Queue sizes (bounded for backpressure)
RAW_QUEUE_SIZE = 1000
NORM_QUEUE_SIZE = 500
ANALYSIS_QUEUE_SIZE = 50


async def run_pipeline(shutdown_event: asyncio.Event, app_state) -> None:
    """Start and run the full event processing pipeline.

    This is the central nervous system. It creates all queues, spawns
    stage workers, and runs them until shutdown is signaled.

    Args:
        shutdown_event: Set to trigger graceful shutdown.
        app_state: FastAPI app.state with service references.
    """
    logger.info("Pipeline starting (DRY_RUN=%s)", settings.DRY_RUN)

    # --- Queues ---
    raw_queue: asyncio.Queue = asyncio.Queue(maxsize=RAW_QUEUE_SIZE)
    norm_queue: asyncio.Queue = asyncio.Queue(maxsize=NORM_QUEUE_SIZE)
    analysis_queue: asyncio.Queue = asyncio.Queue(maxsize=ANALYSIS_QUEUE_SIZE)

    # --- Services ---
    tailer = EveTailer(settings.EVE_JSON_PATH)
    normalizer = Normalizer()
    whitelist = WhitelistEngine(settings.WHITELIST_PATH, settings.WHITELIST_CIDRS)
    threshold_engine = ThresholdEngine(settings.THRESHOLDS_PATH)
    aggregator = AggregationEngine(threshold_engine, analysis_queue)
    deepseek = DeepSeekClient()
    mikrotik = MikroTikExecutor()
    telegram = TelegramNotifier()
    audit = AuditLogger(settings.AUDIT_LOG_PATH, async_session)
    mitigator = MitigationOrchestrator(whitelist, mikrotik, audit, telegram)

    # Store in app state for API access
    app_state.whitelist = whitelist
    app_state.threshold_engine = threshold_engine
    app_state.mikrotik = mikrotik
    # app_state.ntopng is already set by main.py lifespan — don't overwrite
    app_state.deepseek = deepseek
    app_state.eve_tailer = tailer
    app_state.audit = audit

    # --- Stage workers ---
    async def tailer_worker():
        """Stage 0: Read eve.json → raw_queue."""
        try:
            async for raw in tailer.tail(shutdown_event):
                await raw_queue.put(raw)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Tailer worker crashed")

    async def normalizer_worker():
        """Stage 1: Parse raw JSON → save to DB → normalize → norm_queue."""
        while not shutdown_event.is_set():
            try:
                raw = await asyncio.wait_for(raw_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            try:
                event = normalizer.normalize(raw)
                if event is None:
                    raw_queue.task_done()
                    continue

                # Save to DB
                await _save_alert(event)
                await event_bus.publish("new_alert", {
                    "src_ip": event.src_ip, "dest_ip": event.dest_ip,
                    "event_type": event.event_type, "signature": event.alert_signature,
                    "severity": event.alert_severity, "category": event.alert_category,
                })

                # Whitelist check (early drop)
                if whitelist.is_whitelisted(event.src_ip):
                    logger.debug("Skipping whitelisted IP: %s", event.src_ip)
                    raw_queue.task_done()
                    continue

                await norm_queue.put(event)
                raw_queue.task_done()
            except Exception:
                logger.exception("Normalizer error")
                raw_queue.task_done()

    async def aggregator_worker():
        """Stage 2: Aggregate → check thresholds → emit to analysis_queue."""
        # Run periodic sweep in background
        sweep_task = asyncio.create_task(aggregator.run(shutdown_event))

        while not shutdown_event.is_set():
            try:
                event = await asyncio.wait_for(norm_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            try:
                aggregated = await aggregator.add_event(event)
                if aggregated:
                    await _save_aggregated_event(aggregated)
                    # Already put on analysis_queue by aggregator
                norm_queue.task_done()
            except Exception:
                logger.exception("Aggregator error")
                norm_queue.task_done()

        await sweep_task

    async def ai_worker():
        """Stage 3: DeepSeek analysis → mitigate → persist."""
        while not shutdown_event.is_set():
            try:
                aggregated = await asyncio.wait_for(analysis_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            try:
                # AI analysis
                decision = await deepseek.analyze(aggregated.summary or aggregated.to_summary_text())

                # Save AI report
                await _save_ai_report(aggregated, decision, deepseek.last_latency_ms)
                await event_bus.publish("ai_decision", {
                    "src_ip": aggregated.src_ip, "is_malicious": decision.is_malicious,
                    "risk_score": decision.risk_score, "reason": decision.reason,
                })

                # Risk score check
                if not decision.is_malicious or decision.risk_score < settings.AI_BLOCK_RISK_SCORE:
                    analysis_queue.task_done()
                    continue

                # Mitigate (whitelist override → dry-run → block → audit → notify)
                result = await mitigator.handle(aggregated, decision)

                # Save blocked IP record
                await _save_blocked_ip(aggregated, decision, result)
                await event_bus.publish("blocked_ip", {
                    "ip_address": aggregated.src_ip, "risk_score": decision.risk_score,
                    "reason": decision.reason, "dry_run": settings.DRY_RUN,
                    "action": result.get("action", "blocked"),
                })

                analysis_queue.task_done()
            except Exception:
                logger.exception("AI worker error")
                analysis_queue.task_done()

    # --- Spawn all workers ---
    workers = [
        asyncio.create_task(tailer_worker(), name="tailer"),
        asyncio.create_task(normalizer_worker(), name="normalizer"),
        asyncio.create_task(aggregator_worker(), name="aggregator"),
        asyncio.create_task(ai_worker(), name="ai_worker"),
    ]

    logger.info("Pipeline running — %d workers", len(workers))

    # Wait for shutdown
    await shutdown_event.wait()
    logger.info("Pipeline shutting down...")

    tailer.stop()
    aggregator.stop()

    for w in workers:
        w.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

    await deepseek.close()
    await mikrotik.close()
    await telegram.close()

    logger.info("Pipeline stopped")


# ------------------------------------------------------------------
# DB persistence helpers
# ------------------------------------------------------------------

async def _save_alert(event) -> None:
    try:
        async with async_session() as db:
            alert = SuricataAlert(
                timestamp=event.timestamp,
                src_ip=event.src_ip,
                src_port=event.src_port,
                dest_ip=event.dest_ip,
                dest_port=event.dest_port,
                proto=event.proto,
                event_type=event.event_type,
                alert_category=event.alert_category,
                alert_severity=event.alert_severity,
                alert_signature=event.alert_signature,
                raw_json=event.raw,
            )
            db.add(alert)
            await db.commit()
    except Exception:
        logger.exception("Failed to save alert to DB")


async def _save_aggregated_event(agg: AggregatedEvent) -> None:
    try:
        async with async_session() as db:
            model = AggregatedEventModel(
                src_ip=agg.src_ip,
                event_type=agg.event_type,
                alert_category=agg.alert_category,
                count=agg.count,
                window_start=agg.window_start,
                window_end=agg.window_end,
                unique_targets=agg.unique_targets,
                unique_ports=agg.unique_ports,
                summary=agg.summary,
                sample_events_json=agg.sample_events,
            )
            db.add(model)
            await db.commit()
    except Exception:
        logger.exception("Failed to save aggregated event to DB")


async def _save_ai_report(agg: AggregatedEvent, decision, latency_ms: float | None = None) -> None:
    try:
        async with async_session() as db:
            report = AIThreatReport(
                src_ip=agg.src_ip,
                is_malicious=decision.is_malicious,
                risk_score=decision.risk_score,
                reason=decision.reason,
                action_taken="allowed" if not decision.is_malicious else "analyzed",
                latency_ms=latency_ms,
            )
            db.add(report)
            await db.commit()
    except Exception:
        logger.exception("Failed to save AI report to DB")


async def _save_blocked_ip(agg: AggregatedEvent, decision, result: dict) -> None:
    try:
        from datetime import datetime, timedelta, timezone

        timeout_str = settings.MIKROTIK_BLACKLIST_TIMEOUT  # e.g. "7d"
        days = int("".join(c for c in timeout_str if c.isdigit()) or 7)
        expires = datetime.now(timezone.utc) + timedelta(days=days)

        async with async_session() as db:
            blocked = BlockedIP(
                ip_address=agg.src_ip,
                risk_score=decision.risk_score,
                reason=decision.reason,
                action=result.get("action", "blocked"),
                dry_run=settings.DRY_RUN,
                mikrotik_result=result.get("output", ""),
                address_list="ai_blacklist",
                expires_at=expires,
            )
            db.add(blocked)
            await db.commit()
    except Exception:
        logger.exception("Failed to save blocked IP to DB")
