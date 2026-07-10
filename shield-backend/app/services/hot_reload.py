"""Config file hot-reloader — watches whitelist.txt and thresholds.yaml for changes."""

import asyncio
import logging
import os
from typing import Callable, Awaitable

logger = logging.getLogger(__name__)

CHECK_INTERVAL = 5  # seconds


class ConfigWatcher:
    """Periodically checks file mtimes and triggers reload callbacks on change."""

    def __init__(self, check_interval: float = CHECK_INTERVAL):
        self._check_interval = check_interval
        self._watchers: dict[str, tuple[str, Callable[[], Awaitable[None]], float]] = {}
        self._running = False

    def register(self, name: str, file_path: str, callback: Callable[[], Awaitable[None]]) -> None:
        """Register a file to watch.

        Args:
            name: Human-readable name for logging.
            file_path: Absolute path to the file.
            callback: Async callable invoked when the file changes.
        """
        mtime = self._get_mtime(file_path)
        self._watchers[name] = (file_path, callback, mtime)
        logger.info("ConfigWatcher registered '%s' -> %s (mtime=%s)", name, file_path, mtime)

    async def run(self, shutdown_event: asyncio.Event) -> None:
        """Run the watch loop. Checks all registered files every check_interval.

        Args:
            shutdown_event: Set to stop watching.
        """
        self._running = True
        logger.info("ConfigWatcher started (interval=%ds, %d files)", self._check_interval, len(self._watchers))

        while self._running and not shutdown_event.is_set():
            try:
                for name, (file_path, callback, last_mtime) in self._watchers.items():
                    current_mtime = self._get_mtime(file_path)
                    if current_mtime is not None and current_mtime > last_mtime:
                        logger.info("ConfigWatcher: '%s' changed — triggering reload", name)
                        try:
                            await callback()
                        except Exception:
                            logger.exception("ConfigWatcher: callback for '%s' failed", name)
                        self._watchers[name] = (file_path, callback, current_mtime)

                await asyncio.sleep(self._check_interval)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("ConfigWatcher loop error")
                await asyncio.sleep(self._check_interval)

        self._running = False
        logger.info("ConfigWatcher stopped")

    def stop(self) -> None:
        self._running = False

    @staticmethod
    def _get_mtime(file_path: str) -> float | None:
        """Get file mtime, or None if file doesn't exist."""
        try:
            return os.path.getmtime(file_path)
        except OSError:
            return None
