"""Pruebas del acceso al video (autoría: aporte propio de Habitusitos)."""

import http.client
import socket

from vision_node.security import EmisorTickets
from vision_node.stream_server import VideoStreamServer


def _puerto_libre() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _pedir(puerto: int, ruta: str):
    conn = http.client.HTTPConnection("127.0.0.1", puerto, timeout=3)
    conn.request("GET", ruta)
    resp = conn.getresponse()
    return conn, resp


def test_video_exige_ticket_valido_de_un_solo_uso():
    tickets = EmisorTickets()
    srv = VideoStreamServer(port=_puerto_libre(), tickets=tickets)
    srv.start()
    try:
        conn, resp = _pedir(srv.port, "/video_feed")
        assert resp.status == 401
        conn.close()

        conn, resp = _pedir(srv.port, "/video_feed?t=inventado")
        assert resp.status == 401
        conn.close()

        ticket = tickets.emitir("11111111-1111-1111-1111-111111111111")
        conn, resp = _pedir(srv.port, f"/video_feed?t={ticket}")
        assert resp.status == 200
        assert resp.getheader("Access-Control-Allow-Origin") is None
        assert resp.getheader("X-Content-Type-Options") == "nosniff"
        conn.close()

        conn, resp = _pedir(srv.port, f"/video_feed?t={ticket}")
        assert resp.status == 401  # el ticket ya se gastó
        conn.close()
    finally:
        srv.stop()


def test_tope_de_transmisiones_simultaneas():
    tickets = EmisorTickets()
    srv = VideoStreamServer(port=_puerto_libre(), tickets=tickets, max_transmisiones=1)
    srv.start()
    try:
        c1, r1 = _pedir(srv.port, f"/video_feed?t={tickets.emitir('u')}")
        assert r1.status == 200
        c2, r2 = _pedir(srv.port, f"/video_feed?t={tickets.emitir('u')}")
        assert r2.status == 503
        c1.close()
        c2.close()
    finally:
        srv.stop()
