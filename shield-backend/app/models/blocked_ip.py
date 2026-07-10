"""Blocked IP history model."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from app.models.base import Base


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String(45), nullable=False, index=True)
    risk_score = Column(Integer, default=0)
    reason = Column(String(1024), nullable=True)
    action = Column(String(64), default="blocked")
    dry_run = Column(Boolean, default=True)
    mikrotik_result = Column(String(256), nullable=True)
    address_list = Column(String(128), default="ai_blacklist")
    ai_report_id = Column(
        Integer,
        ForeignKey("ai_threat_reports.id", ondelete="SET NULL"),
        nullable=True,
    )
    blocked_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    expires_at = Column(DateTime, nullable=True)
