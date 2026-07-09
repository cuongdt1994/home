"""WebSocket connection manager for real-time event broadcasting."""

import asyncio
import json
import logging
from datetime import datetime

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts events."""

    def __init__(self):
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
        logger.info(f"WebSocket connected (total: {len(self._connections)})")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self._connections:
                self._connections.remove(ws)
        logger.info(f"WebSocket disconnected (total: {len(self._connections)})")

    async def broadcast(self, message: dict):
        """Send a message to all connected WebSocket clients."""
        if not self._connections:
            return

        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()

        dead: list[WebSocket] = []
        async with self._lock:
            for ws in self._connections:
                try:
                    await ws.send_text(json.dumps(message, default=str))
                except Exception:
                    dead.append(ws)

            for ws in dead:
                if ws in self._connections:
                    self._connections.remove(ws)

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Singleton
ws_manager = ConnectionManager()
