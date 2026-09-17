"""Detector y tracker multi-persona basado en Ultralytics YOLO-pose (COCO 17 keypoints).

Extrae keypoints corporales y mantiene la identidad de cada persona mediante ByteTrack / BoT-SORT.
"""

from __future__ import annotations

import logging
from typing import List, Optional
import numpy as np

from vision_node.geometry import Keypoint
from vision_node.spatial_mapping import PersonDetection

logger = logging.getLogger(__name__)


def _calculate_iou(boxA: tuple, boxB: tuple) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(1e-5, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(1e-5, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))
    return interArea / float(boxAArea + boxBArea - interArea)


class YOLOPoseTracker:
    """Wrapper para inferencia y tracking continuo con YOLO11-pose o YOLOv8-pose."""

    def __init__(
        self,
        model_name: str = "yolo11n-pose.pt",
        min_detection_conf: float = 0.40,
        tracker_type: str = "bytetrack.yaml",
        device: Optional[str] = None,
    ):
        self.model_name = model_name
        self.min_detection_conf = min_detection_conf
        self.tracker_type = tracker_type
        self.device = device
        self.model = None
        self._load_model()

    def _load_model(self) -> None:
        try:
            from pathlib import Path
            from ultralytics import YOLO

            model_path = Path(self.model_name)
            if not model_path.exists():
                parent_model = Path(__file__).resolve().parent.parent.parent / self.model_name
                if parent_model.exists():
                    model_path = parent_model

            logger.info(f"Cargando modelo YOLO-pose: {model_path}")
            self.model = YOLO(str(model_path))
        except Exception as e:
            logger.error(f"No se pudo inicializar Ultralytics YOLO ({e}).")
            self.model = None

    def track(self, frame: np.ndarray) -> List[PersonDetection]:
        """Ejecuta detección y tracking sobre un fotograma.

        Retorna una lista de PersonDetection con sus keypoints COCO y track_id.
        """
        if self.model is None:
            return []

        try:
            results = self.model.track(
                source=frame,
                persist=True,
                tracker=self.tracker_type,
                conf=self.min_detection_conf,
                imgsz=384,
                verbose=False,
                device=self.device,
            )
        except Exception as e:
            logger.warning(f"Error durante inferencia/tracking: {e}")
            return []

        if not results or len(results) == 0:
            return []

        res = results[0]
        detections: List[PersonDetection] = []

        if res.keypoints is None or res.boxes is None:
            return []

        xy_tensor = res.keypoints.xy.cpu().numpy() if res.keypoints.xy is not None else []
        conf_tensor = (
            res.keypoints.conf.cpu().numpy()
            if res.keypoints.conf is not None
            else np.ones((len(xy_tensor), 17))
        )
        boxes = res.boxes

        for i in range(len(xy_tensor)):
            # Track ID
            track_id = None
            if boxes.id is not None:
                track_id = int(boxes.id[i].item())

            # Bounding box
            bbox = None
            if boxes.xyxy is not None and len(boxes.xyxy) > i:
                xyxy = boxes.xyxy[i].cpu().numpy()
                bbox = (float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3]))

            det_conf = float(boxes.conf[i].item()) if boxes.conf is not None else 1.0

            # Keypoints COCO 17
            kpts_list: List[Keypoint] = []
            for j in range(len(xy_tensor[i])):
                kx = float(xy_tensor[i][j][0])
                ky = float(xy_tensor[i][j][1])
                kconf = float(conf_tensor[i][j]) if conf_tensor is not None and len(conf_tensor) > i else 1.0
                kpts_list.append(Keypoint(x=kx, y=ky, conf=kconf))

            detections.append(
                PersonDetection(
                    track_id=track_id,
                    keypoints=kpts_list,
                    bbox=bbox,
                    confidence=det_conf,
                )
            )

        # Deduplicación por IoU: suprimir bboxes superpuestos para evitar siluetas fantasma
        detections.sort(key=lambda d: d.confidence, reverse=True)
        deduped: List[PersonDetection] = []
        for det in detections:
            if det.bbox is None:
                deduped.append(det)
                continue
            is_dup = False
            for kept in deduped:
                if kept.bbox is not None and _calculate_iou(det.bbox, kept.bbox) > 0.40:
                    is_dup = True
                    break
            if not is_dup:
                deduped.append(det)

        return deduped
