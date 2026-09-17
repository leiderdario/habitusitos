"""Serialización y publicación de eventos livianos de postura en formato JSON.

Cumple el principio de Privacidad por Diseño (mejora.md §4 y §5):
NUNCA envía video ni recortes de imágenes; únicamente telemetría numérica y de estado.
"""

from __future__ import annotations

import datetime
import json
from pathlib import Path
from typing import Any, Dict, Optional, Union

from vision_node.state_machine import DeskEvent, DeskStatus, EventType


def now_iso_utc() -> str:
    """Devuelve la fecha/hora actual en formato ISO 8601 UTC."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def build_desk_status_payload(
    camera_id: str,
    desk_id: str,
    status: DeskStatus,
    trunk_angle: Optional[float] = None,
    neck_angle: Optional[float] = None,
    shoulder_diff: Optional[float] = None,
    track_id: Optional[int] = None,
    since_iso: Optional[str] = None,
) -> Dict[str, Any]:
    """Construye el payload normalizado para actualizaciones de estado de escritorio."""
    return {
        "type": "desk_status_update",
        "camera_id": camera_id,
        "desk_id": desk_id,
        "status": status.value,
        "trunk_angle": trunk_angle,
        "neck_angle": neck_angle,
        "shoulder_diff": shoulder_diff,
        "track_id": track_id,
        "since": since_iso or now_iso_utc(),
        "timestamp": now_iso_utc(),
    }


def build_alert_payload(
    camera_id: str,
    event: DeskEvent,
) -> Dict[str, Any]:
    """Construye el payload normalizado para eventos de alerta (iniciada, recordatorio, resuelta)."""
    action = "started"
    if event.event_type == EventType.ALERT_RESOLVED:
        action = "resolved"
    elif event.event_type == EventType.ALERT_REMINDER:
        action = "reminder"

    payload: Dict[str, Any] = {
        "type": "alert_event",
        "camera_id": camera_id,
        "desk_id": event.desk_id,
        "action": action,
        "status": event.new_status.value,
        "duration_seconds": round(event.duration_bad_posture, 2),
        "track_id": event.track_id,
        "timestamp": now_iso_utc(),
    }

    if event.metrics is not None:
        payload["trunk_angle"] = event.metrics.trunk_angle
        payload["neck_angle"] = event.metrics.neck_angle
        payload["shoulder_diff"] = event.metrics.shoulder_diff

    return payload


class LocalEventPublisher:
    """Publicador local de eventos livianos hacia archivo JSON Lines y/o consola.

    En Fase 2, esta clase se extiende o reemplaza con un publicador a Redis Pub/Sub.
    """

    def __init__(self, output_file: Optional[Union[str, Path]] = None, echo_console: bool = True):
        self.output_file = Path(output_file) if output_file else None
        self.echo_console = echo_console
        if self.output_file:
            self.output_file.parent.mkdir(parents=True, exist_ok=True)

    def publish(self, payload: Dict[str, Any]) -> None:
        line = json.dumps(payload, ensure_ascii=False)

        if self.echo_console:
            p_type = payload.get("type", "")
            desk_id = payload.get("desk_id", "")
            if p_type == "alert_event":
                action = payload.get("action", "")
                dur = payload.get("duration_seconds", 0)
                print(f"[ALERTA] {desk_id}: {action.upper()} (duración: {dur}s)")
            elif p_type == "desk_status_update":
                st = payload.get("status", "")
                print(f"[ESTADO] {desk_id} -> {st}")

        if self.output_file:
            with open(self.output_file, "a", encoding="utf-8") as f:
                f.write(line + "\n")
