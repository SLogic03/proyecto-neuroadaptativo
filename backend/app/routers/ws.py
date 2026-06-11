import os
from dataclasses import dataclass, field

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
    "v", "a", "jerk", "v_squared", "a_over_v"
]

# ── Parámetros de calibración ─────────────────────────────────────
CALIBRATION_BATCHES = 10       # Lotes requeridos para calibrar (~10-15 s)
MIN_STD = 0.01                 # Piso para desviación estándar (evita /0)
Z_SCORE_THRESHOLD = 1.5        # Umbral de Z para considerar "atípico"


# ── Estado de conexión por usuario ────────────────────────────────
@dataclass
class UserSessionState:
    """Estado de calibración y baseline para una sesión WebSocket individual."""

    is_calibrating: bool = True
    calibration_data: list = field(default_factory=list)
    baseline_mean: np.ndarray | None = None
    baseline_std: np.ndarray | None = None
    batch_count: int = 0


# Diccionario global: WebSocket -> UserSessionState
_active_sessions: dict[int, UserSessionState] = {}


def _register_session(ws: WebSocket) -> UserSessionState:
    """Registra una nueva sesión y devuelve su estado."""
    state = UserSessionState()
    _active_sessions[id(ws)] = state
    print(f"[WS][SESIÓN] Nueva sesión registrada (id={id(ws)}). "
          f"Sesiones activas: {len(_active_sessions)}")
    return state


def _unregister_session(ws: WebSocket) -> None:
    """Limpia el estado de una sesión al desconectarse."""
    removed = _active_sessions.pop(id(ws), None)
    status = "OK" if removed else "WARN: no existía"
    print(f"[WS][SESIÓN] Sesión eliminada (id={id(ws)}, {status}). "
          f"Sesiones activas: {len(_active_sessions)}")


# ── Extracción de features de un lote ─────────────────────────────

def compute_batch_features(events: list[TelemetryEvent]) -> dict | None:
    """Calcula las features promedio de un lote de eventos para el modelo ML.

    Extrae v y a de los eventos que los contengan,
    y deriva jerk, v_squared, a_over_v a partir de ellos.
    Devuelve None si no hay datos suficientes.
    """
    velocities = []
    accelerations = []

    for ev in events:
        if ev.v is not None:
            velocities.append(ev.v)
        if ev.a is not None:
            accelerations.append(ev.a)

    # Necesitamos al menos velocidad y aceleracion para predecir
    if not velocities or not accelerations:
        return None

    avg_v = float(np.mean(velocities))
    avg_a = float(np.mean(accelerations))

    # Features derivadas (misma logica que train_model.py)
    jerk = float(np.std(accelerations))  # variabilidad de aceleracion como proxy de jerk
    v_squared = avg_v ** 2
    a_over_v = avg_a / avg_v if avg_v > 0 else 0.0

    return {
        "v": avg_v,
        "a": avg_a,
        "jerk": jerk,
        "v_squared": v_squared,
        "a_over_v": a_over_v,
    }


def _features_to_array(features: dict) -> np.ndarray:
    """Convierte el diccionario de features a un array 1-D en el orden de FEATURE_COLS."""
    return np.array([features[col] for col in FEATURE_COLS])


# ── Calibración basal ─────────────────────────────────────────────

def _process_calibration(state: UserSessionState, features: dict) -> None:
    """Acumula un lote de features durante la fase de calibración.

    Cuando se alcanza CALIBRATION_BATCHES, calcula el baseline (media y std)
    y cambia el estado a modo de inferencia.
    """
    feat_array = _features_to_array(features)
    state.calibration_data.append(feat_array)
    state.batch_count += 1

    print(f"[WS][CALIBRACIÓN] Lote {state.batch_count}/{CALIBRATION_BATCHES} "
          f"acumulado. Features: {dict(zip(FEATURE_COLS, feat_array))}")

    if state.batch_count >= CALIBRATION_BATCHES:
        # Apilar todos los lotes: shape (n_lotes, n_features)
        stacked = np.vstack(state.calibration_data)

        state.baseline_mean = np.mean(stacked, axis=0)
        state.baseline_std = np.maximum(np.std(stacked, axis=0), MIN_STD)
        state.is_calibrating = False

        # Liberar memoria de los datos crudos de calibración
        state.calibration_data.clear()

        mean_dict = dict(zip(FEATURE_COLS, state.baseline_mean))
        std_dict = dict(zip(FEATURE_COLS, state.baseline_std))
        print(f"[WS][CALIBRACIÓN] ✅ Base establecida para el usuario.")
        print(f"    Medias:  {mean_dict}")
        print(f"    StdDevs: {std_dict}")


# ── Normalización Z-Score ─────────────────────────────────────────

def _normalize_zscore(features: dict, state: UserSessionState) -> np.ndarray:
    """Normaliza las features actuales al Z-Score respecto al baseline del usuario.

    Retorna un array 1-D de Z-scores en el orden de FEATURE_COLS.
    """
    feat_array = _features_to_array(features)
    z_scores = (feat_array - state.baseline_mean) / state.baseline_std
    return z_scores


def _is_atypical(z_scores: np.ndarray) -> bool:
    """Determina si el comportamiento es atípico.

    Se considera atípico si el Z-score de velocidad (v) O aceleración (a)
    supera el umbral de +2.0 en valor absoluto. Esto detecta movimientos
    inusualmente rápidos o bruscos para este usuario en particular,
    independientemente del DPI de su ratón.
    """
    z_v = abs(z_scores[FEATURE_COLS.index("v")])
    z_a = abs(z_scores[FEATURE_COLS.index("a")])
    return z_v > Z_SCORE_THRESHOLD or z_a > Z_SCORE_THRESHOLD


# ── Endpoint WebSocket ────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_telemetry(websocket: WebSocket):
    """Endpoint WebSocket que recibe telemetria conductual del navegador.

    Flujo:
    1. Los primeros CALIBRATION_BATCHES lotes se usan para construir un
       baseline personalizado (media + std) de las features cinemáticas.
    2. A partir de ahí, cada lote se normaliza a Z-Score vs. el baseline.
       Si el Z-score indica comportamiento atípico, se invoca el modelo
       LightGBM + Gemini para generar directivas DOM.
    """
    await websocket.accept()
    state = _register_session(websocket)
    print("[WS] Cliente WebSocket conectado. Iniciando fase de calibración "
          f"({CALIBRATION_BATCHES} lotes)…")

    try:
        while True:
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

            print(f"[WS][OK] Telemetria recibida: {len(events)} eventos "
                  f"validos de {len(data)} totales")

            # TODO: Aqui persistir los eventos en PostgreSQL
            # for event in events:
            #     await save_event(event)

            # ── Extracción de features del lote ───────────────
            features = compute_batch_features(events) if events else None
            if features is None:
                continue

            # ── Fase 1: Calibración (acumular baseline) ───────
            if state.is_calibrating:
                _process_calibration(state, features)

                # Enviar progreso de calibración al front-end
                await websocket.send_json({
                    "type": "calibration_progress",
                    "batch": state.batch_count,
                    "total": CALIBRATION_BATCHES,
                    "done": not state.is_calibrating,
                })
                continue

            # ── Fase 2: Inferencia con Z-Score normalizado ────
            if ml_model is None:
                continue

            z_scores = _normalize_zscore(features, state)
            z_dict = dict(zip(FEATURE_COLS, z_scores))
            print(f"[WS][Z-SCORE] {z_dict}")

            # Solo ejecutar la pipeline ML+LLM si el movimiento es atípico
            if not _is_atypical(z_scores):
                print("[WS][Z-SCORE] Comportamiento dentro de rango normal. "
                      "Sin predicción.")
                await websocket.send_json({
                    "type": "prediction",
                    "cognitive_state": "Normal",
                    "z_scores": z_dict,
                    "atypical": False,
                })
                continue

            # Comportamiento atípico → predecir con el modelo ML
            print("[WS][Z-SCORE] ⚠️ Comportamiento ATÍPICO detectado. "
                  "Ejecutando pipeline ML + Gemini…")

            X_input = np.array(
                [[features[col] for col in FEATURE_COLS]]
            )
            print(f"[DEBUG] Features crudas del usuario: {X_input}")

            probabilidades = ml_model.predict_proba(X_input)[0]
            prob_estres = probabilidades[1]
            prediction = 1 if prob_estres > 0.1 else 0
            cognitive_state = "Estres" if prediction == 1 else "Normal"

            print(f"[WS][ML] Prob(Estrés): {prob_estres:.2f} → "
                  f"Predicción: {prediction} ({cognitive_state})")

            # Llamar a Gemini para directivas DOM
            directives = await get_dom_directives(
                cognitive_state=cognitive_state,
                features=features,
            )

            # Inyectar metadatos de Z-score en la respuesta
            if isinstance(directives, dict):
                directives["z_scores"] = z_dict
                directives["atypical"] = True

            # Retransmitir directivas al navegador
            await websocket.send_json(directives)

    except WebSocketDisconnect:
        print("[WS] Cliente WebSocket desconectado.")
    except RuntimeError as e:
        print(f"[WS] Conexion WebSocket cerrada: {e}")
    except Exception as e:
        print(f"[WS][ERR] Error procesando mensaje WebSocket: "
              f"{type(e).__name__}: {e}")
    finally:
        # Garantizar limpieza del estado independientemente de cómo termine
        _unregister_session(websocket)
