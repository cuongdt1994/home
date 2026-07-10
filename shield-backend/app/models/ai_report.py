"""AI threat report model — stores DeepSeek analysis results."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey, Text
from app.models.base import Base


class AIThreatReport(Base):
    __tablename__ = "ai_threat_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    aggregated_event_id = Column(
        Integer,
        ForeignKey("aggregated_events.id", ondelete="SET NULL"),
        nullable=True,
    )
    src_ip = Column(String(45), nullable=False, index=True)
    is_malicious = Column(Boolean, default=False, index=True)
    risk_score = Column(Integer, default=0, index=True)
    reason = Column(String(1024), nullable=True)
    action_taken = Column(String(64), default="allowed")
    raw_response = Column(Text, nullable=True)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
