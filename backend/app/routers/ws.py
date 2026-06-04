import os
import numpy as np
import joblib
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.models.telemetry import TelemetryEvent
from app.services.llm_service import get_dom_directives

router = APIRouter()

# ── Carga global del modelo ML (una sola vez al iniciar) ──────────
MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "ml", "lightgbm_model.pkl"
)
MODEL_PATH = os.path.abspath(MODEL_PATH)

try:
    ml_model = joblib.load(MODEL_PATH)
    print(f"[WS] Modelo LightGBM cargado desde {MODEL_PATH}")
except Exception as e:
    ml_model = None
    print(f"[WS][WARN] No se pudo cargar el modelo ML: {e}")

# Columnas que espera el modelo (mismo orden que train_model.py)
FEATURE_COLS = [
    "v", "a", "idle_time", "click_rate",
    "jerk", "v_squared", "a_over_v", "idle_x_click",
]


def compute_batch_features(events: list[TelemetryEvent]) -> dict | None:
    """Calcula las features promedio de un lote de eventos para el modelo ML.

    Extrae v, a, idle_time y click_rate de los eventos que los contengan,
    y deriva jerk, v_squared, a_over_v e idle_x_click a partir de ellos.
    Devuelve None si no hay datos suficientes.
    """
    velocities = []
    accelerations = []
    idle_times = []
    click_rates = []

    for ev in events:
        if ev.v is not None:
            velocities.append(ev.v)
        if ev.a is not None:
            accelerations.append(ev.a)
        if ev.idle_time is not None:
            idle_times.append(ev.idle_time)
        if ev.click_rate is not None:
            click_rates.append(ev.click_rate)

    # Necesitamos al menos velocidad y aceleracion para predecir
    if not velocities or not accelerations:
        return None

    avg_v = float(np.mean(velocities))
    avg_a = float(np.mean(accelerations))
    avg_idle = float(np.mean(idle_times)) if idle_times else 0.0
    avg_click = float(np.mean(click_rates)) if click_rates else 0.0

    # Features derivadas (misma logica que train_model.py)
    jerk = float(np.std(accelerations))  # variabilidad de aceleracion como proxy de jerk
    v_squared = avg_v ** 2
    a_over_v = avg_a / avg_v if avg_v > 0 else 0.0
    idle_x_click = avg_idle * avg_click

    return {
        "v": avg_v,
        "a": avg_a,
        "idle_time": avg_idle,
        "click_rate": avg_click,
        "jerk": jerk,
        "v_squared": v_squared,
        "a_over_v": a_over_v,
        "idle_x_click": idle_x_click,
    }


@router.websocket("/ws")
async def websocket_telemetry(websocket: WebSocket):
    """Endpoint WebSocket que recibe telemetria conductual del navegador."""
    await websocket.accept()
    print("[WS] Cliente WebSocket conectado.")

    while True:
        try:
            # El front-end envia un Array JSON: [{...}, {...}, ...]
            data = await websocket.receive_json()

            # Normalizamos: si llega un solo dict, lo envolvemos en lista
            if isinstance(data, dict):
                data = [data]

            if not isinstance(data, list):
                print(f"[WS][WARN] Payload inesperado (no es list ni dict): {type(data)}")
                continue

            # Validamos cada evento con Pydantic
            events = []
            for raw_event in data:
                try:
                    event = TelemetryEvent(**raw_event)
                    events.append(event)
                except Exception as ve:
                    print(f"[WS][WARN] Error de validacion en evento: {ve}")

            print(f"[WS][OK] Telemetria recibida: {len(events)} eventos validos de {len(data)} totales")

            # TODO: Aqui persistir los eventos en PostgreSQL
            # for event in events:
            #     await save_event(event)

            # ── Inferencia ML + LLM (LS-19) ───────────────────
            if ml_model is not None and events:
                features = compute_batch_features(events)

                if features is not None:
                    # Estructurar input en el orden correcto
                    X_input = np.array(
                        [[features[col] for col in FEATURE_COLS]]
                    )
                    print(f"[DEBUG] Features del usuario: {X_input}")
                    
                    probabilidades = ml_model.predict_proba(X_input)[0]
                    prob_estres = probabilidades[1]
                    prediction = 1 if prob_estres > 0.1 else 0
                    cognitive_state = "Estres" if prediction == 1 else "Normal"

                    print(f"[WS][ML] Probabilidad de Estrés: {prob_estres:.2f} -> Predicción ajustada: {prediction} ({cognitive_state})")

                    # Llamar a Gemini para directivas DOM
                    directives = await get_dom_directives(
                        cognitive_state=cognitive_state,
                        features=features,
                    )

                    # Retransmitir directivas al navegador
                    await websocket.send_json(directives)

        except WebSocketDisconnect:
            print("[WS] Cliente WebSocket desconectado.")
            break
        except RuntimeError as e:
            print(f"[WS] Conexion WebSocket cerrada: {e}")
            break
        except Exception as e:
            print(f"[WS][ERR] Error procesando mensaje WebSocket: {type(e).__name__}: {e}")
            # No hacemos break -> el loop sigue escuchando

