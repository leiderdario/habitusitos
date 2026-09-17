"""Superposición visual de depuración para validación en Fase 1.

Dibuja los polígonos de escritorios con código de color según estado (Gris, Verde, Ámbar, Rojo),
esqueletos de personas evaluadas y métricas angulares en pantalla.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple
import cv2
import numpy as np

from vision_node.config import DeskZone
from vision_node.geometry import (
    COCO_LEFT_EAR,
    COCO_LEFT_ELBOW,
    COCO_LEFT_HIP,
    COCO_LEFT_KNEE,
    COCO_LEFT_SHOULDER,
    COCO_LEFT_WRIST,
    COCO_NOSE,
    COCO_RIGHT_EAR,
    COCO_RIGHT_ELBOW,
    COCO_RIGHT_HIP,
    COCO_RIGHT_KNEE,
    COCO_RIGHT_SHOULDER,
    COCO_RIGHT_WRIST,
    Keypoint,
    PostureMetrics,
)
from vision_node.spatial_mapping import PersonDetection
from vision_node.state_machine import DeskStatus

# Conexiones anatómicas del esqueleto COCO 17
COCO_SKELETON_PAIRS = [
    (COCO_NOSE, COCO_LEFT_EAR),
    (COCO_NOSE, COCO_RIGHT_EAR),
    (COCO_LEFT_SHOULDER, COCO_RIGHT_SHOULDER),
    (COCO_LEFT_SHOULDER, COCO_LEFT_ELBOW),
    (COCO_LEFT_ELBOW, COCO_LEFT_WRIST),
    (COCO_RIGHT_SHOULDER, COCO_RIGHT_ELBOW),
    (COCO_RIGHT_ELBOW, COCO_RIGHT_WRIST),
    (COCO_LEFT_SHOULDER, COCO_LEFT_HIP),
    (COCO_RIGHT_SHOULDER, COCO_RIGHT_HIP),
    (COCO_LEFT_HIP, COCO_RIGHT_HIP),
    (COCO_LEFT_HIP, COCO_LEFT_KNEE),
    (COCO_RIGHT_HIP, COCO_RIGHT_KNEE),
]

# Códigos de color BGR por estado
STATUS_COLORS = {
    DeskStatus.CORRECTO: (50, 180, 50),       # Verde
    DeskStatus.EN_OBSERVACION: (30, 160, 255), # Ámbar / Naranja
    DeskStatus.ALERTA_ACTIVA: (40, 40, 230),   # Rojo
    DeskStatus.SIN_OCUPAR: (140, 140, 140),    # Gris claro
    DeskStatus.SIN_DATOS: (70, 70, 70),        # Gris oscuro
}

STATUS_LABELS = {
    DeskStatus.CORRECTO: "Correcto",
    DeskStatus.EN_OBSERVACION: "En Observación",
    DeskStatus.ALERTA_ACTIVA: "ALERTA",
    DeskStatus.SIN_OCUPAR: "Sin Ocupar",
    DeskStatus.SIN_DATOS: "Sin Señal",
}


def draw_debug_overlay(
    frame: np.ndarray,
    desks: Sequence[DeskZone],
    desk_statuses: Dict[str, DeskStatus],
    desk_metrics: Dict[str, Optional[PostureMetrics]],
    desk_matches: Dict[str, Optional[PersonDetection]],
    passersby: Sequence[PersonDetection],
    fps: float,
    camera_id: str,
) -> np.ndarray:
    """Superpone información de escritorios, posturas y estados sobre una copia del frame."""
    canvas = frame.copy()
    h, w = canvas.shape[:2]

    # 1. Dibujar Zonas de Escritorios (ROIs)
    for desk in desks:
        if not desk.participating or len(desk.roi_polygon) < 3:
            continue

        status = desk_statuses.get(desk.desk_id, DeskStatus.SIN_DATOS)
        color = STATUS_COLORS.get(status, (120, 120, 120))

        # Convertir polígono normalizado a píxeles
        pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in desk.roi_polygon], np.int32)
        pts = pts.reshape((-1, 1, 2))

        # Relleno semitransparente
        overlay = canvas.copy()
        cv2.fillPoly(overlay, [pts], color)
        cv2.addWeighted(overlay, 0.18, canvas, 0.82, 0, canvas)

        # Borde
        border_thickness = 3 if status == DeskStatus.ALERTA_ACTIVA else 2
        cv2.polylines(canvas, [pts], isClosed=True, color=color, thickness=border_thickness)

        # Etiqueta de escritorio y estado
        label_text = f"{desk.label or desk.desk_id}: {STATUS_LABELS.get(status, status.value)}"
        top_left = pts[0][0]
        cv2.putText(
            canvas,
            label_text,
            (top_left[0] + 5, max(20, top_left[1] - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
        )

        # Métricas posturales asociadas
        metrics = desk_metrics.get(desk.desk_id)
        if metrics and metrics.is_valid:
            t_str = f"{metrics.trunk_angle:.0f} deg" if metrics.trunk_angle is not None else "--"
            n_str = f"{metrics.neck_angle:.0f} deg" if metrics.neck_angle is not None else "--"
            s_str = f"{metrics.shoulder_diff:.2f}" if metrics.shoulder_diff is not None else "--"
            sub_text = f"T:{t_str} | C:{n_str} | H:{s_str}"
            cv2.putText(
                canvas,
                sub_text,
                (top_left[0] + 5, top_left[1] + 18),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (240, 240, 240),
                1,
            )

    # 2. Dibujar Esqueletos de personas evaluadas en escritorios
    for desk_id, detection in desk_matches.items():
        if detection is None:
            continue
        status = desk_statuses.get(desk_id, DeskStatus.CORRECTO)
        color = STATUS_COLORS.get(status, (0, 255, 0))
        _draw_skeleton(canvas, detection.keypoints, color, detection.track_id)

    # 3. Personas de paso (fuera de escritorios) dibujadas en gris tenue
    for passer in passersby:
        _draw_skeleton(canvas, passer.keypoints, (100, 100, 100), passer.track_id, is_dim=True)

    # 4. Barra de estado superior
    cv2.rectangle(canvas, (0, 0), (w, 32), (20, 20, 20), -1)
    status_summary = (
        f"Cam: {camera_id} | FPS: {fps:.1f} | "
        f"Puestos: {len(desks)} | "
        f"Alertas: {sum(1 for s in desk_statuses.values() if s == DeskStatus.ALERTA_ACTIVA)}"
    )
    cv2.putText(
        canvas,
        status_summary,
        (12, 22),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (220, 220, 220),
        1,
    )

    return canvas


def _draw_skeleton(
    canvas: np.ndarray,
    keypoints: List[Keypoint],
    color: Tuple[int, int, int],
    track_id: Optional[int],
    is_dim: bool = False,
) -> None:
    """Dibuja articulaciones y huesos del esqueleto."""
    min_conf = 0.35
    thickness = 1 if is_dim else 2

    # Líneas
    for idx1, idx2 in COCO_SKELETON_PAIRS:
        if idx1 < len(keypoints) and idx2 < len(keypoints):
            p1 = keypoints[idx1]
            p2 = keypoints[idx2]
            if p1.conf >= min_conf and p2.conf >= min_conf:
                cv2.line(
                    canvas,
                    (int(p1.x), int(p1.y)),
                    (int(p2.x), int(p2.y)),
                    color,
                    thickness,
                )

    # Nodos
    radius = 2 if is_dim else 4
    for p in keypoints:
        if p.conf >= min_conf:
            cv2.circle(canvas, (int(p.x), int(p.y)), radius, color, -1)

    # Etiqueta de ID de tracking sobre la cabeza
    if track_id is not None and len(keypoints) > COCO_NOSE:
        nose = keypoints[COCO_NOSE]
        if nose.conf >= min_conf:
            txt = f"ID:{track_id}" if not is_dim else f"Paso:{track_id}"
            cv2.putText(
                canvas,
                txt,
                (int(nose.x) - 15, int(nose.y) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                color,
                1,
            )
