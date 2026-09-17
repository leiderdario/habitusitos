"""Módulo de captura de video con selección resiliente de backend y reconexión automática.

Soporta webcams USB, archivos de video de prueba y streams RTSP de cámaras IP.
Detecta automáticamente el backend óptimo en Windows (DirectShow, Any, MSMF)
y se recupera de desconexiones o bloqueos temporales de dispositivo.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np

logger = logging.getLogger("vision-node.camera")


def open_capture_device(source: Union[int, str]) -> Optional[cv2.VideoCapture]:
    """Abre un recurso de video probando los mejores backends disponibles en el sistema operativo."""
    if isinstance(source, str) and source.isdigit():
        src: Union[int, str] = int(source)
    else:
        src = source

    if isinstance(src, str) and (src.startswith("rtsp://") or src.startswith("http://")):
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
        cap = cv2.VideoCapture(src)
        if cap.isOpened():
            return cap
        return None

    if isinstance(src, int) and sys.platform.startswith("win"):
        # En Windows, algunas cámaras USB requieren DirectShow y otras Any / MSMF.
        # Probamos en orden de mayor compatibilidad y menor latencia:
        for backend in (cv2.CAP_DSHOW, cv2.CAP_ANY, cv2.CAP_MSMF):
            try:
                cap = cv2.VideoCapture(src, backend)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        return cap
                cap.release()
            except Exception:
                pass
        return None

    cap = cv2.VideoCapture(src)
    if cap.isOpened():
        return cap
    return None


def scan_available_cameras(max_tested: int = 4) -> List[Dict[str, Any]]:
    """Escanea los índices de video locales para detectar webcams disponibles."""
    camaras: List[Dict[str, Any]] = []
    for i in range(max_tested):
        cap = open_capture_device(i)
        if cap is not None:
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            camaras.append({
                "id": i,
                "nombre": f"Cámara local {i} ({w}x{h})" if w > 0 else f"Cámara local {i}",
                "tipo": "local",
            })
            cap.release()
    return camaras


class CameraCapture:
    """Capturador optimizado para streaming fluido y visión en tiempo real."""

    def __init__(
        self,
        source: Union[int, str] = 0,
        target_fps: float = 25.0,
        loop_video: bool = True,
        on_frame_callback: Optional[Callable[[np.ndarray], None]] = None,
    ):
        self.source = source
        self.target_fps = max(5.0, min(60.0, target_fps))
        self.frame_interval = 1.0 / self.target_fps
        self.loop_video = loop_video
        self.on_frame_callback = on_frame_callback

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_connected = False
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_timestamp: float = 0.0
        self.frame_width = 640
        self.frame_height = 480
        self.is_file = isinstance(source, str) and not source.startswith("rtsp://") and not source.startswith("http://")
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None
        self.running = False
        self._last_cb_time: float = 0.0

    def open(self) -> bool:
        """Abre el stream o dispositivo de video e inicia el hilo de lectura."""
        self.cap = open_capture_device(self.source)

        if not self.cap or not self.cap.isOpened():
            logger.warning(f"No se pudo abrir la fuente de video: {self.source}")
            self.is_connected = False
            return False

        self.is_connected = True
        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if w > 0 and h > 0:
            self.frame_width = w
            self.frame_height = h

        self.running = True
        self.thread = threading.Thread(target=self._capture_worker, daemon=True)
        self.thread.start()

        # Esperar hasta 1.5s a que el hilo capture el primer frame
        t_espera = time.time()
        while time.time() - t_espera < 1.5 and self.latest_frame is None:
            time.sleep(0.02)

        return True

    def _reconnect(self) -> None:
        """Intenta reabrir la fuente si hubo fallos de lectura continuos."""
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

        time.sleep(0.5)
        if not self.running:
            return

        new_cap = open_capture_device(self.source)
        if new_cap is not None and new_cap.isOpened():
            self.cap = new_cap
            self.is_connected = True
            logger.info(f"Reconexión exitosa a la cámara {self.source}")
        else:
            self.is_connected = False

    def _capture_worker(self) -> None:
        """Lee fotogramas de la cámara a máxima velocidad sin rezago."""
        fail_count = 0

        while self.running:
            if not self.cap or not self.cap.isOpened():
                time.sleep(0.5)
                if self.running:
                    self._reconnect()
                continue

            ret, frame = self.cap.read()
            if not ret or frame is None:
                if self.is_file and self.loop_video:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()

                if not ret or frame is None:
                    fail_count += 1
                    self.is_connected = False
                    if fail_count >= 15:
                        logger.warning("Múltiples fallos consecutivos de captura. Reintentando...")
                        self._reconnect()
                        fail_count = 0
                    else:
                        time.sleep(0.04)
                    continue

            fail_count = 0
            now = time.time()
            self.is_connected = True
            with self.lock:
                self.latest_frame = frame
                self.latest_timestamp = now

            if self.on_frame_callback and (now - self._last_cb_time >= 0.045):
                self._last_cb_time = now
                try:
                    self.on_frame_callback(frame)
                except Exception:
                    pass

            time.sleep(0.01)

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray], float]:
        """Obtiene de forma no bloqueante el fotograma más reciente capturado."""
        if not self.is_connected:
            return False, None, time.time()
        with self.lock:
            if self.latest_frame is not None:
                return True, self.latest_frame.copy(), self.latest_timestamp
        return False, None, time.time()

    def release(self) -> None:
        """Libera el recurso de captura y detiene el hilo."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=0.6)
            self.thread = None
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.is_connected = False
        with self.lock:
            self.latest_frame = None
