from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.core.simulation_manager import simulation_manager
import logging

logger = logging.getLogger("ws_router")
router = APIRouter(tags=["WebSocket Telemetry Stream"])

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """WebSocket endpoint pushing live step-by-step engine telemetry and KV block matrices."""
    await websocket.accept()
    simulation_manager.ws_subscribers.append(websocket)
    logger.info("New client connected to /ws/telemetry stream.")

    # Push immediate current telemetry state
    initial_state = simulation_manager.get_current_metrics()
    await websocket.send_json({"event": "connected", "initial_state": initial_state})

    try:
        while True:
            # Keep connection open & listen for client ping or injection messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info("Client disconnected from /ws/telemetry.")
    finally:
        if websocket in simulation_manager.ws_subscribers:
            simulation_manager.ws_subscribers.remove(websocket)
