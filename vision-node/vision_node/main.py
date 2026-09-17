"""Punto de entrada principal para el proceso de nodo de visión (vision-node).

Orquesta:
- Captura a 2-5 FPS
- Detección y tracking YOLO-pose
- Mapeo espacial a escritorios
- Cálculo de métricas posturales
- Máquina de estados de histéresis temporal
- Publicación de eventos livianos JSON
- Superposición visual de depuración (opcional)
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import cv2

# Permitir ejecución directa desde la raíz o desde vision-node/
_package_root = str(Path(__file__).resolve().parent.parent)
if _package_root not in sys.path:
    sys.path.insert(0, _package_root)

from vision_node.camera import CameraCapture, scan_available_cameras
from vision_node.config import DeskZone, VisionNodeConfig
from vision_node.detector import YOLOPoseTracker
from vision_node.events import LocalEventPublisher, build_alert_payload, build_desk_status_payload
from vision_node.geometry import calculate_posture_metrics, PostureMetrics
from vision_node.mapper import coco_to_blazepose_landmarks
from vision_node.spatial_mapping import match_people_to_desks, PersonDetection
from vision_node.state_machine import DeskStateMachine, DeskStatus, EventType
from vision_node.visualizer import draw_debug_overlay
from vision_node.websocket_server import VisionWebSocketServer
from vision_node.stream_server import VideoStreamServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vision-node")


class VisionNodeApp:
    def __init__(self, config: VisionNodeConfig, ws_port: int = 8765):
        self.config = config
        self.stream_server = VideoStreamServer(host="127.0.0.1", port=ws_port + 1)
        self.camera = CameraCapture(
            source=config.camera.source,
            target_fps=config.camera.target_fps,
            on_frame_callback=self.stream_server.set_frame,
        )
        self.tracker = YOLOPoseTracker(
            model_name=config.model_name,
            min_detection_conf=config.camera.min_keypoint_confidence,
        )
        self.publisher = LocalEventPublisher(
            output_file=config.events_output_file,
            echo_console=True,
        )
        self.ws_server = VisionWebSocketServer(
            host="127.0.0.1",
            port=ws_port,
            action_callback=self._handle_client_action,
            connect_callback=self._handle_client_connect,
        )

        # Máquinas de estado por escritorio
        self.state_machines: Dict[str, DeskStateMachine] = {
            desk.desk_id: DeskStateMachine(desk.desk_id, config.hysteresis)
            for desk in config.desks
            if desk.participating
        }

        # Caché de escritorios por ID para acceso O(1)
        self.desks_map: Dict[str, DeskZone] = {d.desk_id: d for d in config.desks}

        self.running = False
        self.frame_count = 0
        self.fps_actual = 0.0

    def _build_info_fuentes_payload(self) -> Dict[str, Any]:
        return {
            "tipo": "info_fuentes",
            "fuente_actual": self.config.camera.source,
            "camaras_locales": scan_available_cameras(),
            "soporta_rtsp": True,
        }

    def _handle_client_connect(self, websocket: Any) -> None:
        payload = self._build_info_fuentes_payload()
        self.ws_server.send_to_client(websocket, payload)

    def _handle_client_action(self, action_data: Dict[str, Any], websocket: Any) -> None:
        accion = action_data.get("accion")
        if accion == "listar_camaras":
            self.ws_server.send_to_client(websocket, self._build_info_fuentes_payload())
        elif accion == "cambiar_fuente":
            nueva_fuente = action_data.get("fuente")
            if nueva_fuente is not None:
                if isinstance(nueva_fuente, str) and nueva_fuente.isdigit():
                    nueva_fuente = int(nueva_fuente)
                ok = self.change_source(nueva_fuente)
                payload = self._build_info_fuentes_payload()
                payload["cambio_exitoso"] = ok
                self.ws_server.broadcast_message(payload)

    def change_source(self, new_source: Union[int, str]) -> bool:
        """Cambia dinámicamente la fuente de video de la cámara."""
        logger.info(f"Cambiando fuente de video a: {new_source}")
        self.camera.release()
        self.camera = CameraCapture(
            source=new_source,
            target_fps=self.config.camera.target_fps,
            on_frame_callback=self.stream_server.set_frame,
        )
        opened = self.camera.open()
        if opened:
            self.config.camera.source = new_source
            logger.info(f"Fuente de video cambiada exitosamente a: {new_source}")
        else:
            logger.error(f"Fallo al abrir nueva fuente: {new_source}. Restaurando anterior...")
            self.camera = CameraCapture(
                source=self.config.camera.source,
                target_fps=self.config.camera.target_fps,
                on_frame_callback=self.stream_server.set_frame,
            )
            self.camera.open()
        return opened

    def start(self) -> None:
        """Inicia el ciclo principal de inferencia y monitoreo."""
        logger.info(f"Iniciando Vision Node para cámara '{self.config.camera.camera_id}'...")
        logger.info(f"Escritorios activos: {len(self.state_machines)}")
        logger.info(f"Tasa objetivo: {self.config.camera.target_fps} FPS")

        self.ws_server.start()
        self.stream_server.start()
        self.running = True

        if not self.camera.open():
            logger.warning(f"No se pudo inicializar la fuente de video: {self.config.camera.source}. Buscando cámaras alternativas...")
            cams = scan_available_cameras()
            if cams and cams[0]["id"] != self.config.camera.source:
                logger.info(f"Conectando automáticamente a cámara disponible: {cams[0]['id']}")
                self.change_source(cams[0]["id"])
            else:
                logger.info("Esperando conexión de cámara o configuración desde el cliente web...")

        fps_timer = time.time()
        fps_counter = 0

        window_name = f"Vision Node - {self.config.camera.camera_id}"
        if self.config.show_visualizer:
            cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(window_name, 960, 600)

        try:
            while self.running:
                loop_start = time.time()
                success, frame, timestamp = self.camera.read_frame()

                if not success or frame is None:
                    # Señal de cámara caída: actualizar escritorios a SIN_DATOS
                    for desk_id, fsm in self.state_machines.items():
                        events = fsm.update(metrics=None, current_time=timestamp, camera_online=False)
                        for ev in events:
                            if ev.event_type == EventType.STATUS_CHANGED:
                                payload = build_desk_status_payload(
                                    camera_id=self.config.camera.camera_id,
                                    desk_id=desk_id,
                                    status=fsm.status,
                                )
                                self.publisher.publish(payload)

                    time.sleep(0.5)
                    continue

                h, w = frame.shape[:2]

                # 1. Inferencia YOLO-pose con tracking
                detections = self.tracker.track(frame)

                # Difundir telemetría de personas detectadas hacia frontend (Paso 4 y 5)
                personas_ws = []
                for idx, det in enumerate(detections):
                    bp_landmarks = coco_to_blazepose_landmarks(det.keypoints, w, h)
                    personas_ws.append({
                        "track_id": det.track_id if det.track_id is not None else (idx + 1),
                        "keypoints": bp_landmarks,
                        "bbox": det.bbox,
                    })
                self.ws_server.broadcast_personas(self.config.camera.camera_id, personas_ws)

                # 2. Mapeo espacial a escritorios
                desk_matches, passersby = match_people_to_desks(
                    detections=detections,
                    desks=self.config.desks,
                    frame_width=w,
                    frame_height=h,
                )


                # 3. Evaluación de posturas y actualización de FSM
                current_metrics: Dict[str, Optional[PostureMetrics]] = {}
                current_statuses: Dict[str, DeskStatus] = {}

                for desk_id, fsm in self.state_machines.items():
                    desk_zone = self.desks_map[desk_id]
                    person_det = desk_matches.get(desk_id)

                    if person_det is None:
                        # Escritorio vacío
                        metrics = None
                        track_id = None
                    else:
                        # Calcular métricas contra los umbrales específicos de este escritorio
                        metrics = calculate_posture_metrics(
                            kpts=person_det.keypoints,
                            min_conf=self.config.camera.min_keypoint_confidence,
                            trunk_max_angle=desk_zone.thresholds.trunk_max_angle,
                            neck_max_angle=desk_zone.thresholds.neck_max_angle,
                            shoulder_diff_max=desk_zone.thresholds.shoulder_diff_max,
                        )
                        track_id = person_det.track_id

                    current_metrics[desk_id] = metrics

                    # Avanzar máquina de estados
                    events = fsm.update(
                        metrics=metrics,
                        current_time=timestamp,
                        track_id=track_id,
                        camera_online=True,
                    )
                    current_statuses[desk_id] = fsm.status

                    # 4. Publicar eventos generados
                    for ev in events:
                        if ev.event_type == EventType.STATUS_CHANGED:
                            payload = build_desk_status_payload(
                                camera_id=self.config.camera.camera_id,
                                desk_id=desk_id,
                                status=fsm.status,
                                trunk_angle=metrics.trunk_angle if metrics else None,
                                neck_angle=metrics.neck_angle if metrics else None,
                                shoulder_diff=metrics.shoulder_diff if metrics else None,
                                track_id=track_id,
                            )
                            self.publisher.publish(payload)

                        elif ev.event_type in (
                            EventType.ALERT_TRIGGERED,
                            EventType.ALERT_REMINDER,
                            EventType.ALERT_RESOLVED,
                        ):
                            payload = build_alert_payload(
                                camera_id=self.config.camera.camera_id,
                                event=ev,
                            )
                            self.publisher.publish(payload)

                # Medir FPS reales alcanzados
                fps_counter += 1
                if time.time() - fps_timer >= 1.0:
                    self.fps_actual = fps_counter / (time.time() - fps_timer)
                    fps_counter = 0
                    fps_timer = time.time()

                # 5. Visualización de depuración
                if self.config.show_visualizer:
                    debug_frame = draw_debug_overlay(
                        frame=frame,
                        desks=self.config.desks,
                        desk_statuses=current_statuses,
                        desk_metrics=current_metrics,
                        desk_matches=desk_matches,
                        passersby=passersby,
                        fps=self.fps_actual,
                        camera_id=self.config.camera.camera_id,
                    )
                    cv2.imshow(window_name, debug_frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord("q"):
                        logger.info("Detención solicitada por el usuario (tecla 'q').")
                        self.running = False
                        break

                # Control de cadencia para evitar saturación de CPU y permitir fluidez en streaming
                target_interval = 1.0 / max(1.0, min(30.0, float(getattr(self.config.camera, "target_fps", 15.0))))
                elapsed = time.time() - loop_start
                sleep_time = target_interval - elapsed
                if sleep_time > 0.002:
                    time.sleep(sleep_time)

        except KeyboardInterrupt:
            logger.info("Interrupción por teclado (Ctrl+C).")
        finally:
            self.stop()
            if self.config.show_visualizer:
                cv2.destroyAllWindows()

    def stop(self) -> None:
        """Detiene el nodo de visión y libera recursos."""
        self.running = False
        self.camera.release()
        self.ws_server.stop()
        self.stream_server.stop()
        logger.info("Vision Node detenido correctamente.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Nodo de Visión - Monitoreo Postural Multi-Persona")
    parser.add_argument("--config", default="config.json", help="Ruta al archivo de configuración JSON")
    parser.add_argument("--source", default=None, help="Sobrescribir fuente de video (ej. 0, video.mp4, rtsp://)")
    parser.add_argument("--fps", type=float, default=None, help="Sobrescribir tasa de FPS objetivo")
    parser.add_argument("--ws-port", type=int, default=8765, help="Puerto para servidor WebSocket (default: 8765)")
    parser.add_argument("--no-gui", action="store_true", help="Ejecutar en segundo plano sin ventana gráfica")
    parser.add_argument("--events-file", default=None, help="Ruta de archivo para guardar eventos JSONL")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = VisionNodeConfig.load_from_file(args.config)

    # Sobrescribir con argumentos CLI si fueron pasados
    if args.source is not None:
        config.camera.source = int(args.source) if args.source.isdigit() else args.source
    if args.fps is not None:
        config.camera.target_fps = args.fps
    if args.no_gui:
        config.show_visualizer = False
    if args.events_file is not None:
        config.events_output_file = args.events_file

    app = VisionNodeApp(config, ws_port=args.ws_port)
    app.start()



if __name__ == "__main__":
    main()
