"""Herramienta de calibración para configuración espacial (ROIs) y de umbrales posturales.

Permite:
1. Dibujar interactivamente las zonas de escritorios sobre un fotograma de la cámara.
2. Calibrar umbrales específicos para cámaras en ángulos no frontales (postura correcta vs encorvada).
3. Guardar la configuración directamente en config.json.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import List, Tuple
import cv2
import numpy as np

from vision_node.config import DeskThresholds, DeskZone, VisionNodeConfig
from vision_node.detector import YOLOPoseTracker
from vision_node.geometry import calculate_posture_metrics


def calibrate_rois_interactive(config_path: str = "config.json") -> None:
    """Modo interactivo para dibujar polígonos de escritorios."""
    cfg = VisionNodeConfig.load_from_file(config_path)

    print("\n--- Calibración Espacial de Escritorios ---")
    print(f"Abriendo fuente: {cfg.camera.source}")

    src = int(cfg.camera.source) if str(cfg.camera.source).isdigit() else cfg.camera.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"Error: no se pudo abrir la cámara {cfg.camera.source}")
        return

    ret, frame = cap.read()
    cap.release()
    if not ret or frame is None:
        print("Error: no se pudo capturar un fotograma de prueba.")
        return

    h, w = frame.shape[:2]
    current_pts: List[Tuple[int, int]] = []
    window_name = "Calibracion Espacial - Click: agregar vertice | c: guardar desk | q: salir"

    def mouse_callback(event: int, x: int, y: int, flags: int, param: None) -> None:
        if event == cv2.EVENT_LBUTTONDOWN:
            current_pts.append((x, y))

    cv2.namedWindow(window_name)
    cv2.setMouseCallback(window_name, mouse_callback)

    new_desks: List[DeskZone] = list(cfg.desks)

    while True:
        display = frame.copy()

        # Dibujar escritorios ya existentes
        for d in new_desks:
            pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in d.roi_polygon], np.int32)
            cv2.polylines(display, [pts], True, (0, 255, 0), 2)
            cv2.putText(display, d.label or d.desk_id, (pts[0][0], pts[0][1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        # Dibujar polígono en curso
        if len(current_pts) > 1:
            pts_cur = np.array(current_pts, np.int32)
            cv2.polylines(display, [pts_cur], False, (0, 165, 255), 2)
        for pt in current_pts:
            cv2.circle(display, pt, 4, (0, 0, 255), -1)

        cv2.imshow(window_name, display)
        key = cv2.waitKey(30) & 0xFF

        if key == ord("q"):
            break

        elif key == ord("r"):
            current_pts.clear()
            print("Vértices reiniciados.")

        elif key == ord("c"):
            if len(current_pts) < 3:
                print("Se requieren al menos 3 vértices para formar un polígono.")
                continue

            desk_num = len(new_desks) + 1
            desk_id = f"desk_{desk_num:02d}"
            label = f"Escritorio {desk_num}"

            # Normalizar coordenadas [0, 1]
            norm_polygon = [[round(px / w, 4), round(py / h, 4)] for px, py in current_pts]

            new_desk = DeskZone(
                desk_id=desk_id,
                label=label,
                roi_polygon=norm_polygon,
                thresholds=DeskThresholds(),
            )
            new_desks.append(new_desk)
            print(f"¡Registrado {label} con {len(norm_polygon)} vértices!")
            current_pts.clear()

    cv2.destroyAllWindows()

    if len(new_desks) > len(cfg.desks):
        cfg.desks = new_desks
        cfg.save_to_file(config_path)
        print(f"Configuración guardada en {config_path}. Total escritorios: {len(cfg.desks)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Calibrador interactivo para Vision Node")
    parser.add_argument("--config", default="config.json", help="Ruta al archivo de configuración")
    parser.add_argument("--mode", choices=["spatial", "thresholds"], default="spatial", help="Modo de calibración")
    args = parser.parse_args()

    if args.mode == "spatial":
        calibrate_rois_interactive(args.config)


if __name__ == "__main__":
    main()
