"""Event bus for broadcasting realtime events to SSE subscribers."""

import asyncio
import json
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

MAX_QUEUE_SIZE = 500  # Per-subscriber cap


class EventBus:
    """Thread-safe event broadcaster.

    Services push events; SSE endpoints subscribe and receive them
    via asyncio.Queue. Subscribers with full queues are dropped (slow consumer).
    """

    def __init__(self, max_history: int = 50):
        self._subscribers: dict[int, asyncio.Queue] = {}
        self._sub_id_counter = 0
        self._lock = asyncio.Lock()
        self._history: deque = deque(maxlen=max_history)

    async def subscribe(self) -> tuple[int, asyncio.Queue]:
        """Register a new subscriber. Returns (subscriber_id, queue)."""
        async with self._lock:
            self._sub_id_counter += 1
            sub_id = self._sub_id_counter
            queue: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
            self._subscribers[sub_id] = queue

            # Replay recent history
            for event in self._history:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    break

            logger.debug("EventBus subscriber %d added (%d total)", sub_id, len(self._subscribers))
            return sub_id, queue

    async def unsubscribe(self, sub_id: int) -> None:
        """Remove a subscriber."""
        async with self._lock:
            self._subscribers.pop(sub_id, None)
            logger.debug("EventBus subscriber %d removed (%d remaining)", sub_id, len(self._subscribers))

    async def publish(self, event_type: str, data: dict[str, Any]) -> None:
        """Broadcast an event to all subscribers.

        Args:
            event_type: Category of event (e.g., 'alert', 'ai_decision', 'blocked_ip').
            data: Event payload dict.
        """
        event = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        event_json = json.dumps(event, default=str)

        # Store in history for replay to new subscribers
        self._history.append(event)

        # Broadcast to all subscribers
        async with self._lock:
            dead: list[int] = []
            for sub_id, queue in self._subscribers.items():
                try:
                    queue.put_nowait(event_json)
                except asyncio.QueueFull:
                    dead.append(sub_id)

            # Clean up dead subscribers
            for sub_id in dead:
                self._subscribers.pop(sub_id, None)

        if dead:
            logger.warning("Dropped %d slow SSE subscriber(s)", len(dead))

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


# Singleton instance
event_bus = EventBus()
