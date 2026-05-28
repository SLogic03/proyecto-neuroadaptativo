from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def websocket_telemetry(websocket: WebSocket):
    """Endpoint WebSocket que recibe telemetría conductual del navegador."""
    await websocket.accept()
    print("Cliente WebSocket conectado.")

    try:
        while True:
            data = await websocket.receive_json()
            print(f"Telemetría recibida: {data}")
    except WebSocketDisconnect:
        print("Cliente WebSocket desconectado.")
