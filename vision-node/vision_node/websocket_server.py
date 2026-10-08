"""Servidor WebSocket para emisión de telemetría multi-persona hacia el frontend en tiempo real.

Este servidor sólo envía coordenadas numéricas. El video en vivo se sirve aparte
(`stream_server.py`, puerto +1) y exige un ticket que sólo este servidor emite tras
autenticar al cliente.

Con un verificador configurado, un cliente no recibe NADA hasta que su primer mensaje
sea {"accion": "autenticar", "token": "<access_token de Supabase>"} y el token resulte
válido y de la organización del nodo. Mientras tanto no figura en `clients`, así que
tampoco recibe difusiones.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Set
import websockets

from vision_node.security import (
    EmisorTickets,
    ErrorAutenticacion,
    Identidad,
    VerificadorSupabase,
    origenes_websocket,
)

logger = logging.getLogger("vision-node.ws")

TAMANO_MAXIMO_MENSAJE = 16 * 1024  # los mensajes legítimos son JSON de unas decenas de bytes
SEGUNDOS_PARA_AUTENTICAR = 5.0
MENSAJES_POR_VENTANA = 30
SEGUNDOS_VENTANA = 10.0
CIERRE_NO_AUTORIZADO = 4401
CIERRE_DEMASIADOS_MENSAJES = 4429


class VisionWebSocketServer:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8765,
        action_callback: Optional[Callable[[Dict[str, Any], Any], None]] = None,
        connect_callback: Optional[Callable[[Any], None]] = None,
        verificador: Optional[VerificadorSupabase] = None,
        tickets: Optional[EmisorTickets] = None,
        origenes: Sequence[str] = (),
        max_conexiones: int = 20,
    ):
        self.host = host
        self.port = port
        self.action_callback = action_callback
        self.connect_callback = connect_callback
        self.verificador = verificador
        self.tickets = tickets
        self.origenes = tuple(origenes)
        self.max_conexiones = max_conexiones
        self._conexiones_abiertas = 0
        self.clients: Set[Any] = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.server = None
        self.thread: threading.Thread | None = None
        self.running = False
        self.ready_event = threading.Event()

    async def _autenticar(self, websocket: Any) -> Identidad:
        """Primer mensaje obligatorio. Lanza ErrorAutenticacion si no es válido."""
        try:
            raw = await asyncio.wait_for(websocket.recv(), timeout=SEGUNDOS_PARA_AUTENTICAR)
            data = json.loads(raw)
        except (asyncio.TimeoutError, json.JSONDecodeError, TypeError, websockets.exceptions.ConnectionClosed) as e:
            raise ErrorAutenticacion("No llegó un mensaje de autenticación válido.") from e
        if not isinstance(data, dict) or data.get("accion") != "autenticar":
            raise ErrorAutenticacion("El primer mensaje debe ser 'autenticar'.")
        # La verificación hace HTTP bloqueante: fuera del bucle de eventos.
        return await asyncio.get_running_loop().run_in_executor(
            None, self.verificador.verificar, data.get("token")
        )

    async def _handler(self, websocket: Any) -> None:
        client_addr = getattr(websocket, "remote_address", "desconocido")
        if self._conexiones_abiertas >= self.max_conexiones:
            await websocket.close(1013, "nodo saturado")
            return
        self._conexiones_abiertas += 1
        registrado = False
        try:
            identidad: Optional[Identidad] = None
            if self.verificador is not None:
                try:
                    identidad = await self._autenticar(websocket)
                except ErrorAutenticacion as e:
                    # Nunca se registra el token: solo quién intentó y por qué falló.
                    logger.warning(f"Conexión rechazada desde {client_addr}: {e}")
                    await websocket.close(CIERRE_NO_AUTORIZADO, "no autorizado")
                    return
                self._enviar_a(websocket, self._payload_autenticado(identidad))

            self.clients.add(websocket)
            registrado = True
            logger.info(f"Nuevo cliente conectado desde {client_addr}. Total activos: {len(self.clients)}")

            if self.connect_callback:
                try:
                    self.connect_callback(websocket)
                except Exception as e:
                    logger.warning(f"Error en connect_callback: {e}")

            ventana_inicio = time.monotonic()
            mensajes_en_ventana = 0
            async for raw_msg in websocket:
                ahora = time.monotonic()
                if ahora - ventana_inicio > SEGUNDOS_VENTANA:
                    ventana_inicio, mensajes_en_ventana = ahora, 0
                mensajes_en_ventana += 1
                if mensajes_en_ventana > MENSAJES_POR_VENTANA:
                    await websocket.close(CIERRE_DEMASIADOS_MENSAJES, "demasiados mensajes")
                    return
                try:
                    data = json.loads(raw_msg)
                except (json.JSONDecodeError, TypeError):
                    continue
                if not isinstance(data, dict):
                    continue
                try:
                    if data.get("accion") == "pedir_ticket_video" and identidad is not None:
                        self._enviar_a(websocket, self._payload_autenticado(identidad))
                    elif data.get("accion") == "autenticar" and self.verificador is None:
                        # Desarrollo local sin Supabase: el cliente espera esta respuesta para arrancar.
                        self._enviar_a(websocket, {"tipo": "autenticado"})
                    elif self.action_callback:
                        self.action_callback(data, websocket)
                except Exception as e:
                    logger.warning(f"Error procesando mensaje de cliente: {e}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self._conexiones_abiertas -= 1
            if registrado:
                self.clients.discard(websocket)
                logger.info(f"Cliente desconectado ({client_addr}). Restantes: {len(self.clients)}")

    def _payload_autenticado(self, identidad: Identidad) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"tipo": "autenticado"}
        if self.tickets is not None:
            payload["ticket_video"] = self.tickets.emitir(identidad.usuario_id)
        return payload

    def _enviar_a(self, websocket: Any, payload: Dict[str, Any]) -> None:
        # Se usa desde el propio bucle de eventos del servidor: se agenda sin esperar.
        asyncio.ensure_future(websocket.send(json.dumps(payload)))

    async def _start_server(self) -> None:
        self.server = await websockets.serve(
            self._handler,
            self.host,
            self.port,
            origins=origenes_websocket(self.origenes),
            max_size=TAMANO_MAXIMO_MENSAJE,
            max_queue=16,
            ping_interval=20,
            ping_timeout=20,
        )
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
