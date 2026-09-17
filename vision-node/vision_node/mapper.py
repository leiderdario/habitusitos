"""Mapeo de keypoints COCO-17 (YOLO-pose) a formato BlazePose de 33 puntos.

Permite que el frontend consuma detecciones multi-persona directamente
sin modificar la estructura ni los indices que espera puntaje.ts.
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence
from vision_node.geometry import Keypoint

# Mapeo directo: COCO_INDEX -> BLAZEPOSE_INDEX
COCO_TO_BLAZEPOSE_MAP = {
    0: 0,   # Nariz
    1: 2,   # Ojo izq
    2: 5,   # Ojo der
    3: 7,   # Oreja izq
    4: 8,   # Oreja der
    5: 11,  # Hombro izq
    6: 12,  # Hombro der
    7: 13,  # Codo izq
    8: 14,  # Codo der
    9: 15,  # Muñeca izq
    10: 16, # Muñeca der
    11: 23, # Cadera izq
    12: 24, # Cadera der
    13: 25, # Rodilla izq
    14: 26, # Rodilla der
    15: 27, # Tobillo izq
    16: 28, # Tobillo der
}


def coco_to_blazepose_landmarks(
    coco_kpts: Sequence[Keypoint],
    frame_width: int,
    frame_height: int,
) -> List[Dict[str, float]]:
    """Convierte 17 keypoints COCO en una lista de 33 landmarks formato BlazePose normalizados [0, 1]."""
    w = max(1, frame_width)
    h = max(1, frame_height)

    # 33 landmarks vacíos por defecto
    blazepose_landmarks = [
        {"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0} for _ in range(33)
    ]

    for coco_idx, bp_idx in COCO_TO_BLAZEPOSE_MAP.items():
        if coco_idx < len(coco_kpts):
            kp = coco_kpts[coco_idx]
            # Calibrar visibilidad: YOLO conf >= 0.25 se escala al rango de visibilidad esperado
            vis = min(1.0, kp.conf * 1.35) if kp.conf >= 0.25 else kp.conf
            blazepose_landmarks[bp_idx] = {
                "x": round(kp.x / w, 4),
                "y": round(kp.y / h, 4),
                "z": 0.0,
                "visibility": round(vis, 3),
            }

    # 1. Recuperación de oreja oculta por giro leve de cabeza (simetría respecto a la nariz)
    if len(coco_kpts) > 4:
        nariz_k = coco_kpts[0]
        oreja_izq_k = coco_kpts[3]
        oreja_der_k = coco_kpts[4]

        if nariz_k.conf >= 0.25:
            nx = blazepose_landmarks[0]["x"]
            ny = blazepose_landmarks[0]["y"]

            # Si oreja izquierda visible pero derecha no
            if oreja_izq_k.conf >= 0.25 and oreja_der_k.conf < 0.25:
                ox = blazepose_landmarks[7]["x"]
                oy = blazepose_landmarks[7]["y"]
                blazepose_landmarks[8] = {
                    "x": round(2 * nx - ox, 4),
                    "y": oy,
                    "z": 0.0,
                    "visibility": 0.65,
                }
            # Si oreja derecha visible pero izquierda no
            elif oreja_der_k.conf >= 0.25 and oreja_izq_k.conf < 0.25:
                ox = blazepose_landmarks[8]["x"]
                oy = blazepose_landmarks[8]["y"]
                blazepose_landmarks[7] = {
                    "x": round(2 * nx - ox, 4),
                    "y": oy,
                    "z": 0.0,
                    "visibility": 0.65,
                }

    # 2. Estimación sagital Z de la cabeza (avance de nariz respecto a orejas)
    if blazepose_landmarks[7]["visibility"] >= 0.3 and blazepose_landmarks[8]["visibility"] >= 0.3:
        oreja_y_media = (blazepose_landmarks[7]["y"] + blazepose_landmarks[8]["y"]) / 2.0
        nariz_y = blazepose_landmarks[0]["y"]
        # Inclinación hacia adelante: la nariz baja en Y y avanza en Z
        dz_estimado = max(0.0, (nariz_y - oreja_y_media) * 0.8)
        blazepose_landmarks[0]["z"] = round(-dz_estimado, 4)

    # 3. Soporte para personas sentadas frente a escritorio (caderas ocluidas por la mesa)
    # Si ambos hombros son visibles pero las caderas están ocultas bajo el escritorio,
    # proyectamos las caderas verticalmente hacia abajo para permitir calcular la alineación del torso.
    if blazepose_landmarks[11]["visibility"] >= 0.35 and blazepose_landmarks[12]["visibility"] >= 0.35:
        h_izq = blazepose_landmarks[11]
        h_der = blazepose_landmarks[12]
        dist_hombros = max(0.12, abs(h_der["x"] - h_izq["x"]))
        largo_torso = dist_hombros * 1.35

        if blazepose_landmarks[23]["visibility"] < 0.3:
            blazepose_landmarks[23] = {
                "x": h_izq["x"],
                "y": round(min(1.0, h_izq["y"] + largo_torso), 4),
                "z": 0.0,
                "visibility": 0.70,
            }
        if blazepose_landmarks[24]["visibility"] < 0.3:
            blazepose_landmarks[24] = {
                "x": h_der["x"],
                "y": round(min(1.0, h_der["y"] + largo_torso), 4),
                "z": 0.0,
                "visibility": 0.70,
            }

    # 4. Sintetizar comisuras bucales aproximadas (BlazePose 9 y 10)
    if blazepose_landmarks[0]["visibility"] >= 0.3:
        nx, ny = blazepose_landmarks[0]["x"], blazepose_landmarks[0]["y"]
        blazepose_landmarks[9] = {"x": round(nx - 0.015, 4), "y": round(ny + 0.02, 4), "z": 0.0, "visibility": 0.7}
        blazepose_landmarks[10] = {"x": round(nx + 0.015, 4), "y": round(ny + 0.02, 4), "z": 0.0, "visibility": 0.7}

    return blazepose_landmarks
