from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class TelemetryEvent(BaseModel):
    """Evento individual de telemetría conductual.

    El front-end envía objetos con ``type``, ``timestamp`` y campos
    adicionales variables según el tipo de evento (mouse_kinematics,
    keystroke_latency, dwell_time).  Usamos ``extra = "allow"`` para
    capturar todos los campos sin romper la validación.
    """
    type: str
    timestamp: int

    # ── Campos opcionales por tipo de evento ──
    # mouse_kinematics
    x: Optional[int] = None
    y: Optional[int] = None
    v: Optional[float] = None
    a: Optional[float] = None

    # keystroke_latency
    key_code: Optional[str] = None
    latency_ms: Optional[int] = None

    # dwell_time
    element_id: Optional[str] = None
    duration_ms: Optional[int] = None

    # aggregate / ML-relevant
    idle_time: Optional[float] = None
    click_rate: Optional[int] = None

    class Config:
        extra = "allow"  # Acepta campos extra sin error


class TelemetryPayload(BaseModel):
    """Payload que envuelve una lista de eventos de telemetría.

    Nota: el front-end envía directamente un array JSON ``[{...}, ...]``
    por lo que en ws.py se parsea como ``List[Dict]`` y luego se valida
    cada elemento como ``TelemetryEvent``.
    """
    events: List[TelemetryEvent]
