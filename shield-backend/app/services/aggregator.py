"""In-memory alert aggregation engine."""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.services.normalizer import NormalizedEvent
from app.services.threshold import ThresholdEngine

logger = logging.getLogger(__name__)


@dataclass
class AggregatedEvent:
    """An aggregated summary of events sharing src_ip + event_type in a time window."""
    src_ip: str
    event_type: str
    alert_category: Optional[str]
    count: int
    window_start: datetime
    window_end: datetime
    unique_targets: int
    unique_ports: int
    summary: str
    sample_events: list[dict] = field(default_factory=list)

    def to_summary_text(self) -> str:
        """Generate a human-readable summary for AI analysis."""
        return (
            f"{self.count} {self.event_type} alerts from {self.src_ip} "
            f"({self.alert_category or 'unknown category'}) "
            f"against {self.unique_targets} target(s) on {self.unique_ports} unique port(s) "
            f"between {self.window_start.isoformat()} and {self.window_end.isoformat()}"
        )


@dataclass
class AggregationBucket:
    """In-memory bucket tracking events for a (src_ip, event_type) pair."""
    src_ip: str
    event_type: str
    alert_category: Optional[str]
    count: int = 0
    window_start: float = 0.0
    window_seconds: int = 300  # Per-rule window, set on first event
    unique_targets: set[str] = field(default_factory=set)
    unique_ports: set[int] = field(default_factory=set)
    sample_events: list[dict] = field(default_factory=list)
    max_samples: int = 10

    def add(self, event: NormalizedEvent) -> None:
        """Add an event to this bucket."""
        if self.window_start == 0.0:
            self.window_start = time.monotonic()
        self.count += 1
        if event.dest_ip:
            self.unique_targets.add(event.dest_ip)
        if event.dest_port:
            self.unique_ports.add(event.dest_port)
        if len(self.sample_events) < self.max_samples:
            self.sample_events.append(event.raw)

    def to_aggregated(self, window_duration: float) -> AggregatedEvent:
        """Convert bucket to an AggregatedEvent."""
        now = datetime.now(timezone.utc)
        window_start_dt = datetime.fromtimestamp(self.window_start, tz=timezone.utc)
        return AggregatedEvent(
            src_ip=self.src_ip,
            event_type=self.event_type,
            alert_category=self.alert_category,
            count=self.count,
            window_start=window_start_dt,
            window_end=now,
            unique_targets=len(self.unique_targets),
            unique_ports=len(self.unique_ports),
            summary="",
            sample_events=list(self.sample_events),
        )

    def reset(self) -> None:
        """Reset bucket for the next window."""
        self.count = 0
        self.window_start = time.time()
        self.unique_targets.clear()
        self.unique_ports.clear()
        self.sample_events.clear()


class AggregationEngine:
    """Time-windowed in-memory aggregation for Suricata alerts.

    Buckets events by (src_ip, event_type). Each bucket is swept when its
    window closes or when a threshold rule is exceeded mid-window.
    Emits AggregatedEvent objects to an asyncio.Queue for downstream processing.
    """

    def __init__(
        self,
        threshold_engine: ThresholdEngine,
        output_queue: asyncio.Queue,
        sweep_interval: float = 10.0,
    ):
        self._thresholds = threshold_engine
        self._output = output_queue
        self._sweep_interval = sweep_interval
        self._buckets: dict[tuple, AggregationBucket] = {}
        self._running = False

    def _bucket_key(self, event: NormalizedEvent) -> tuple:
        """Create a bucket key from event attributes."""
        return (event.src_ip, event.event_type)

    async def add_event(self, event: NormalizedEvent) -> Optional[AggregatedEvent]:
        """Process a single normalized event into the aggregation engine.

        Returns an AggregatedEvent if a threshold was triggered, None otherwise.
        """
        key = self._bucket_key(event)
        bucket = self._buckets.get(key)

        window = self._thresholds.get_window_for_event(event)

        if bucket is None:
            window = self._thresholds.get_window_for_event(event)
            bucket = AggregationBucket(
                src_ip=event.src_ip,
                event_type=event.event_type,
                alert_category=event.alert_category,
                window_seconds=window,
            )
            self._buckets[key] = bucket

        bucket.add(event)

        # Check if this bucket now exceeds a threshold
        exceeded, rule_name = self._thresholds.evaluate(
            count=bucket.count,
            unique_ports=len(bucket.unique_ports),
            event=event,
        )

        if exceeded:
            aggregated = bucket.to_aggregated(window)
            aggregated.summary = aggregated.to_summary_text()
            logger.info(
                "Threshold '%s' exceeded: %s (%d events, %d ports)",
                rule_name, key, bucket.count, len(bucket.unique_ports),
            )
            bucket.reset()
            # Put on output queue so AI worker receives it
            try:
                self._output.put_nowait(aggregated)
            except asyncio.QueueFull:
                logger.warning("Output queue full — dropping aggregated event for %s", key)
            return aggregated

        return None

    async def sweep_expired(self) -> list[AggregatedEvent]:
        """Sweep all buckets and emit those with expired windows.

        Called periodically. Uses per-bucket window_seconds.
        Empty buckets older than 2x their window are pruned.
        """
        now = time.monotonic()
        emitted: list[AggregatedEvent] = []
        stale_keys: list[tuple] = []

        for key, bucket in list(self._buckets.items()):
            age = now - bucket.window_start
            window = bucket.window_seconds

            if bucket.count == 0 and age > window * 2:
                stale_keys.append(key)
                continue

            if bucket.count > 0 and age >= window:
                aggregated = bucket.to_aggregated(window)
                aggregated.summary = aggregated.to_summary_text()
                emitted.append(aggregated)
                bucket.reset()

        for key in stale_keys:
            del self._buckets[key]

        if stale_keys:
            logger.debug("Pruned %d stale buckets", len(stale_keys))

        return emitted

    async def run(self, shutdown_event: asyncio.Event) -> None:
        """Run periodic sweep loop.

        Args:
            shutdown_event: Set to stop sweeping.
        """
        self._running = True
        logger.info("Aggregator sweep started (interval=%ds)", self._sweep_interval)

        while self._running and not shutdown_event.is_set():
            try:
                await asyncio.sleep(self._sweep_interval)
                expired = await self.sweep_expired()
                for agg in expired:
                    try:
                        self._output.put_nowait(agg)
                    except asyncio.QueueFull:
                        logger.warning("Output queue full — dropping aggregated event for %s", agg.src_ip)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Aggregator sweep error")

        self._running = False
        logger.info("Aggregator sweep stopped")

    def stop(self) -> None:
        self._running = False

    @property
    def active_buckets(self) -> int:
        return len([b for b in self._buckets.values() if b.count > 0])
