"""Mapeo espacial de personas detectadas hacia escritorios (ROIs).

Asocia cada detección a un escritorio según su posición espacial (punto de anclaje),
sin reconocimiento facial ni identificación biométrica. Maneja descarte de personas
de paso y desempate si hay más de una persona en la zona.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from vision_node.config import DeskZone
from vision_node.geometry import (
    COCO_LEFT_HIP,
    COCO_LEFT_SHOULDER,
    COCO_RIGHT_HIP,
    COCO_RIGHT_SHOULDER,
    Keypoint,
    midpoint,
)


@dataclass
class PersonDetection:
    track_id: Optional[int]
    keypoints: List[Keypoint]
    # Bounding box en píxeles: (x1, y1, x2, y2)
    bbox: Optional[Tuple[float, float, float, float]] = None
    confidence: float = 1.0


def point_in_polygon(x: float, y: float, polygon: Sequence[Sequence[float]]) -> bool:
    """Prueba de inclusión de punto en polígono 2D mediante algoritmo Ray Casting (paridad de cruces).

    Funciona con polígonos convexos o cóncavos. Coordenadas deben estar en la misma escala (ej. normalizadas).
    """
    n = len(polygon)
    if n < 3:
        return False

    inside = False
    p1x, p1y = polygon[0][0], polygon[0][1]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n][0], polygon[i % n][1]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside


def polygon_centroid(polygon: Sequence[Sequence[float]]) -> Tuple[float, float]:
    """Calcula el centro geométrico (centroide) aproximado de un polígono."""
    if not polygon:
        return (0.5, 0.5)
    cx = sum(p[0] for p in polygon) / len(polygon)
    cy = sum(p[1] for p in polygon) / len(polygon)
    return (cx, cy)


def get_anchor_point(
    detection: PersonDetection,
    frame_width: int,
    frame_height: int,
    min_conf: float = 0.3,
) -> Tuple[float, float]:
    """Determina el punto de anclaje de la persona en coordenadas normalizadas [0, 1].

    Prioridad:
    1. Punto medio entre caderas (ideal para persona sentada frente a un escritorio).
    2. Punto medio entre hombros (si las caderas están ocluidas detrás de la mesa).
    3. Centro del bounding box.
    """
    kpts = detection.keypoints
    w = max(1, frame_width)
    h = max(1, frame_height)

    # 1. Caderas
    if len(kpts) > COCO_RIGHT_HIP:
        hip_l = kpts[COCO_LEFT_HIP]
        hip_r = kpts[COCO_RIGHT_HIP]
        if hip_l.conf >= min_conf and hip_r.conf >= min_conf:
            mid = midpoint(hip_l, hip_r)
            return (mid.x / w, mid.y / h)
        elif hip_l.conf >= min_conf:
            return (hip_l.x / w, hip_l.y / h)
        elif hip_r.conf >= min_conf:
            return (hip_r.x / w, hip_r.y / h)

    # 2. Hombros
    if len(kpts) > COCO_RIGHT_SHOULDER:
        sh_l = kpts[COCO_LEFT_SHOULDER]
        sh_r = kpts[COCO_RIGHT_SHOULDER]
        if sh_l.conf >= min_conf and sh_r.conf >= min_conf:
            mid = midpoint(sh_l, sh_r)
            return (mid.x / w, mid.y / h)

    # 3. Bounding box
    if detection.bbox is not None:
        x1, y1, x2, y2 = detection.bbox
        cx = (x1 + x2) / 2.0 / w
        cy = (y1 + y2) / 2.0 / h
        return (cx, cy)

    return (0.0, 0.0)


def match_people_to_desks(
    detections: Sequence[PersonDetection],
    desks: Sequence[DeskZone],
    frame_width: int,
    frame_height: int,
) -> Tuple[Dict[str, Optional[PersonDetection]], List[PersonDetection]]:
    """Asocia cada escritorio a la persona detectada en su zona.

    Reglas implementadas:
    - Persona fuera de todo escritorio: clasificada como 'persona de paso' (ignorado).
    - Escritorio sin personas: retorna None para ese desk_id (sin_ocupar).
    - Escritorio con 2+ personas: asigna a la persona más cercana al centro del ROI del escritorio.
    - Escritorio marcado con participating=False: se excluye del análisis.

    Retorna:
    - Un diccionario: { desk_id: PersonDetection asignada o None }
    - Una lista de personas de paso (no asignadas a ningún escritorio activo)
    """
    desk_matches: Dict[str, Optional[PersonDetection]] = {}
    # Candidatos preliminares por escritorio: list of (dist_to_centroid, detection)
    candidates_by_desk: Dict[str, List[Tuple[float, PersonDetection]]] = {
        d.desk_id: [] for d in desks if d.participating
    }
    assigned_detection_ids = set()

    for d in desks:
        if not d.participating:
            continue
        if len(d.roi_polygon) < 3:
            continue
        centroid = polygon_centroid(d.roi_polygon)

        for det in detections:
            anchor_x, anchor_y = get_anchor_point(det, frame_width, frame_height)
            if point_in_polygon(anchor_x, anchor_y, d.roi_polygon):
                dist = math.hypot(anchor_x - centroid[0], anchor_y - centroid[1])
                candidates_by_desk[d.desk_id].append((dist, det))

    # Resolver desempates por escritorio
    for d in desks:
        if not d.participating:
            continue
        candidates = candidates_by_desk.get(d.desk_id, [])
        if not candidates:
            desk_matches[d.desk_id] = None
        else:
            # Ordenar por proximidad al centro del escritorio
            candidates.sort(key=lambda item: item[0])
            chosen = candidates[0][1]
            desk_matches[d.desk_id] = chosen
            if chosen.track_id is not None:
                assigned_detection_ids.add(chosen.track_id)

    # Identificar personas de paso
    passersby: List[PersonDetection] = []
    for det in detections:
        if det.track_id is not None:
            if det.track_id not in assigned_detection_ids:
                passersby.append(det)
        else:
            if det not in desk_matches.values():
                passersby.append(det)

    return desk_matches, passersby
