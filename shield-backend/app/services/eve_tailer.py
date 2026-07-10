"""Async Suricata eve.json log tailer with rotation detection."""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import aiofiles

logger = logging.getLogger(__name__)


def _parse_timestamp(ts_str: str) -> datetime:
    """Parse a Suricata timestamp string to datetime, falling back to now."""
    if not ts_str:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


class EveTailer:
    """Async tailer for Suricata eve.json that handles log rotation.

    Yields parsed JSON lines as dicts. Detects inode changes to handle
    logrotate-style rotation without missing events.
    """

    def __init__(self, file_path: str, poll_interval: float = 1.0):
        self._path = file_path
        self._poll_interval = poll_interval
        self._inode: Optional[int] = None
        self._position: int = 0
        self._last_event_at: Optional[datetime] = None
        self._running = False
        self._error_count = 0

    @property
    def last_event_at(self) -> Optional[datetime]:
        return self._last_event_at

    @property
    def error_count(self) -> int:
        return self._error_count

    async def tail(self, shutdown_event: asyncio.Event) -> AsyncGenerator[dict, None]:
        """Async generator yielding eve.json events.

        Blocks when reaching EOF, polls for new data. Handles file
        disappearance and rotation (inode change).

        Args:
            shutdown_event: Set to stop the generator.
        """
        self._running = True
        logger.info("Starting eve.json tailer on %s", self._path)

        while self._running and not shutdown_event.is_set():
            try:
                if not os.path.exists(self._path):
                    logger.warning("eve.json not found at %s — retrying in %.0fs", self._path, self._poll_interval)
                    await asyncio.sleep(self._poll_interval * 5)
                    continue

                current_inode = os.stat(self._path).st_ino

                # Detect rotation: new inode means logrotate happened
                if self._inode is not None and current_inode != self._inode:
                    logger.info("Log rotation detected (inode changed) — reopening")
                    self._position = 0

                self._inode = current_inode

                async with aiofiles.open(self._path, "r") as f:
                    await f.seek(self._position)

                    while self._running and not shutdown_event.is_set():
                        line = await f.readline()
                        if not line:
                            # EOF — wait for more data
                            self._position = await f.tell()
                            await asyncio.sleep(self._poll_interval)
                            # Check if file still exists (handles deletion)
                            if not os.path.exists(self._path):
                                break
                            continue

                        line = line.strip()
                        if not line:
                            continue

                        parsed = self._parse_line(line)
                        if parsed is not None:
                            yield parsed
                        self._position = await f.tell()

            except asyncio.CancelledError:
                logger.info("EveTailer cancelled")
                break
            except Exception:
                self._error_count += 1
                logger.exception("EveTailer error — retrying in 5s")
                await asyncio.sleep(5)

        self._running = False
        logger.info("EveTailer stopped (errors=%d)", self._error_count)

    def _parse_line(self, line: str) -> Optional[dict]:
        """Parse a single JSON line. Returns None on parse failure."""
        import json

        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON in eve.json (length=%d): %.100s...", len(line), line)
            self._error_count += 1
            return None

        # Track last event timestamp for health reporting
        # Parse actual event timestamp for health reporting
        ts_str = event.get("timestamp", "")
        self._last_event_at = _parse_timestamp(ts_str)

        return event

    def stop(self) -> None:
        """Signal the tailer to stop at the next iteration."""
        self._running = False


async def start_eve_tailer(
    file_path: str,
    poll_interval: float = 1.0,
    shutdown_event: asyncio.Event | None = None,
) -> AsyncGenerator[dict, None]:
    """Convenience factory that creates and runs an EveTailer."""
    tailer = EveTailer(file_path, poll_interval)
    shutdown = shutdown_event or asyncio.Event()
    async for event in tailer.tail(shutdown):
        yield event
