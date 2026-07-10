"""Normalized internal schemas — frontend-agnostic data models.

The frontend should consume these normalized types, NOT raw ntopng,
MikroTik, or Suricata formats. Each integration module normalizes
its data into these schemas.
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class NormalizedHost:
    ip: str
    hostname: Optional[str] = None
    mac: Optional[str] = None
    vlan: Optional[int] = None
    rx_bytes: Optional[int] = None
    tx_bytes: Optional[int] = None
    total_bytes: Optional[int] = None
    active_flows: Optional[int] = None
    applications: list[str] = field(default_factory=list)
    risk_score: Optional[int] = None
    last_seen: Optional[str] = None
    source: str = "ntopng"
    raw: Optional[dict] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


@dataclass
class NormalizedInterface:
    name: str
    type: Optional[str] = None
    running: Optional[bool] = None
    disabled: Optional[bool] = None
    rx_bytes: Optional[int] = None
    tx_bytes: Optional[int] = None
    rx_packets: Optional[int] = None
    tx_packets: Optional[int] = None
    rx_rate_bps: Optional[int] = None
    tx_rate_bps: Optional[int] = None
    link_speed: Optional[str] = None
    mac_address: Optional[str] = None
    comment: Optional[str] = None
    source: str = "mikrotik"
    raw: Optional[dict] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


@dataclass
class NormalizedSecurityEvent:
    timestamp: str
    event_type: str
    src_ip: Optional[str] = None
    src_port: Optional[int] = None
    dest_ip: Optional[str] = None
    dest_port: Optional[int] = None
    proto: Optional[str] = None
    app_proto: Optional[str] = None
    severity: Optional[int] = None
    signature: Optional[str] = None
    category: Optional[str] = None
    flow_id: Optional[int] = None
    source: str = "suricata"
    raw: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


@dataclass
class NormalizedFlow:
    client_ip: Optional[str] = None
    client_port: Optional[int] = None
    server_ip: Optional[str] = None
    server_port: Optional[int] = None
    proto: Optional[str] = None
    application: Optional[str] = None
    bytes_sent: Optional[int] = None
    bytes_rcvd: Optional[int] = None
    packets: Optional[int] = None
    duration: Optional[int] = None
    throughput: Optional[int] = None
    risk_status: Optional[str] = None
    source: str = ""
    raw: Optional[dict] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
