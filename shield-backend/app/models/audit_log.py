"""Audit log entry model — records every mitigation decision."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, JSON
from app.models.base import Base


class AuditEntry(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    src_ip = Column(String(45), nullable=False, index=True)
    risk_score = Column(Integer, default=0)
    reason = Column(String(1024), nullable=True)
    dry_run = Column(Boolean, default=True)
    action = Column(String(64), nullable=True, index=True)
    result = Column(String(256), nullable=True)
    deepseek_latency_ms = Column(Float, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
