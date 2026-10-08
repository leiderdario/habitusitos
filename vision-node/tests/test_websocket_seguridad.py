"""Pruebas del handshake y los límites del WebSocket (autoría: aporte propio de Habitusitos)."""

import asyncio
import json
import socket

import pytest
import websockets

from vision_node.security import EmisorTickets, ErrorAutenticacion, Identidad
from vision_node.websocket_server import VisionWebSocketServer


def _puerto_libre() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _VerificadorFalso:
    def verificar(self, token):
        if token == "bueno":
            return Identidad(usuario_id="11111111-1111-1111-1111-111111111111", organizacion_id="org")
        raise ErrorAutenticacion("no")


def _servidor(**kw):
    puerto = _puerto_libre()
    srv = VisionWebSocketServer(
        host="127.0.0.1", port=puerto, verificador=_VerificadorFalso(), tickets=EmisorTickets(), **kw
    )
    srv.start()
    return srv, f"ws://127.0.0.1:{puerto}"


async def _cerrado_con(ws) -> int:
    with pytest.raises(websockets.exceptions.ConnectionClosed) as info:
        await asyncio.wait_for(ws.recv(), timeout=3)
    return info.value.rcvd.code


def test_token_valido_recibe_ticket_y_difusiones():
    async def prueba():
        srv, url = _servidor()
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({"accion": "autenticar", "token": "bueno"}))
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
                assert msg["tipo"] == "autenticado" and len(msg["ticket_video"]) >= 32
                srv.broadcast_message({"tipo": "hola"})
                assert json.loads(await asyncio.wait_for(ws.recv(), timeout=3))["tipo"] == "hola"
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_token_invalido_se_cierra_con_4401():
    async def prueba():
        srv, url = _servidor()
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({"accion": "autenticar", "token": "malo"}))
                assert await _cerrado_con(ws) == 4401
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_primer_mensaje_distinto_de_autenticar_se_cierra():
    async def prueba():
        srv, url = _servidor()
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({"accion": "cambiar_fuente", "fuente": "rtsp://x"}))
                assert await _cerrado_con(ws) == 4401
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_sin_autenticar_no_recibe_difusiones():
    async def prueba():
        srv, url = _servidor()
        try:
            async with websockets.connect(url) as ws:
                await asyncio.sleep(0.2)
                srv.broadcast_message({"tipo": "secreto"})
                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(ws.recv(), timeout=0.5)
                assert len(srv.clients) == 0
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_origen_no_permitido_se_rechaza():
    async def prueba():
        srv, url = _servidor(origenes=["https://habitusutos.vercel.app"])
        try:
            with pytest.raises(websockets.exceptions.InvalidStatus) as info:
                async with websockets.connect(url, origin="https://sitio-malicioso.test"):
                    pass
            assert info.value.response.status_code == 403
            async with websockets.connect(url, origin="https://habitusutos.vercel.app") as ws:
                await ws.send(json.dumps({"accion": "autenticar", "token": "bueno"}))
                assert json.loads(await asyncio.wait_for(ws.recv(), timeout=3))["tipo"] == "autenticado"
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_mensaje_enorme_cierra_la_conexion():
    async def prueba():
        srv, url = _servidor()
        try:
            async with websockets.connect(url) as ws:
                await ws.send("x" * (64 * 1024))
                assert await _cerrado_con(ws) == 1009
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_tope_de_conexiones():
    async def prueba():
        srv, url = _servidor(max_conexiones=1)
        try:
            async with websockets.connect(url) as a:
                await asyncio.sleep(0.2)
                async with websockets.connect(url) as b:
                    assert await _cerrado_con(b) == 1013
        finally:
            srv.stop()

    asyncio.run(prueba())


def test_ticket_se_renueva_a_peticion():
    async def prueba():
        srv, url = _servidor()
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({"accion": "autenticar", "token": "bueno"}))
                t1 = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))["ticket_video"]
                await ws.send(json.dumps({"accion": "pedir_ticket_video"}))
                t2 = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))["ticket_video"]
                assert t1 != t2
        finally:
            srv.stop()

    asyncio.run(prueba())
