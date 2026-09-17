"""Servidor WebSocket para emisión de telemetría multi-persona hacia el frontend en tiempo real.

Cumple el principio de privacidad: NUNCA envía video ni imágenes, sólo coordenadas numéricas.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import threading
from typing import Any, Callable, Dict, List, Optional, Set
import websockets

logger = logging.getLogger("vision-node.ws")


class VisionWebSocketServer:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8765,
        action_callback: Optional[Callable[[Dict[str, Any], Any], None]] = None,
        connect_callback: Optional[Callable[[Any], None]] = None,
    ):
        self.host = host
        self.port = port
        self.action_callback = action_callback
        self.connect_callback = connect_callback
        self.clients: Set[Any] = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.server = None
        self.thread: threading.Thread | None = None
        self.running = False
        self.ready_event = threading.Event()

    async def _handler(self, websocket: Any) -> None:
        self.clients.add(websocket)
        client_addr = getattr(websocket, "remote_address", "desconocido")
        logger.info(f"Nuevo cliente conectado desde {client_addr}. Total activos: {len(self.clients)}")

        if self.connect_callback:
            try:
                self.connect_callback(websocket)
            except Exception as e:
                logger.warning(f"Error en connect_callback: {e}")

        try:
            async for raw_msg in websocket:
                try:
                    data = json.loads(raw_msg)
                    if self.action_callback and isinstance(data, dict):
                        self.action_callback(data, websocket)
                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    logger.warning(f"Error procesando mensaje de cliente: {e}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            logger.info(f"Cliente desconectado ({client_addr}). Restantes: {len(self.clients)}")

    async def _start_server(self) -> None:
        self.server = await websockets.serve(self._handler, self.host, self.port)
        self.ready_event.set()
        logger.info(f"Servidor WebSocket iniciado en ws://{self.host}:{self.port}")
        await asyncio.Future()  # Mantener vivo indefinidamente

    def start(self) -> None:
        """Inicia el servidor WebSocket en un hilo en segundo plano."""
        if self.running:
            return
        self.running = True
        self.ready_event.clear()

        def _run_loop():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            try:
                self.loop.run_until_complete(self._start_server())
            except Exception as e:
                logger.info(f"Servidor WebSocket detenido ({e}).")

        self.thread = threading.Thread(target=_run_loop, daemon=True)
        self.thread.start()
        self.ready_event.wait(timeout=5.0)

    def broadcast_personas(self, camera_id: str, personas_payload: List[Dict[str, Any]]) -> None:
        """Envía el paquete de personas detectadas a todos los clientes WebSocket conectados."""
        if not self.running or not self.loop or not self.clients:
            return

        payload = {
            "tipo": "personas_detectadas",
            "camera_id": camera_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "personas": personas_payload,
        }
        message = json.dumps(payload)

        # Programar difusión en el loop de asyncio de forma segura entre hilos
        asyncio.run_coroutine_threadsafe(self._broadcast(message), self.loop)

    def broadcast_message(self, payload: Dict[str, Any]) -> None:
        """Envía cualquier mensaje estructurado a todos los clientes."""
        if not self.running or not self.loop or not self.clients:
            return
        message = json.dumps(payload)
        asyncio.run_coroutine_threadsafe(self._broadcast(message), self.loop)

    def send_to_client(self, websocket: Any, payload: Dict[str, Any]) -> None:
        """Envía un mensaje estructurado a un cliente específico."""
        if not self.running or not self.loop:
            return
        message = json.dumps(payload)
        asyncio.run_coroutine_threadsafe(websocket.send(message), self.loop)

    async def _broadcast(self, message: str) -> None:
        if not self.clients:
            return
        # Enviar a todos los clientes concurrentemente
        destinatarios = list(self.clients)
        coros = [client.send(message) for client in destinatarios]
        await asyncio.gather(*coros, return_exceptions=True)

    def stop(self) -> None:
        self.running = False
        if self.loop:
            self.loop.call_soon_threadsafe(self.loop.stop)
