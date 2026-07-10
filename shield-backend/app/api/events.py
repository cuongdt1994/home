"""Server-Sent Events (SSE) endpoint for realtime dashboard updates."""

import asyncio
import logging

from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.event_bus import event_bus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


# Fallback SSE implementation since we may not have sse-starlette installed.
# This uses raw ASGI streaming.
async def sse_generator(request: Request, sub_id: int = 0, queue: asyncio.Queue | None = None):
    """Yield SSE-formatted events from the event bus."""
    if queue is None:
        yield f"data: {json.dumps({'error': 'No event queue'})}\n\n"
        return
    try:
        # Send initial connection event
        import json
        yield f"data: {json.dumps({'type': 'connected', 'timestamp': '', 'data': {}})}\n\n"

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            try:
                event_json = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {event_json}\n\n"
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield ":keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        await event_bus.unsubscribe(sub_id)
        logger.debug("SSE client disconnected (sub_id=%d)", sub_id)


@router.get("/realtime")
async def realtime_events(
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    """SSE endpoint for realtime security events.

    Streams: new alerts, AI decisions, blocked IPs, health changes, audit entries.

    Event types:
    - new_alert: A Suricata alert was parsed
    - aggregated_event: An aggregation threshold was met
    - ai_decision: DeepSeek analyzed an aggregation
    - blocked_ip: An IP was blocked (or would be in dry-run)
    - health_change: A service health state changed
    - audit_entry: A new audit log entry was created
    """
    import json

    sub_id, queue = await event_bus.subscribe()

    return StreamingResponse(
        sse_generator(request, sub_id, queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
