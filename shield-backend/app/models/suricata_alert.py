"""Parsed Suricata alert model."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy import Index
from app.models.base import Base


class SuricataAlert(Base):
    __tablename__ = "suricata_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    src_ip = Column(String(45), nullable=False, index=True)
    src_port = Column(Integer, nullable=True)
    dest_ip = Column(String(45), nullable=True, index=True)
    dest_port = Column(Integer, nullable=True)
    proto = Column(String(16), nullable=True)
    event_type = Column(String(64), nullable=True, index=True)
    alert_category = Column(String(128), nullable=True)
    alert_severity = Column(Integer, nullable=True)
    alert_signature = Column(String(512), nullable=True)
    raw_json = Column(JSON, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_alerts_src_ip_timestamp", "src_ip", "timestamp"),
    )
