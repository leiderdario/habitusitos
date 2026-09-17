"""Servidor HTTP liviano de streaming MJPEG optimizado para alta tasa de refresco y baja latencia.

Permite ver la cámara de oficina en vivo en el elemento <img> del frontend,
con contrapresión controlada, compresión eficiente y sin bloqueo de hilos.
"""

from __future__ import annotations

import logging
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger("vision-node.stream")


class VideoStreamHandler(BaseHTTPRequestHandler):
    """Manejador HTTP para transmitir fotogramas MJPEG continuos."""

    server: VideoStreamServer

    def do_GET(self) -> None:
        if self.path in ("/", "/video_feed"):
            # Configurar TCP_NODELAY y timeout corto para evitar bloqueos del socket
            try:
                self.request.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                self.request.settimeout(2.0)
            except Exception:
                pass

            try:
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
            except Exception:
                return

            last_sent_seq = -1

            while self.server.running:
                frame_bytes, seq = self.server.wait_for_new_frame(last_sent_seq, timeout=0.2)
                if frame_bytes is None or seq == last_sent_seq:
                    continue

                try:
                    self.wfile.write(b"--frame\r\n")
                    self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                    self.wfile.write(frame_bytes)
                    self.wfile.write(b"\r\n")
                    last_sent_seq = seq
                except (BrokenPipeError, ConnectionResetError, socket.timeout, Exception):
                    # Cliente desconectado o buffer saturado; terminar este hilo de streaming
                    break
        else:
            self.send_error(404, "Ruta no encontrada")

    def log_message(self, format: str, *args) -> None:
        # Silenciar logs continuos de streaming
        return


class VideoStreamServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, host: str = "127.0.0.1", port: int = 8766):
        self.host = host
        self.port = port
        self.running = False
        self.latest_frame_bytes: Optional[bytes] = None
        self.frame_seq: int = 0
        self.condition = threading.Condition()
        self.thread: Optional[threading.Thread] = None
        super().__init__((host, port), VideoStreamHandler)

    def set_frame(self, frame_bgr: np.ndarray) -> None:
        """Comprime el fotograma BGR a JPEG de alta velocidad y notifica a los clientes."""
        if not self.running:
            return

        try:
            # Limitar tamaño máximo a 640x480 para streaming web ligero y ultra rápido
            h, w = frame_bgr.shape[:2]
            if w > 640 or h > 480:
                scale = min(640 / w, 480 / h)
                nw, nh = int(w * scale), int(h * scale)
                stream_frame = cv2.resize(frame_bgr, (nw, nh), interpolation=cv2.INTER_LINEAR)
            else:
                stream_frame = frame_bgr

            # Calidad 60: reduce el peso a ~25 KB (3x más liviano) con excelente definición
            success, encoded_image = cv2.imencode(
                ".jpg",
                stream_frame,
                [cv2.IMWRITE_JPEG_QUALITY, 60],
            )
            if success:
                bytes_data = encoded_image.tobytes()
                with self.condition:
                    self.latest_frame_bytes = bytes_data
                    self.frame_seq += 1
                    self.condition.notify_all()
        except Exception as e:
            logger.debug(f"Error comprimiendo frame para stream: {e}")

    def wait_for_new_frame(self, last_seq: int, timeout: float = 0.2) -> Tuple[Optional[bytes], int]:
        """Espera a que llegue un fotograma más reciente que last_seq de manera no bloqueante."""
        with self.condition:
            if self.frame_seq == last_seq and self.running:
                self.condition.wait(timeout=timeout)
            return self.latest_frame_bytes, self.frame_seq

    def start(self) -> None:
        if self.running:
            return
        self.running = True

        def _serve():
            logger.info(f"Servidor de video en vivo iniciado en http://{self.host}:{self.port}/video_feed")
            try:
                self.serve_forever()
            except Exception as e:
                logger.info(f"Servidor de video detenido: {e}")

        self.thread = threading.Thread(target=_serve, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.running = False
        with self.condition:
            self.condition.notify_all()
        self.shutdown()
        self.server_close()
