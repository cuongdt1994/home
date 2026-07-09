"""SQLAlchemy async engine, session, and all ORM models."""

import os
from datetime import datetime

from sqlalchemy import (JSON, Boolean, Column, DateTime, Float, ForeignKey,
                        Integer, String, Text, create_engine, func)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session

from config import settings


class Base(DeclarativeBase):
    pass


# ── Models ──────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[str] = mapped_column(String, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String, default="alert")
    src_ip: Mapped[str] = mapped_column(String, nullable=False, index=True)
    src_port: Mapped[int | None] = mapped_column(Integer)
    dest_ip: Mapped[str] = mapped_column(String, nullable=False, index=True)
    dest_port: Mapped[int | None] = mapped_column(Integer)
    proto: Mapped[str | None] = mapped_column(String)
    alert_signature: Mapped[str | None] = mapped_column(String)
    alert_category: Mapped[str | None] = mapped_column(String)
    alert_severity: Mapped[int] = mapped_column(Integer, default=3, index=True)
    alert_action: Mapped[str | None] = mapped_column(String)
    raw_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="alert", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ip_address: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    mac_address: Mapped[str | None] = mapped_column(String)
    hostname: Mapped[str | None] = mapped_column(String)
    vendor: Mapped[str | None] = mapped_column(String)
    device_type: Mapped[str] = mapped_column(String, default="unknown")
    first_seen: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    last_seen: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)


class TrafficStat(Base):
    __tablename__ = "traffic_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat(), index=True)
    interface_name: Mapped[str] = mapped_column(String, default="eth0")
    bytes_in: Mapped[int] = mapped_column(Integer, default=0)
    bytes_out: Mapped[int] = mapped_column(Integer, default=0)
    packets_in: Mapped[int] = mapped_column(Integer, default=0)
    packets_out: Mapped[int] = mapped_column(Integer, default=0)
    active_hosts: Mapped[int] = mapped_column(Integer, default=0)
    active_flows: Mapped[int] = mapped_column(Integer, default=0)


class HostTrafficStat(Base):
    __tablename__ = "host_traffic_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat(), index=True)
    ip: Mapped[str] = mapped_column(String, nullable=False, index=True)
    bytes_sent: Mapped[int] = mapped_column(Integer, default=0)
    bytes_rcvd: Mapped[int] = mapped_column(Integer, default=0)
    num_flows: Mapped[int] = mapped_column(Integer, default=0)


class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mikrotik_id: Mapped[str | None] = mapped_column(String, index=True)
    chain: Mapped[str] = mapped_column(String, default="forward")
    action: Mapped[str] = mapped_column(String, default="drop")
    src_ip: Mapped[str | None] = mapped_column(String, index=True)
    dest_ip: Mapped[str | None] = mapped_column(String)
    protocol: Mapped[str | None] = mapped_column(String)
    dst_port: Mapped[int | None] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(String)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String, default="manual")
    created_by_analysis_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("analyses.id"), nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    expires_at: Mapped[str | None] = mapped_column(String, nullable=True)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[int] = mapped_column(Integer, ForeignKey("alerts.id"), nullable=False)
    decision: Mapped[str] = mapped_column(String, default="flag")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    reasoning: Mapped[str | None] = mapped_column(Text)
    suggested_block_timeout_hours: Mapped[int] = mapped_column(Integer, default=24)
    block_scope: Mapped[str] = mapped_column(String, default="src_ip")
    full_response: Mapped[str | None] = mapped_column(Text)
    model_used: Mapped[str | None] = mapped_column(String)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    analyzed_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat(), index=True)

    alert: Mapped["Alert"] = relationship(back_populates="analyses")
    firewall_rules: Mapped[list["FirewallRule"]] = relationship(back_populates="analysis_rel")


FirewallRule.analysis_rel = relationship("Analysis", back_populates="firewall_rules")


class BlockEvent(Base):
    __tablename__ = "block_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("analyses.id"), nullable=True)
    firewall_rule_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("firewall_rules.id"), nullable=True)
    target_ip: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, default="block")
    triggered_by: Mapped[str] = mapped_column(String, default="ai")
    comment: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat(), index=True)


# ── Engine & Session ────────────────────────────────────

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        os.makedirs("data", exist_ok=True)
        _engine = create_engine(
            settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///"),
            echo=settings.debug,
        )
    return _engine


def get_session() -> Session:
    from sqlalchemy.orm import Session as SyncSession
    return SyncSession(get_engine())


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=get_engine())
