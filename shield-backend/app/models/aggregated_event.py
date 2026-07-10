"""Aggregated event model — grouped by src_ip + event_type over a time window."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON
from app.models.base import Base


class AggregatedEvent(Base):
    __tablename__ = "aggregated_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    src_ip = Column(String(45), nullable=False, index=True)
    event_type = Column(String(64), nullable=True)
    alert_category = Column(String(128), nullable=True)
    count = Column(Integer, default=0)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    unique_targets = Column(Integer, default=0)
    unique_ports = Column(Integer, default=0)
    summary = Column(String(1024), nullable=True)
    processed = Column(Boolean, default=False)
    sample_events_json = Column(JSON, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
