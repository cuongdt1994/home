"""Suricata IDS/IPS integration - tail eve.json via SSH."""

import asyncio
import json
import logging
from datetime import datetime

from database import Alert, get_session
from services.ssh_client import get_suricata_client

logger = logging.getLogger(__name__)


class SuricataService:
    """Tail suricata eve.json via SSH and broadcast alerts."""

    def __init__(self):
        self._running = False
        self._offset = 0
        self._ws_manager = None

    def set_ws_manager(self, manager):
        self._ws_manager = manager

    async def get_recent_alerts(self, limit: int = 100) -> list[dict]:
        """Fetch recent alerts from remote via SSH."""
        client = get_suricata_client()
        raw = await client.execute(f"tail -n {limit} /var/log/suricata/eve.json 2>/dev/null || echo '[]'")
        alerts = []
        for line in raw.strip().split("\n"):
            try:
                data = json.loads(line)
                if data.get("event_type") == "alert":
                    alerts.append(self._parse_alert(data))
            except json.JSONDecodeError:
                continue
        return alerts[-limit:]

    async def get_alert_stats(self) -> dict:
        """Get alert statistics from the database."""
        session = get_session()
        try:
            from sqlalchemy import func
            total = session.query(func.count(Alert.id)).scalar() or 0
            critical = session.query(func.count(Alert.id)).filter(Alert.alert_severity == 1).scalar() or 0
            high = session.query(func.count(Alert.id)).filter(Alert.alert_severity == 2).scalar() or 0
            medium = session.query(func.count(Alert.id)).filter(Alert.alert_severity == 3).scalar() or 0

            # Last 24h
            since = datetime.utcnow().isoformat()[:10]  # today
            today_total = session.query(func.count(Alert.id)).filter(
                Alert.timestamp >= since
            ).scalar() or 0

            return {
                "total_alerts": total,
                "critical": critical,
                "high": high,
                "medium": medium,
                "today": today_total,
            }
        finally:
            session.close()

    async def run_watcher(self):
        """Background task: tail eve.json and process new alerts."""
        self._running = True
        client = get_suricata_client()

        # Start from end of file
        size = await client.get_file_size("/var/log/suricata/eve.json")
        self._offset = size
        logger.info(f"Suricata watcher started at offset {self._offset}")

        consecutive_errors = 0
        while self._running:
            try:
                content, new_size = await client.read_file_offset(
                    "/var/log/suricata/eve.json", self._offset
                )
                if new_size > self._offset:
                    self._offset = new_size
                    consecutive_errors = 0
                    for line in content.strip().split("\n"):
                        await self._process_line(line)
                elif new_size < self._offset:
                    # File rotated
                    logger.info("eve.json rotated, resetting offset")
                    self._offset = 0

                await asyncio.sleep(1)
            except Exception as e:
                consecutive_errors += 1
                logger.error(f"Suricata watcher error (#{consecutive_errors}): {e}")
                if consecutive_errors > 10:
                    logger.warning("Too many errors, waiting 30s...")
                    await asyncio.sleep(30)
                    consecutive_errors = 0
                await asyncio.sleep(2)

    async def _process_line(self, line: str):
        """Parse a single eve.json line, persist, and broadcast."""
        line = line.strip()
        if not line:
            return
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            return

        if data.get("event_type") != "alert":
            return

        parsed = self._parse_alert(data)

        # Persist to DB
        session = get_session()
        try:
            alert = Alert(**parsed)
            session.add(alert)
            session.commit()
            parsed["id"] = alert.id
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to save alert: {e}")
            return
        finally:
            session.close()

        # Broadcast via WebSocket
        if self._ws_manager:
            await self._ws_manager.broadcast({
                "type": "alert",
                "payload": parsed,
                "timestamp": datetime.utcnow().isoformat(),
            })

    def _parse_alert(self, data: dict) -> dict:
        """Extract relevant fields from an eve.json alert entry."""
        alert_info = data.get("alert", {})
        return {
            "timestamp": data.get("timestamp", ""),
            "event_type": data.get("event_type", "alert"),
            "src_ip": data.get("src_ip", ""),
            "src_port": data.get("src_port"),
            "dest_ip": data.get("dest_ip", ""),
            "dest_port": data.get("dest_port"),
            "proto": data.get("proto", ""),
            "alert_signature": alert_info.get("signature", ""),
            "alert_category": alert_info.get("category", ""),
            "alert_severity": alert_info.get("severity", 3),
            "alert_action": alert_info.get("action", ""),
            "raw_json": json.dumps(data),
        }

    def stop(self):
        self._running = False


# Singleton
suricata_service = SuricataService()
