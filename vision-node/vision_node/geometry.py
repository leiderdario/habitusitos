"""Cálculos geométricos y métricas de postura sobre keypoints COCO 17.

Reutiliza y adapta la lógica matemática validada en el prototipo mono-persona
(caderas -> hombros, hombros -> cabeza), con compuerta de confianza y tolerancia a oclusiones.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple


# Índices del estándar COCO 17
COCO_NOSE = 0
COCO_LEFT_EYE = 1
COCO_RIGHT_EYE = 2
COCO_LEFT_EAR = 3
COCO_RIGHT_EAR = 4
COCO_LEFT_SHOULDER = 5
COCO_RIGHT_SHOULDER = 6
COCO_LEFT_ELBOW = 7
COCO_RIGHT_ELBOW = 8
COCO_LEFT_WRIST = 9
COCO_RIGHT_WRIST = 10
COCO_LEFT_HIP = 11
COCO_RIGHT_HIP = 12
COCO_LEFT_KNEE = 13
COCO_RIGHT_KNEE = 14
COCO_LEFT_ANKLE = 15
COCO_RIGHT_ANKLE = 16


@dataclass
class Keypoint:
    x: float
    y: float
    conf: float = 1.0


@dataclass
class PostureMetrics:
    trunk_angle: Optional[float] = None          # Grados de inclinación del tronco respecto a la vertical
    neck_angle: Optional[float] = None           # Grados de inclinación del cuello/cabeza respecto a la vertical
    shoulder_diff: Optional[float] = None        # Desnivel normalizado entre hombros (0 a 1)
    shoulder_tilt_angle: Optional[float] = None  # Grados de inclinación de hombros con la horizontal
    is_valid: bool = False                       # True si los keypoints esenciales fueron suficientemente confiables
    reason_invalid: Optional[str] = None
    is_correct: Optional[bool] = None            # True si cumple todos los umbrales configurados


def distance_2d(p1: Keypoint, p2: Keypoint) -> float:
    """Distancia euclidiana 2D entre dos puntos."""
    return math.hypot(p1.x - p2.x, p1.y - p2.y)


def midpoint(p1: Keypoint, p2: Keypoint) -> Keypoint:
    """Punto medio entre dos keypoints."""
    return Keypoint(
        x=(p1.x + p2.x) / 2.0,
        y=(p1.y + p2.y) / 2.0,
        conf=min(p1.conf, p2.conf),
    )


def angle_with_vertical(p_from: Keypoint, p_to: Keypoint) -> float:
    """Calcula el ángulo en grados del vector (p_from -> p_to) respecto a la vertical hacia arriba.

    En coordenadas de imagen (origen arriba a la izquierda), el vector vertical hacia arriba
    es (dx=0, dy=-1).
    """
    dx = p_to.x - p_from.x
    dy = p_to.y - p_from.y
    length = math.hypot(dx, dy)
    if length < 1e-6:
        return 0.0

    # Vector unitario
    ux = dx / length
    uy = dy / length

    # Producto punto con el vector hacia arriba (0, -1)
    # dot = ux*0 + uy*(-1) = -uy
    cos_theta = -uy
    cos_theta = max(-1.0, min(1.0, cos_theta))
    return math.degrees(math.acos(cos_theta))


def calculate_posture_metrics(
    kpts: Sequence[Keypoint],
    min_conf: float = 0.35,
    trunk_max_angle: Optional[float] = None,
    neck_max_angle: Optional[float] = None,
    shoulder_diff_max: Optional[float] = None,
) -> PostureMetrics:
    """Calcula los tres ángulos posturales fundamentales: tronco, cuello y hombros.

    Aplica compuerta de confianza: si los puntos necesarios tienen confianza inferior a min_conf,
    se marca como no evaluable para evitar clasificaciones erróneas por oclusión parcial.
    """
    if len(kpts) < 13:
        return PostureMetrics(
            is_valid=False,
            reason_invalid="Menos de 13 keypoints disponibles",
        )

    sh_l = kpts[COCO_LEFT_SHOULDER]
    sh_r = kpts[COCO_RIGHT_SHOULDER]

    # Hombros indispensables
    if sh_l.conf < min_conf or sh_r.conf < min_conf:
        return PostureMetrics(
            is_valid=False,
            reason_invalid="Hombros ocluidos o con baja confianza",
        )

    # Punto medio de hombros
    mid_shoulders = midpoint(sh_l, sh_r)

    # 1. Hombros: desnivel y ángulo
    shoulder_width = distance_2d(sh_l, sh_r)
    shoulder_diff = 0.0
    shoulder_tilt = 0.0
    if shoulder_width > 1e-4:
        # Desnivel relativo al ancho de hombros (invariante a escala)
        shoulder_diff = abs(sh_l.y - sh_r.y) / shoulder_width
        shoulder_diff = min(1.0, shoulder_diff)
        shoulder_tilt = math.degrees(math.asin(min(1.0, shoulder_diff)))

    # 2. Cuello / Cabeza
    # Referencia craneal: punto medio de orejas si ambas son visibles,
    # o nariz + una oreja, o solo nariz
    ear_l = kpts[COCO_LEFT_EAR]
    ear_r = kpts[COCO_RIGHT_EAR]
    nose = kpts[COCO_NOSE]

    head_ref: Optional[Keypoint] = None
    if ear_l.conf >= min_conf and ear_r.conf >= min_conf:
        head_ref = midpoint(ear_l, ear_r)
    elif nose.conf >= min_conf:
        head_ref = nose
    elif ear_l.conf >= min_conf:
        head_ref = ear_l
    elif ear_r.conf >= min_conf:
        head_ref = ear_r

    neck_angle: Optional[float] = None
    if head_ref is not None:
        # Vector: mid_shoulders -> head_ref (hacia arriba)
        neck_angle = angle_with_vertical(mid_shoulders, head_ref)

    # 3. Tronco / Columna
    # Referencia de caderas: punto medio de cadera izq y der
    hip_l = kpts[COCO_LEFT_HIP]
    hip_r = kpts[COCO_RIGHT_HIP]

    trunk_angle: Optional[float] = None
    if hip_l.conf >= min_conf and hip_r.conf >= min_conf:
        mid_hips = midpoint(hip_l, hip_r)
        # Vector: mid_hips -> mid_shoulders (hacia arriba)
        trunk_angle = angle_with_vertical(mid_hips, mid_shoulders)
    elif hip_l.conf >= min_conf:
        trunk_angle = angle_with_vertical(hip_l, sh_l)
    elif hip_r.conf >= min_conf:
        trunk_angle = angle_with_vertical(hip_r, sh_r)

    # Si no tenemos cuello ni tronco válidos, no hay suficientes datos
    if neck_angle is None and trunk_angle is None:
        return PostureMetrics(
            shoulder_diff=shoulder_diff,
            shoulder_tilt_angle=shoulder_tilt,
            is_valid=False,
            reason_invalid="Cabeza y caderas ocluidas simultáneamente",
        )

    # Evaluación de corrección postural frente a umbrales si se proporcionaron
    is_correct = True
    if trunk_max_angle is not None and trunk_angle is not None:
        if trunk_angle > trunk_max_angle:
            is_correct = False
    if neck_max_angle is not None and neck_angle is not None:
        if neck_angle > neck_max_angle:
            is_correct = False
    if shoulder_diff_max is not None and shoulder_diff is not None:
        if shoulder_diff > shoulder_diff_max:
            is_correct = False

    return PostureMetrics(
        trunk_angle=round(trunk_angle, 2) if trunk_angle is not None else None,
        neck_angle=round(neck_angle, 2) if neck_angle is not None else None,
        shoulder_diff=round(shoulder_diff, 4),
        shoulder_tilt_angle=round(shoulder_tilt, 2),
        is_valid=True,
        is_correct=is_correct if (trunk_max_angle is not None or neck_max_angle is not None) else None,
    )
