"""Prueba de integración de punta a punta con video sintético para validar vision-node."""

import time
from pathlib import Path
import cv2
import numpy as np

from vision_node.config import VisionNodeConfig
from vision_node.events import LocalEventPublisher, build_desk_status_payload, build_alert_payload
from vision_node.geometry import calculate_posture_metrics, Keypoint
from vision_node.spatial_mapping import match_people_to_desks, PersonDetection
from vision_node.state_machine import DeskStateMachine, DeskStatus, EventType


def run_e2e_simulation():
    print("=== Iniciando Simulación E2E de Vision Node ===")
    config_file = Path(__file__).parent / "config.json"
    config = VisionNodeConfig.load_from_file(config_file)
    output_events = Path(__file__).parent / "test_events.jsonl"
    if output_events.exists():
        output_events.unlink()

    publisher = LocalEventPublisher(output_file=output_events, echo_console=True)
    fsm = DeskStateMachine("desk_01", config.hysteresis)

    # 1. Simular detección de persona en Desk 01 con postura correcta
    print("\n--- Fase A: Persona sentada en postura correcta ---")
    kpts_good = [Keypoint(0, 0, 0.9) for _ in range(17)]
    kpts_good[11] = Keypoint(200, 400, 0.95) # Cadera izq
    kpts_good[12] = Keypoint(240, 400, 0.95) # Cadera der
    kpts_good[5] = Keypoint(180, 260, 0.95)  # Hombro izq
    kpts_good[6] = Keypoint(260, 260, 0.95)  # Hombro der
    kpts_good[3] = Keypoint(205, 180, 0.95)  # Oreja izq
    kpts_good[4] = Keypoint(235, 180, 0.95)  # Oreja der
    kpts_good[0] = Keypoint(220, 190, 0.95)  # Nariz

    det_good = PersonDetection(track_id=1, keypoints=kpts_good, bbox=(170, 160, 270, 420))
    matches, passers = match_people_to_desks([det_good], config.desks, 1000, 1000)
    assert matches["desk_01"] is not None
    assert matches["desk_01"].track_id == 1
    print("Mapeo espacial exitoso: Persona ID 1 asignada a desk_01.")

    metrics_good = calculate_posture_metrics(
        kpts_good,
        min_conf=0.35,
        trunk_max_angle=config.desks[0].thresholds.trunk_max_angle,
        neck_max_angle=config.desks[0].thresholds.neck_max_angle,
        shoulder_diff_max=config.desks[0].thresholds.shoulder_diff_max,
    )
    assert metrics_good.is_correct is True
    print(f"Métricas calculadas: Tronco={metrics_good.trunk_angle}°, Cuello={metrics_good.neck_angle}°, Desnivel={metrics_good.shoulder_diff}")

    events = fsm.update(metrics_good, current_time=100.0, track_id=1)
    for ev in events:
        publisher.publish(build_desk_status_payload("cam_01", "desk_01", fsm.status, metrics_good.trunk_angle, metrics_good.neck_angle, metrics_good.shoulder_diff, 1))
    assert fsm.status == DeskStatus.CORRECTO

    # 2. Simular mala postura sostenida (> 20 segundos)
    print("\n--- Fase B: Persona adopta mala postura sostenida (>20s) ---")
    kpts_bad = list(kpts_good)
    # Desplazar hombros y cabeza hacia adelante (encorvamiento)
    kpts_bad[5] = Keypoint(280, 260, 0.95)
    kpts_bad[6] = Keypoint(360, 260, 0.95)
    kpts_bad[3] = Keypoint(305, 180, 0.95)
    kpts_bad[4] = Keypoint(335, 180, 0.95)
    kpts_bad[0] = Keypoint(320, 190, 0.95)

    metrics_bad = calculate_posture_metrics(
        kpts_bad,
        min_conf=0.35,
        trunk_max_angle=config.desks[0].thresholds.trunk_max_angle,
        neck_max_angle=config.desks[0].thresholds.neck_max_angle,
        shoulder_diff_max=config.desks[0].thresholds.shoulder_diff_max,
    )
    assert metrics_bad.is_correct is False
    print(f"Métricas en mala postura: Tronco={metrics_bad.trunk_angle}° (excede umbral 25°)")

    # t=105s: Inicio mala postura -> EN_OBSERVACION
    fsm.update(metrics_bad, current_time=105.0, track_id=1)
    assert fsm.status == DeskStatus.EN_OBSERVACION
    print(f"Estado a t=105s: {fsm.status.value}")

    # t=126s: Han transcurrido 21s continuos -> ALERTA_ACTIVA
    events_alert = fsm.update(metrics_bad, current_time=126.0, track_id=1)
    assert fsm.status == DeskStatus.ALERTA_ACTIVA
    for ev in events_alert:
        if ev.event_type == EventType.ALERT_TRIGGERED:
            publisher.publish(build_alert_payload("cam_01", ev))
    print(f"Estado a t=126s: {fsm.status.value} (¡Alerta disparada!)")

    # 3. Simular corrección de postura
    print("\n--- Fase C: Corrección postural ---")
    events_resolved = fsm.update(metrics_good, current_time=135.0, track_id=1)
    assert fsm.status == DeskStatus.CORRECTO
    for ev in events_resolved:
        if ev.event_type == EventType.ALERT_RESOLVED:
            publisher.publish(build_alert_payload("cam_01", ev))
    print(f"Estado a t=135s: {fsm.status.value} (Alerta resuelta automáticamente)")

    # 4. Validar archivo de eventos JSON generado
    assert output_events.exists()
    lines = output_events.read_text(encoding="utf-8").strip().split("\n")
    print(f"\nTotal eventos JSON registrados en {output_events.name}: {len(lines)}")
    for line in lines:
        print("  -> " + line)

    print("\n=== ¡Simulación E2E completada con éxito! ===")


if __name__ == "__main__":
    run_e2e_simulation()
