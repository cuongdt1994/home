"""Async retry decorator with exponential backoff."""

import asyncio
import functools
import logging
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def async_retry(
    fn: Callable[..., T],
    *args,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple = (Exception,),
    **kwargs,
) -> T:
    """Call an async function with retry and exponential backoff.

    Args:
        fn: Async callable to retry.
        max_attempts: Total attempts before giving up.
        base_delay: Initial delay in seconds.
        max_delay: Maximum delay cap in seconds.
        backoff_factor: Multiplier for each subsequent delay.
        retryable_exceptions: Exception types that trigger a retry.

    Returns:
        The return value of the successful call.

    Raises:
        The last exception if all attempts are exhausted.
    """
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return await fn(*args, **kwargs)
        except retryable_exceptions as exc:
            last_exc = exc
            if attempt == max_attempts:
                logger.error(
                    "Retry exhausted after %d attempts: %s",
                    attempt, exc,
                )
                raise
            delay = min(base_delay * (backoff_factor ** (attempt - 1)), max_delay)
            logger.warning(
                "Attempt %d/%d failed: %s — retrying in %.1fs",
                attempt, max_attempts, exc, delay,
            )
            await asyncio.sleep(delay)

    raise last_exc  # type: ignore[misc]
