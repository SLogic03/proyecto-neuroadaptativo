from pydantic import BaseModel
from typing import Any, Dict, List


class TelemetryEvent(BaseModel):
    """Evento individual de telemetría conductual."""
    type: str
    timestamp: int
    data: Dict[str, Any] = {}


class TelemetryPayload(BaseModel):
    """Payload que envuelve una lista de eventos de telemetría.

    El front-end envía un array JSON de objetos, por lo que
    también se acepta directamente una ``List[Dict]`` en el
    endpoint WebSocket y se puede validar elemento a elemento
    con ``TelemetryEvent``.
    """
    events: List[TelemetryEvent]
