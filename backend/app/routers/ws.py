from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.models.telemetry import TelemetryEvent

router = APIRouter()


@router.websocket("/ws")
async def websocket_telemetry(websocket: WebSocket):
    """Endpoint WebSocket que recibe telemetría conductual del navegador."""
    await websocket.accept()
    print("Cliente WebSocket conectado.")

    try:
        while True:
            try:
                # El front-end envía un Array JSON: [{...}, {...}, ...]
                data = await websocket.receive_json()

                # Normalizamos: si llega un solo dict, lo envolvemos en lista
                if isinstance(data, dict):
                    data = [data]

                if not isinstance(data, list):
                    print(f"⚠️  Payload inesperado (no es list ni dict): {type(data)}")
                    continue

                # Validamos cada evento con Pydantic
                events = []
                for raw_event in data:
                    try:
                        event = TelemetryEvent(**raw_event)
                        events.append(event)
                    except Exception as ve:
                        print(f"⚠️  Error de validación en evento: {ve} | Datos: {raw_event}")

                print(f"✅ Telemetría recibida: {len(events)} eventos válidos de {len(data)} totales")

                # TODO: Aquí persistir los eventos en PostgreSQL
                # for event in events:
                #     await save_event(event)

            except Exception as e:
                print(f"❌ Error procesando mensaje WebSocket: {type(e).__name__}: {e}")
                # No hacemos break → el loop sigue escuchando
    except WebSocketDisconnect:
        print("Cliente WebSocket desconectado.")
