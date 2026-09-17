"""Máquina de estados finita (FSM) con histéresis temporal por escritorio.

Evita falsos positivos y parpadeos por movimientos momentáneos naturales
(inclinarse momentáneamente, estirarse, recoger un bolígrafo).
Maneja transiciones rigurosas entre CORRECTO, EN_OBSERVACION, ALERTA_ACTIVA,
SIN_OCUPAR y SIN_DATOS.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

from vision_node.config import HysteresisConfig
from vision_node.geometry import PostureMetrics


class DeskStatus(str, Enum):
    CORRECTO = "correcto"
    EN_OBSERVACION = "en_observacion"
    ALERTA_ACTIVA = "alerta_activa"
    SIN_OCUPAR = "sin_ocupar"
    SIN_DATOS = "sin_datos"


class EventType(str, Enum):
    STATUS_CHANGED = "status_changed"
    ALERT_TRIGGERED = "alert_triggered"
    ALERT_REMINDER = "alert_reminder"
    ALERT_RESOLVED = "alert_resolved"


@dataclass
class DeskEvent:
    desk_id: str
    event_type: EventType
    old_status: DeskStatus
    new_status: DeskStatus
    timestamp: float
    duration_bad_posture: float = 0.0
    metrics: Optional[PostureMetrics] = None
    track_id: Optional[int] = None


class DeskStateMachine:
    """Gestiona el estado postural y la histéresis temporal de un escritorio individual."""

    def __init__(self, desk_id: str, config: HysteresisConfig):
        self.desk_id = desk_id
        self.config = config
        self.status: DeskStatus = DeskStatus.SIN_DATOS
        self.bad_posture_start_time: Optional[float] = None
        self.alert_start_time: Optional[float] = None
        self.last_reminder_time: Optional[float] = None
        self.unoccupied_start_time: Optional[float] = None
        self.last_seen_time: Optional[float] = None
        self.current_track_id: Optional[int] = None
        self.last_metrics: Optional[PostureMetrics] = None

    def update(
        self,
        metrics: Optional[PostureMetrics],
        current_time: float,
        track_id: Optional[int] = None,
        camera_online: bool = True,
    ) -> List[DeskEvent]:
        """Avanza la máquina de estados con una nueva observación en el instante current_time.

        metrics:
          - None: no se detectó persona en el escritorio (o keypoints completamente no confiables).
          - PostureMetrics con is_valid=False: oclusión parcial, se conserva el estado previo temporalmente.
          - PostureMetrics con is_valid=True: postura evaluada (is_correct=True o False).
        """
        events: List[DeskEvent] = []
        old_status = self.status

        # 1. Caso cámara sin señal / caída
        if not camera_online:
            if self.status != DeskStatus.SIN_DATOS:
                self.status = DeskStatus.SIN_DATOS
                self._reset_timers()
                events.append(
                    DeskEvent(
                        desk_id=self.desk_id,
                        event_type=EventType.STATUS_CHANGED,
                        old_status=old_status,
                        new_status=self.status,
                        timestamp=current_time,
                    )
                )
            return events

        # 2. Caso escritorio sin persona detectada
        if metrics is None:
            if self.unoccupied_start_time is None:
                self.unoccupied_start_time = current_time

            unoccupied_elapsed = current_time - self.unoccupied_start_time
            if unoccupied_elapsed >= self.config.unoccupied_seconds_threshold:
                if self.status != DeskStatus.SIN_OCUPAR:
                    was_in_alert = self.status == DeskStatus.ALERTA_ACTIVA
                    self.status = DeskStatus.SIN_OCUPAR
                    self._reset_timers()
                    events.append(
                        DeskEvent(
                            desk_id=self.desk_id,
                            event_type=EventType.STATUS_CHANGED,
                            old_status=old_status,
                            new_status=self.status,
                            timestamp=current_time,
                        )
                    )
                    if was_in_alert:
                        events.append(
                            DeskEvent(
                                desk_id=self.desk_id,
                                event_type=EventType.ALERT_RESOLVED,
                                old_status=old_status,
                                new_status=self.status,
                                timestamp=current_time,
                            )
                        )
            return events

        # Se detectó una persona
        self.unoccupied_start_time = None
        self.last_seen_time = current_time
        self.current_track_id = track_id
        self.last_metrics = metrics

        # 3. Caso oclusión parcial (datos no confiables)
        # Omitimos el frame sin clasificar ni como correcto ni incorrecto (mejora.md §8.6)
        if not metrics.is_valid or metrics.is_correct is None:
            return events

        # 4. Evaluación de postura: correcta vs incorrecta
        is_posture_correct = metrics.is_correct

        if is_posture_correct:
            # La postura es correcta
            if self.status == DeskStatus.ALERTA_ACTIVA:
                duration = current_time - (self.bad_posture_start_time or current_time)
                self.status = DeskStatus.CORRECTO
                self._reset_timers()
                events.append(
                    DeskEvent(
                        desk_id=self.desk_id,
                        event_type=EventType.ALERT_RESOLVED,
                        old_status=old_status,
                        new_status=self.status,
                        timestamp=current_time,
                        duration_bad_posture=duration,
                        metrics=metrics,
                        track_id=track_id,
                    )
                )
                events.append(
                    DeskEvent(
                        desk_id=self.desk_id,
                        event_type=EventType.STATUS_CHANGED,
                        old_status=old_status,
                        new_status=self.status,
                        timestamp=current_time,
                        metrics=metrics,
                        track_id=track_id,
                    )
                )
            elif self.status != DeskStatus.CORRECTO:
                self.status = DeskStatus.CORRECTO
                self._reset_timers()
                events.append(
                    DeskEvent(
                        desk_id=self.desk_id,
                        event_type=EventType.STATUS_CHANGED,
                        old_status=old_status,
                        new_status=self.status,
                        timestamp=current_time,
                        metrics=metrics,
                        track_id=track_id,
                    )
                )
            else:
                # Ya estaba en CORRECTO, simplemente reseteamos cronómetros
                self._reset_timers()

        else:
            # Postura incorrecta detectada
            if self.bad_posture_start_time is None:
                self.bad_posture_start_time = current_time

            elapsed_bad = current_time - self.bad_posture_start_time

            if self.status in (DeskStatus.CORRECTO, DeskStatus.SIN_OCUPAR, DeskStatus.SIN_DATOS):
                self.status = DeskStatus.EN_OBSERVACION
                events.append(
                    DeskEvent(
                        desk_id=self.desk_id,
                        event_type=EventType.STATUS_CHANGED,
                        old_status=old_status,
                        new_status=self.status,
                        timestamp=current_time,
                        duration_bad_posture=elapsed_bad,
                        metrics=metrics,
                        track_id=track_id,
                    )
                )

            elif self.status == DeskStatus.EN_OBSERVACION:
                if elapsed_bad >= self.config.sustained_seconds:
                    self.status = DeskStatus.ALERTA_ACTIVA
                    self.alert_start_time = current_time
                    self.last_reminder_time = current_time
                    events.append(
                        DeskEvent(
                            desk_id=self.desk_id,
                            event_type=EventType.ALERT_TRIGGERED,
                            old_status=old_status,
                            new_status=self.status,
                            timestamp=current_time,
                            duration_bad_posture=elapsed_bad,
                            metrics=metrics,
                            track_id=track_id,
                        )
                    )
                    events.append(
                        DeskEvent(
                            desk_id=self.desk_id,
                            event_type=EventType.STATUS_CHANGED,
                            old_status=old_status,
                            new_status=self.status,
                            timestamp=current_time,
                            duration_bad_posture=elapsed_bad,
                            metrics=metrics,
                            track_id=track_id,
                        )
                    )

            elif self.status == DeskStatus.ALERTA_ACTIVA:
                # Ya en alerta activa: verificar si corresponde recordatorio periódico
                if (
                    self.last_reminder_time is not None
                    and (current_time - self.last_reminder_time) >= self.config.reminder_seconds
                ):
                    self.last_reminder_time = current_time
                    events.append(
                        DeskEvent(
                            desk_id=self.desk_id,
                            event_type=EventType.ALERT_REMINDER,
                            old_status=self.status,
                            new_status=self.status,
                            timestamp=current_time,
                            duration_bad_posture=elapsed_bad,
                            metrics=metrics,
                            track_id=track_id,
                        )
                    )

        return events

    def _reset_timers(self) -> None:
        self.bad_posture_start_time = None
        self.alert_start_time = None
        self.last_reminder_time = None
