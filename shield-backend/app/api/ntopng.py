"""ntopng stats API proxy."""

from fastapi import APIRouter, Depends, Request, Query

from app.auth.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ntopng", tags=["ntopng"])


@router.get("/stats")
async def get_ntopng_stats(
    ifid: int = Query(0),
    request: Request = None,
    _current_user: User = Depends(get_current_user),
):
    """Get ntopng interface statistics."""
    ntopng = getattr(request.app.state, "ntopng", None)
    if ntopng is None:
        return {"error": "ntopng service not initialized", "data": {}}
    data = await ntopng.get_interface_stats(ifid)
    return {"data": data}


@router.get("/top-hosts")
async def get_top_hosts(
    limit: int = Query(20, le=100),
    ifid: int = Query(0),
    request: Request = None,
    _current_user: User = Depends(get_current_user),
):
    """Get top talkers by traffic volume."""
    ntopng = getattr(request.app.state, "ntopng", None)
    if ntopng is None:
        return {"error": "ntopng service not initialized", "data": []}
    data = await ntopng.get_top_hosts(limit, ifid)
    return {"data": data}


@router.get("/active-flows")
async def get_active_flows(
    limit: int = Query(50, le=200),
    ifid: int = Query(0),
    request: Request = None,
    _current_user: User = Depends(get_current_user),
):
    """Get active network flows."""
    ntopng = getattr(request.app.state, "ntopng", None)
    if ntopng is None:
        return {"error": "ntopng service not initialized", "data": []}
    data = await ntopng.get_active_flows(limit, ifid)
    return {"data": data}


@router.get("/interfaces")
async def get_interfaces(
    request: Request = None,
    _current_user: User = Depends(get_current_user),
):
    """List available ntopng interfaces."""
    ntopng = getattr(request.app.state, "ntopng", None)
    if ntopng is None:
        return {"error": "ntopng service not initialized", "data": []}
    data = await ntopng.get_interface_list()
    return {"data": data}
