"""Pruebas unitarias de la máquina de estados e histéresis temporal."""

import pytest
from vision_node.config import HysteresisConfig
from vision_node.geometry import PostureMetrics
from vision_node.state_machine import DeskStateMachine, DeskStatus, EventType


def make_metrics(is_correct: bool, is_valid: bool = True) -> PostureMetrics:
    return PostureMetrics(
        trunk_angle=10.0 if is_correct else 35.0,
        neck_angle=12.0 if is_correct else 38.0,
        shoulder_diff=0.02 if is_correct else 0.12,
        is_valid=is_valid,
        is_correct=is_correct if is_valid else None,
    )


def test_initial_to_correct():
    cfg = HysteresisConfig(sustained_seconds=20.0, reminder_seconds=60.0)
    fsm = DeskStateMachine(desk_id="desk_01", config=cfg)
    assert fsm.status == DeskStatus.SIN_DATOS

    # Primer frame con postura correcta en t=100.0
    events = fsm.update(metrics=make_metrics(True), current_time=100.0, track_id=1)
    assert fsm.status == DeskStatus.CORRECTO
    assert len(events) == 1
    assert events[0].event_type == EventType.STATUS_CHANGED
    assert events[0].new_status == DeskStatus.CORRECTO


def test_momentary_bad_posture_does_not_alert():
    cfg = HysteresisConfig(sustained_seconds=20.0, reminder_seconds=60.0)
    fsm = DeskStateMachine(desk_id="desk_01", config=cfg)
    fsm.update(metrics=make_metrics(True), current_time=100.0)
    assert fsm.status == DeskStatus.CORRECTO

    # t=110.0: detecta mala postura (agacharse a recoger algo) -> EN_OBSERVACION
    events = fsm.update(metrics=make_metrics(False), current_time=110.0)
    assert fsm.status == DeskStatus.EN_OBSERVACION
    assert any(e.new_status == DeskStatus.EN_OBSERVACION for e in events)

    # t=118.0 (8 segundos después, menor que umbral de 20s): vuelve a postura correcta
    events = fsm.update(metrics=make_metrics(True), current_time=118.0)
    assert fsm.status == DeskStatus.CORRECTO

    # NUNCA debe haberse disparado ALERT_TRIGGERED
    assert not any(e.event_type == EventType.ALERT_TRIGGERED for e in events)


def test_sustained_bad_posture_triggers_alert_and_resolution():
    cfg = HysteresisConfig(sustained_seconds=20.0, reminder_seconds=60.0)
    fsm = DeskStateMachine(desk_id="desk_01", config=cfg)
    fsm.update(metrics=make_metrics(True), current_time=100.0)

    # t=110.0: inicio de mala postura sostenida
    fsm.update(metrics=make_metrics(False), current_time=110.0)
    assert fsm.status == DeskStatus.EN_OBSERVACION

    # t=125.0: han pasado 15s (aún en observación)
    events_mid = fsm.update(metrics=make_metrics(False), current_time=125.0)
    assert fsm.status == DeskStatus.EN_OBSERVACION
    assert len(events_mid) == 0

    # t=131.0: han pasado 21s (supera el umbral de 20s) -> ALERTA_ACTIVA
    events_alert = fsm.update(metrics=make_metrics(False), current_time=131.0)
    assert fsm.status == DeskStatus.ALERTA_ACTIVA
    assert any(e.event_type == EventType.ALERT_TRIGGERED for e in events_alert)
    alert_event = next(e for e in events_alert if e.event_type == EventType.ALERT_TRIGGERED)
    assert alert_event.duration_bad_posture >= 20.0

    # t=192.0: transcurren >60s en alerta continua -> recordatorio periódico
    events_reminder = fsm.update(metrics=make_metrics(False), current_time=192.0)
    assert any(e.event_type == EventType.ALERT_REMINDER for e in events_reminder)

    # t=200.0: el usuario se endereza y corrige la postura -> se resuelve la alerta
    events_resolved = fsm.update(metrics=make_metrics(True), current_time=200.0)
    assert fsm.status == DeskStatus.CORRECTO
    assert any(e.event_type == EventType.ALERT_RESOLVED for e in events_resolved)


def test_empty_desk_transitions_to_sin_ocupar():
    cfg = HysteresisConfig(unoccupied_seconds_threshold=5.0)
    fsm = DeskStateMachine(desk_id="desk_01", config=cfg)
    fsm.update(metrics=make_metrics(True), current_time=100.0)
    assert fsm.status == DeskStatus.CORRECTO

    # t=101.0: persona se levanta del escritorio (metrics=None)
    fsm.update(metrics=None, current_time=101.0)
    # Aún dentro del margen de gracia (1 segundo < 5s)
    assert fsm.status == DeskStatus.CORRECTO

    # t=107.0: 6 segundos sin detección -> SIN_OCUPAR
    events = fsm.update(metrics=None, current_time=107.0)
    assert fsm.status == DeskStatus.SIN_OCUPAR
    assert any(e.new_status == DeskStatus.SIN_OCUPAR for e in events)


def test_camera_offline_sets_sin_datos_immediately():
    cfg = HysteresisConfig()
    fsm = DeskStateMachine(desk_id="desk_01", config=cfg)
    fsm.update(metrics=make_metrics(True), current_time=100.0)
    assert fsm.status == DeskStatus.CORRECTO

    # Cámara se cae
    events = fsm.update(metrics=None, current_time=102.0, camera_online=False)
    assert fsm.status == DeskStatus.SIN_DATOS
    assert any(e.new_status == DeskStatus.SIN_DATOS for e in events)
