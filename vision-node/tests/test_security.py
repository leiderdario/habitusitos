"""Pruebas del módulo de seguridad (autoría: aporte propio de Espinker)."""

import io
import json
import urllib.error

import pytest

from vision_node.security import (
    nombre_publico_de_fuente,
    AjustesSeguridad,
    EmisorTickets,
    ErrorAutenticacion,
    ErrorConfiguracionSeguridad,
    VerificadorSupabase,
    fuente_permitida,
    origenes_websocket,
)

ORG = "00000000-0000-0000-0000-0000000000a1"
USUARIO = "11111111-1111-1111-1111-111111111111"
ENV_COMPLETO = {
    "VISION_SUPABASE_URL": "https://proyecto.supabase.co/",
    "VISION_SUPABASE_KEY": "sb_publishable_x",
    "VISION_ORG_ID": ORG,
}


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _falso_supabase(org_del_usuario=ORG, estado_usuario=200, llamadas=None):
    def abrir(req, timeout=None):
        if llamadas is not None:
            llamadas.append(req.full_url)
        if "/auth/v1/user" in req.full_url:
            if estado_usuario != 200:
                raise urllib.error.HTTPError(req.full_url, estado_usuario, "x", {}, None)
            return _Resp(json.dumps({"id": USUARIO}).encode())
        return _Resp(json.dumps([{"organizacion_id": org_del_usuario}]).encode())

    return abrir


def _verificador(**kw):
    return VerificadorSupabase("https://proyecto.supabase.co", "clave", ORG, abrir=_falso_supabase(**kw))


# --- Verificador ---------------------------------------------------------------------

def test_token_valido_de_la_organizacion():
    ident = _verificador().verificar("token-bueno")
    assert ident.usuario_id == USUARIO and ident.organizacion_id == ORG


def test_usuario_de_otra_organizacion_se_rechaza():
    with pytest.raises(ErrorAutenticacion):
        _verificador(org_del_usuario="00000000-0000-0000-0000-0000000000b2").verificar("t")


def test_usuario_sin_organizacion_se_rechaza():
    with pytest.raises(ErrorAutenticacion):
        _verificador(org_del_usuario=None).verificar("t")


def test_token_rechazado_por_supabase():
    with pytest.raises(ErrorAutenticacion):
        _verificador(estado_usuario=401).verificar("t")


@pytest.mark.parametrize("token", [None, "", 123, "x" * 5000, b"bytes"])
def test_token_con_formato_invalido(token):
    with pytest.raises(ErrorAutenticacion):
        _verificador().verificar(token)


def test_si_supabase_no_responde_nadie_entra():
    def abrir(req, timeout=None):
        raise urllib.error.URLError("sin red")

    v = VerificadorSupabase("https://proyecto.supabase.co", "clave", ORG, abrir=abrir)
    with pytest.raises(ErrorAutenticacion):
        v.verificar("t")


def test_cache_evita_repetir_llamadas_y_expira():
    reloj = [0.0]
    llamadas = []
    v = VerificadorSupabase(
        "https://proyecto.supabase.co", "clave", ORG,
        ttl_cache=60.0, abrir=_falso_supabase(llamadas=llamadas), reloj=lambda: reloj[0],
    )
    v.verificar("t")
    v.verificar("t")
    assert len(llamadas) == 2  # una vez /user y una /usuarios; la segunda salió de caché
    reloj[0] = 61.0
    v.verificar("t")
    assert len(llamadas) == 4


# --- Tickets -------------------------------------------------------------------------

def test_ticket_sirve_una_sola_vez():
    t = EmisorTickets()
    ticket = t.emitir(USUARIO)
    assert t.consumir(ticket) == USUARIO
    assert t.consumir(ticket) is None


def test_ticket_expira():
    reloj = [0.0]
    t = EmisorTickets(ttl=30.0, reloj=lambda: reloj[0])
    ticket = t.emitir(USUARIO)
    reloj[0] = 31.0
    assert t.consumir(ticket) is None


@pytest.mark.parametrize("ticket", [None, "", "inventado"])
def test_ticket_inexistente(ticket):
    assert EmisorTickets().consumir(ticket) is None


def test_tickets_son_distintos():
    t = EmisorTickets()
    assert t.emitir(USUARIO) != t.emitir(USUARIO)


# --- Lista de fuentes ----------------------------------------------------------------

FUENTES = {"recepcion": "rtsp://admin:clave@camara.local/stream"}


def test_la_fuente_publica_nunca_expone_la_url():
    assert nombre_publico_de_fuente(0, FUENTES) == 0
    assert nombre_publico_de_fuente("rtsp://admin:clave@camara.local/stream", FUENTES) == "recepcion"
    assert nombre_publico_de_fuente("rtsp://otra:secreta@x/y", FUENTES) == "fuente-externa"


@pytest.mark.parametrize(
    "valor,esperado",
    [
        (0, 0),
        ("1", 1),
        (3, None),          # índice que no se detectó
        ("/etc/passwd", None),
        ("file:///etc/passwd", None),
        ("http://169.254.169.254/latest/meta-data", None),
        ("recepcion", "rtsp://admin:clave@camara.local/stream"),  # alias declarado por el administrador
        ("rtsp://atacante.test/x", None),
        ("rtsp://admin:clave@camara.local/stream", None),  # la URL real no es un alias válido
        (True, None),       # bool es int en Python: no debe colarse como 1
        (None, None),
        (1.5, None),
        ("１", None),       # dígito Unicode que str.isdigit() aceptaría
    ],
)
def test_fuente_permitida(valor, esperado):
    assert fuente_permitida(valor, FUENTES, [0, 1]) == esperado


# --- Ajustes de arranque -------------------------------------------------------------

def test_por_defecto_es_local_y_sin_auth():
    a = AjustesSeguridad.desde_entorno({})
    assert a.host == "127.0.0.1" and not a.exigir_autenticacion


def test_auth_se_activa_sola_con_supabase_completo():
    assert AjustesSeguridad.desde_entorno(ENV_COMPLETO).exigir_autenticacion


def test_no_arranca_expuesto_sin_auth():
    with pytest.raises(ErrorConfiguracionSeguridad):
        AjustesSeguridad.desde_entorno({"VISION_HOST": "0.0.0.0"})


def test_no_arranca_expuesto_con_auth_apagada_explicitamente():
    with pytest.raises(ErrorConfiguracionSeguridad):
        AjustesSeguridad.desde_entorno({**ENV_COMPLETO, "VISION_HOST": "0.0.0.0", "VISION_AUTH": "off"})


def test_expuesto_exige_origenes():
    with pytest.raises(ErrorConfiguracionSeguridad):
        AjustesSeguridad.desde_entorno({**ENV_COMPLETO, "VISION_HOST": "0.0.0.0"})


def test_expuesto_con_todo_configurado():
    a = AjustesSeguridad.desde_entorno(
        {**ENV_COMPLETO, "VISION_HOST": "0.0.0.0", "VISION_ALLOWED_ORIGINS": "https://a.test/, https://b.test"}
    )
    assert a.origenes == ("https://a.test", "https://b.test")
    assert a.supabase_url == "https://proyecto.supabase.co"


def test_auth_on_sin_variables_falla():
    with pytest.raises(ErrorConfiguracionSeguridad):
        AjustesSeguridad.desde_entorno({"VISION_AUTH": "on"})


def test_org_id_debe_ser_uuid():
    with pytest.raises(ErrorConfiguracionSeguridad):
        AjustesSeguridad.desde_entorno({**ENV_COMPLETO, "VISION_ORG_ID": "no-es-uuid"})


def test_supabase_url_debe_ser_https():
    with pytest.raises(ErrorConfiguracionSeguridad):
        AjustesSeguridad.desde_entorno({**ENV_COMPLETO, "VISION_SUPABASE_URL": "http://proyecto.supabase.co"})


def test_origenes_websocket():
    assert origenes_websocket([]) is None
    assert origenes_websocket(["https://a.test"]) == ["https://a.test", None]
