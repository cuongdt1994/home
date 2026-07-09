"""WebSocket endpoint route."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from websocket.manager import ws_manager

router = APIRouter()


@router.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        await ws.send_json({"type": "connected", "payload": {"message": "Real-time connection established"}})
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await ws_manager.disconnect(ws)
