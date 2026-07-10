"""Data retention pruning — periodic cleanup of old database records."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.config import settings
from app.database import async_session
from app.models.suricata_alert import SuricataAlert
from app.models.ai_report import AIThreatReport
from app.models.audit_log import AuditEntry
from app.models.aggregated_event import AggregatedEvent

logger = logging.getLogger(__name__)


async def run_pruning_scheduler(shutdown_event: asyncio.Event) -> None:
    """Run periodic data pruning based on retention settings.

    Runs immediately on start, then every PRUNE_INTERVAL_HOURS.

    Args:
        shutdown_event: Set to stop pruning.
    """
    interval = settings.PRUNE_INTERVAL_HOURS * 3600
    logger.info(
        "Pruner started (interval=%dh, alert_retention=%dd, ai_retention=%dd, audit_retention=%dd)",
        settings.PRUNE_INTERVAL_HOURS,
        settings.RETENTION_ALERT_DAYS,
        settings.RETENTION_AI_REPORT_DAYS,
        settings.RETENTION_AUDIT_DAYS,
    )

    while not shutdown_event.is_set():
        try:
            await prune_once()
        except Exception:
            logger.exception("Pruning cycle failed")

        # Sleep in chunks so we can respond to shutdown quickly
        for _ in range(int(interval)):
            if shutdown_event.is_set():
                break
            await asyncio.sleep(1)

    logger.info("Pruner stopped")


async def prune_once() -> dict:
    """Execute one pruning cycle. Returns counts of deleted records."""
    now = datetime.now(timezone.utc)
    results = {}

    try:
        async with async_session() as db:
            # Alerts: RETENTION_ALERT_DAYS
            alert_cutoff = now - timedelta(days=settings.RETENTION_ALERT_DAYS)
            alert_result = await db.execute(
                delete(SuricataAlert).where(SuricataAlert.timestamp < alert_cutoff)
            )
            results["alerts"] = alert_result.rowcount

            # AI reports: RETENTION_AI_REPORT_DAYS
            report_cutoff = now - timedelta(days=settings.RETENTION_AI_REPORT_DAYS)
            report_result = await db.execute(
                delete(AIThreatReport).where(AIThreatReport.created_at < report_cutoff)
            )
            results["ai_reports"] = report_result.rowcount

            # Audit logs: RETENTION_AUDIT_DAYS
            audit_cutoff = now - timedelta(days=settings.RETENTION_AUDIT_DAYS)
            audit_result = await db.execute(
                delete(AuditEntry).where(AuditEntry.timestamp < audit_cutoff)
            )
            results["audit_logs"] = audit_result.rowcount

            # Aggregated events: same as alerts
            agg_result = await db.execute(
                delete(AggregatedEvent).where(AggregatedEvent.created_at < alert_cutoff)
            )
            results["aggregated_events"] = agg_result.rowcount

            await db.commit()

        total = sum(results.values())
        if total > 0:
            logger.info("Pruned %d old records: %s", total, results)

    except Exception:
        logger.exception("Pruning query failed")
        raise

    return results
