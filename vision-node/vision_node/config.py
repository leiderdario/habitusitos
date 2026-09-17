"""Configuración tipada y esquemas de validación con Pydantic para vision-node."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional, Tuple, Union
from pydantic import BaseModel, Field


class CameraConfig(BaseModel):
    """Configuración de la fuente de video y captura."""
    camera_id: str = Field(default="cam_01", description="Identificador único de la cámara")
    name: str = Field(default="Cámara Principal", description="Nombre descriptivo")
    source: Union[int, str] = Field(default=0, description="Índice de webcam, ruta de video o URL RTSP")
    target_fps: float = Field(default=3.0, ge=1.0, le=30.0, description="Tasa de muestreo objetivo (2-5 FPS recomendado)")
    min_keypoint_confidence: float = Field(default=0.35, ge=0.0, le=1.0, description="Umbral mínimo de visibilidad/confianza de keypoints")


class DeskThresholds(BaseModel):
    """Umbrales posturales calibrados para un escritorio y ángulo de cámara específicos."""
    trunk_max_angle: float = Field(default=25.0, description="Ángulo máximo admisible de inclinación de tronco (grados)")
    neck_max_angle: float = Field(default=30.0, description="Ángulo máximo admisible de proyección de cuello (grados)")
    shoulder_diff_max: float = Field(default=0.06, description="Desnivel máximo entre hombros (fracción normalizada de altura o metros)")


class DeskZone(BaseModel):
    """Definición espacial (ROI) y parámetros de un puesto de trabajo."""
    desk_id: str = Field(..., description="Identificador único del escritorio")
    label: str = Field(default="", description="Etiqueta visible (ej. Escritorio 1)")
    # Polígono normalizado en coordenadas [0.0, 1.0] respecto al ancho y alto del frame: [[x1, y1], [x2, y2], ...]
    roi_polygon: List[List[float]] = Field(default_factory=list, description="Vértices del polígono normalizado [x, y]")
    thresholds: DeskThresholds = Field(default_factory=DeskThresholds, description="Umbrales calibrados")
    employee_name: Optional[str] = Field(default=None, description="Nombre de empleado (opcional, confidencial)")
    participating: bool = Field(default=True, description="Si False, se excluye del análisis por consentimiento informado")


class HysteresisConfig(BaseModel):
    """Parámetros de la máquina de estados temporal para evitar falsos positivos."""
    sustained_seconds: float = Field(default=20.0, ge=1.0, description="Segundos continuos en mala postura para disparar alerta")
    reminder_seconds: float = Field(default=60.0, ge=5.0, description="Frecuencia de re-notificación si persiste la mala postura")
    unoccupied_seconds_threshold: float = Field(default=5.0, ge=1.0, description="Segundos sin detección para marcar sin_ocupar")


class VisionNodeConfig(BaseModel):
    """Configuración integral del nodo de visión."""
    camera: CameraConfig = Field(default_factory=CameraConfig)
    desks: List[DeskZone] = Field(default_factory=list)
    hysteresis: HysteresisConfig = Field(default_factory=HysteresisConfig)
    model_name: str = Field(default="yolo11n-pose.pt", description="Modelo YOLO-pose a utilizar (ej. yolo11n-pose.pt o yolov8n-pose.pt)")
    show_visualizer: bool = Field(default=True, description="Mostrar ventana con superposición visual de depuración")
    events_output_file: Optional[str] = Field(default="events.jsonl", description="Ruta de archivo para registrar eventos JSON")

    @classmethod
    def load_from_file(cls, path: Union[str, Path]) -> VisionNodeConfig:
        file_path = Path(path)
        if not file_path.exists():
            # Retorna configuración por defecto
            return cls()
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.model_validate(data)

    def save_to_file(self, path: Union[str, Path]) -> None:
        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(self.model_dump_json(indent=2))
