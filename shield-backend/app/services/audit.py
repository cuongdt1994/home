"""Audit logger — writes structured JSON audit entries to file and database."""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import aiofiles

from app.config import settings

logger = logging.getLogger(__name__)


class AuditLogger:
    """Async audit logger that writes JSONL to file and optionally to DB.

    Every mitigation decision is recorded with timestamp, source IP,
    risk score, reason, action taken, and result.
    """

    def __init__(self, log_path: str = "", db_session_factory=None):
        self._log_path = log_path or settings.AUDIT_LOG_PATH
        self._db_factory = db_session_factory
        self._buffer: list[dict] = []
        self._lock = asyncio.Lock()
        self._flush_interval = 5.0
        self._running = False

    async def log_decision(
        self,
        src_ip: str,
        risk_score: int,
        reason: str,
        dry_run: bool,
        action: str,
        result: str = "success",
        deepseek_latency_ms: Optional[float] = None,
        details: Optional[dict] = None,
    ) -> None:
        """Record a mitigation decision to the audit log.

        Args:
            src_ip: Source IP address.
            risk_score: AI risk score (0-10).
            reason: Human-readable reason from AI.
            dry_run: Whether this was a dry run.
            action: Action type (e.g., 'mikrotik_address_list_add', 'would_block').
            result: Result of the action ('success', 'failed', 'skipped').
            deepseek_latency_ms: DeepSeek API latency in milliseconds.
            details: Additional structured details.
        """
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "src_ip": src_ip,
            "risk_score": risk_score,
            "reason": reason,
            "dry_run": dry_run,
            "action": action,
            "result": result,
            "deepseek_latency_ms": deepseek_latency_ms,
            "details": details or {},
        }

        async with self._lock:
            self._buffer.append(entry)

        # Write to file asynchronously
        await self._write_file(entry)

        # Write to database if configured
        await self._write_db(entry)

    async def _write_file(self, entry: dict) -> None:
        """Append a JSON line to the audit log file."""
        try:
            # Ensure directory exists
            log_dir = os.path.dirname(self._log_path)
            if log_dir:
                os.makedirs(log_dir, exist_ok=True)

            async with aiofiles.open(self._log_path, "a") as f:
                await f.write(json.dumps(entry, default=str) + "\n")
        except Exception:
            logger.exception("Failed to write audit entry to file")

    async def _write_db(self, entry: dict) -> None:
        """Write audit entry to the database (fire-and-forget)."""
        if self._db_factory is None:
            return
        try:
            from app.models.audit_log import AuditEntry

            async with self._db_factory() as session:
                db_entry = AuditEntry(
                    timestamp=datetime.now(timezone.utc),
                    src_ip=entry["src_ip"],
                    risk_score=entry["risk_score"],
                    reason=entry["reason"],
                    dry_run=entry["dry_run"],
                    action=entry["action"],
                    result=entry["result"],
                    deepseek_latency_ms=entry.get("deepseek_latency_ms"),
                    details=entry.get("details"),
                )
                session.add(db_entry)
                await session.commit()
        except Exception:
            logger.exception("Failed to write audit entry to database")

    def set_db_factory(self, factory) -> None:
        """Set the async session factory for DB writes."""
        self._db_factory = factory

    async def flush(self) -> None:
        """Flush any buffered entries (handled per-entry with file writes)."""
        pass  # We write per-entry, so flush is mostly a no-op
