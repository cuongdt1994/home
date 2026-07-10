"""Suricata event normalizer — converts raw eve.json dicts to structured events.

Supports all common Suricata event types: alert, dns, http, tls, ssh,
flow, stats, anomaly, fileinfo.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class NormalizedEvent:
    """Clean, typed representation of a Suricata event."""
    timestamp: datetime
    src_ip: str
    src_port: Optional[int]
    dest_ip: Optional[str]
    dest_port: Optional[int]
    proto: Optional[str]
    app_proto: Optional[str]
    event_type: str
    alert_category: Optional[str]
    alert_severity: Optional[int]
    alert_signature: Optional[str]
    signature_id: Optional[int]
    action: Optional[str]
    flow_id: Optional[int]
    in_iface: Optional[str]
    # Extended fields for non-alert event types
    dns_query: Optional[str] = None
    dns_type: Optional[str] = None
    dns_rcode: Optional[str] = None
    http_host: Optional[str] = None
    http_url: Optional[str] = None
    http_method: Optional[str] = None
    http_status: Optional[int] = None
    tls_sni: Optional[str] = None
    tls_version: Optional[str] = None
    tls_issuerdn: Optional[str] = None
    ssh_client_software: Optional[str] = None
    ssh_server_software: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_md5: Optional[str] = None
    stats_data: Optional[dict] = None
    anomaly_type: Optional[str] = None
    raw: dict = field(default_factory=dict, repr=False)

    @property
    def summary(self) -> str:
        """Human-readable one-line summary."""
        if self.event_type == "alert":
            sig = self.alert_signature or "Unknown signature"
            return f"[alert] {self.src_ip} -> {self.dest_ip}: {sig}"
        elif self.event_type == "dns":
            return f"[dns] {self.src_ip} queried {self.dns_query} ({self.dns_type})"
        elif self.event_type == "http":
            return f"[http] {self.src_ip} -> {self.http_host}{self.http_url}"
        elif self.event_type == "tls":
            return f"[tls] {self.src_ip} -> {self.tls_sni}"
        elif self.event_type == "ssh":
            return f"[ssh] {self.src_ip}: {self.ssh_client_software or 'SSH connection'}"
        elif self.event_type == "flow":
            return f"[flow] {self.src_ip}:{self.src_port} -> {self.dest_ip}:{self.dest_port} ({self.proto})"
        elif self.event_type == "fileinfo":
            return f"[fileinfo] {self.file_name} ({self.file_size}b)"
        elif self.event_type == "anomaly":
            return f"[anomaly] {self.anomaly_type} from {self.src_ip}"
        return f"[{self.event_type}] {self.src_ip} -> {self.dest_ip}"


class Normalizer:
    """Parses raw Suricata eve.json events into NormalizedEvent objects.

    Handles: alert, dns, http, tls, ssh, flow, stats, anomaly, fileinfo.
    """

    SEVERITY_MAP = {1: "critical", 2: "high", 3: "medium", 4: "low"}

    def normalize(self, raw: dict) -> Optional[NormalizedEvent]:
        """Parse a raw eve.json dict into a NormalizedEvent.

        Returns None if the event doesn't have enough data to be useful.
        """
        try:
            event_type = raw.get("event_type", "unknown")
            src_ip = raw.get("src_ip", "")
            dest_ip = raw.get("dest_ip", "")

            # For stats events, we may not have src_ip — still process
            if event_type == "stats":
                return self._normalize_stats(raw)

            # Skip events with missing source IP (except stats)
            if not src_ip:
                return None

            # Parse timestamp
            timestamp = self._parse_timestamp(raw.get("timestamp", ""))

            # Alert-specific fields
            alert = raw.get("alert", {})

            # Common base fields
            base = NormalizedEvent(
                timestamp=timestamp,
                src_ip=src_ip,
                src_port=raw.get("src_port"),
                dest_ip=dest_ip or None,
                dest_port=raw.get("dest_port"),
                proto=raw.get("proto"),
                app_proto=raw.get("app_proto"),
                event_type=event_type,
                alert_category=alert.get("category"),
                alert_severity=alert.get("severity"),
                alert_signature=alert.get("signature"),
                signature_id=alert.get("signature_id"),
                action=alert.get("action"),
                flow_id=raw.get("flow_id"),
                in_iface=raw.get("in_iface"),
                raw=raw,
            )

            # Enrich with event-type-specific fields
            self._enrich_dns(base, raw)
            self._enrich_http(base, raw)
            self._enrich_tls(base, raw)
            self._enrich_ssh(base, raw)
            self._enrich_flow(base, raw)
            self._enrich_fileinfo(base, raw)
            self._enrich_anomaly(base, raw)

            return base

        except Exception:
            logger.exception("Failed to normalize event")
            return None

    # --- Event-type enrichment ---

    def _enrich_dns(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "dns":
            return
        dns = raw.get("dns", {})
        event.dns_query = dns.get("query") or (dns.get("rrname") if isinstance(dns.get("rrname"), str) else None)
        event.dns_type = dns.get("type") or dns.get("rrtype")
        event.dns_rcode = dns.get("rcode")

    def _enrich_http(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "http":
            return
        http = raw.get("http", {})
        event.http_host = http.get("hostname") or http.get("host")
        event.http_url = http.get("url")
        event.http_method = http.get("http_method") or http.get("method")
        event.http_status = http.get("status")

    def _enrich_tls(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "tls":
            return
        tls = raw.get("tls", {})
        event.tls_sni = tls.get("sni")
        event.tls_version = tls.get("version")
        event.tls_issuerdn = tls.get("issuerdn")

    def _enrich_ssh(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "ssh":
            return
        ssh = raw.get("ssh", {})
        event.ssh_client_software = ssh.get("client", {}).get("software_version") if isinstance(ssh.get("client"), dict) else None
        event.ssh_server_software = ssh.get("server", {}).get("software_version") if isinstance(ssh.get("server"), dict) else None

    def _enrich_flow(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "flow":
            return
        flow = raw.get("flow", {})
        event.dest_ip = event.dest_ip or flow.get("dest_ip")
        event.dest_port = event.dest_port or flow.get("dest_port")
        event.src_port = event.src_port or flow.get("src_port")

    def _enrich_fileinfo(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "fileinfo":
            return
        fi = raw.get("fileinfo", {})
        event.file_name = fi.get("filename")
        event.file_size = fi.get("size")
        event.file_md5 = fi.get("md5")

    def _enrich_anomaly(self, event: NormalizedEvent, raw: dict) -> None:
        if event.event_type != "anomaly":
            return
        anomaly = raw.get("anomaly", {})
        event.anomaly_type = anomaly.get("type") or anomaly.get("code")

    def _normalize_stats(self, raw: dict) -> Optional[NormalizedEvent]:
        """Handle Suricata stats events (global counters, no src_ip)."""
        stats = raw.get("stats", {})
        ts = self._parse_timestamp(raw.get("timestamp", ""))
        return NormalizedEvent(
            timestamp=ts,
            src_ip="0.0.0.0",  # Stats are global
            src_port=None,
            dest_ip=None,
            dest_port=None,
            proto=None,
            app_proto=None,
            event_type="stats",
            alert_category=None,
            alert_severity=None,
            alert_signature=None,
            signature_id=None,
            action=None,
            flow_id=None,
            in_iface=None,
            stats_data=stats,
            raw=raw,
        )

    @staticmethod
    def _parse_timestamp(ts_str: str) -> datetime:
        """Parse Suricata timestamp to datetime, falling back to now."""
        if not ts_str:
            return datetime.now(timezone.utc)
        try:
            ts_clean = ts_str[:26] + ts_str[27:30]
            return datetime.strptime(ts_clean, "%Y-%m-%dT%H:%M:%S.%f%z")
        except (ValueError, IndexError):
            try:
                return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                return datetime.now(timezone.utc)
