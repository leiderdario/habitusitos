"""Seguridad del nodo: autenticación con Supabase, tickets de video y lista de fuentes.

Autoría: aporte propio de Espinker (no heredado de BatesPosture). Vive en un módulo
aparte para que la defensa de seguridad de la tesis no se mezcle con el código de visión.

Por qué se valida el token CONTRA Supabase (`/auth/v1/user`) y no con la firma del JWT:
el nodo no necesita ningún secreto ni saber con qué algoritmo firma el proyecto, y un
token revocado o de un usuario borrado deja de servir. El costo son dos llamadas HTTP
por conexión, amortizadas con una caché corta.
"""

from __future__ import annotations

import hashlib
import json
import logging
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping, Optional, Tuple, Union

logger = logging.getLogger("vision-node.security")

HOSTS_LOOPBACK = frozenset({"127.0.0.1", "::1", "localhost"})
LARGO_MAXIMO_TOKEN = 4096


class ErrorAutenticacion(Exception):
    """El token no es válido o su dueño no pertenece a la organización del nodo."""


class ErrorConfiguracionSeguridad(ValueError):
    """La configuración dejaría el nodo expuesto; se aborta el arranque."""


@dataclass(frozen=True)
class Identidad:
    usuario_id: str
    organizacion_id: str


@dataclass(frozen=True)
class AjustesSeguridad:
    host: str
    origenes: Tuple[str, ...]
    supabase_url: Optional[str]
    supabase_clave: Optional[str]
    organizacion_id: Optional[str]
    exigir_autenticacion: bool

    @classmethod
    def desde_entorno(cls, env: Mapping[str, str]) -> "AjustesSeguridad":
        """Lee VISION_HOST, VISION_ALLOWED_ORIGINS, VISION_SUPABASE_URL, VISION_SUPABASE_KEY,
        VISION_ORG_ID y VISION_AUTH ('on'/'off').

        Sin VISION_AUTH, la autenticación se activa sola si están las tres variables de
        Supabase: el valor por defecto nunca deja abierto un nodo que ya está configurado.
        """
        url = (env.get("VISION_SUPABASE_URL") or "").strip().rstrip("/") or None
        clave = (env.get("VISION_SUPABASE_KEY") or "").strip() or None
        org = (env.get("VISION_ORG_ID") or "").strip() or None
        completo = bool(url and clave and org)
        modo = (env.get("VISION_AUTH") or "").strip().lower()
        if modo not in ("", "on", "off"):
            raise ErrorConfiguracionSeguridad("VISION_AUTH solo acepta 'on' u 'off'.")
        exigir = completo if modo == "" else modo == "on"

        origenes = tuple(
            o.strip().rstrip("/")
            for o in (env.get("VISION_ALLOWED_ORIGINS") or "").split(",")
            if o.strip()
        )
        ajustes = cls(
            host=(env.get("VISION_HOST") or "127.0.0.1").strip(),
            origenes=origenes,
            supabase_url=url,
            supabase_clave=clave,
            organizacion_id=org,
            exigir_autenticacion=exigir,
        )
        ajustes.validar()
        return ajustes

    def validar(self) -> None:
        if self.exigir_autenticacion:
            if not (self.supabase_url and self.supabase_clave and self.organizacion_id):
                raise ErrorConfiguracionSeguridad(
                    "Con autenticación activa hacen falta VISION_SUPABASE_URL, "
                    "VISION_SUPABASE_KEY y VISION_ORG_ID."
                )
            try:
                uuid.UUID(self.organizacion_id)
            except ValueError as e:
                raise ErrorConfiguracionSeguridad("VISION_ORG_ID no es un UUID válido.") from e
            if not self.supabase_url.startswith("https://"):
                raise ErrorConfiguracionSeguridad("VISION_SUPABASE_URL debe ser https://.")
        if self.host not in HOSTS_LOOPBACK:
            if not self.exigir_autenticacion:
                raise ErrorConfiguracionSeguridad(
                    f"El nodo escucha en {self.host} (accesible desde la red) pero la "
                    "autenticación está apagada. Activa VISION_AUTH o usa VISION_HOST=127.0.0.1."
                )
            if not self.origenes:
                raise ErrorConfiguracionSeguridad(
                    "Escuchando fuera de loopback hace falta VISION_ALLOWED_ORIGINS "
                    "(por ejemplo https://habitusutos.vercel.app)."
                )


def origenes_websocket(origenes: Iterable[str]) -> Optional[list]:
    """Valor del parámetro `origins` de websockets.serve. None = sin restricción.

    Se admite también la ausencia de cabecera Origin (clientes que no son navegador):
    siguen necesitando un token válido, y un navegador siempre manda Origin.
    """
    lista = [o for o in origenes]
    return [*lista, None] if lista else None


class VerificadorSupabase:
    """Comprueba un access_token de Supabase y que su dueño sea de la organización del nodo."""

    def __init__(
        self,
        url: str,
        clave_publica: str,
        organizacion_id: str,
        ttl_cache: float = 60.0,
        timeout: float = 5.0,
        abrir: Callable[..., Any] = urllib.request.urlopen,
        reloj: Callable[[], float] = time.monotonic,
    ):
        self._url = url.rstrip("/")
        self._clave = clave_publica
        self._org = organizacion_id
        self._ttl = ttl_cache
        self._timeout = timeout
        self._abrir = abrir
        self._reloj = reloj
        self._cache: dict[str, Tuple[float, Identidad]] = {}
        self._lock = threading.Lock()

    def _get_json(self, ruta: str, token: str) -> Any:
        req = urllib.request.Request(
            f"{self._url}{ruta}",
            headers={"apikey": self._clave, "Authorization": f"Bearer {token}"},
        )
        try:
            with self._abrir(req, timeout=self._timeout) as resp:
                return json.loads(resp.read(65536))
        except urllib.error.HTTPError as e:
            raise ErrorAutenticacion(f"Supabase rechazó la consulta ({e.code}).") from e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            # Fallo cerrado: si Supabase no responde, nadie entra.
            raise ErrorAutenticacion("No se pudo verificar la sesión con Supabase.") from e

    def verificar(self, token: Any) -> Identidad:
        if not isinstance(token, str) or not token or len(token) > LARGO_MAXIMO_TOKEN:
            raise ErrorAutenticacion("Token ausente o con formato inválido.")

        clave_cache = hashlib.sha256(token.encode()).hexdigest()
        with self._lock:
            hit = self._cache.get(clave_cache)
            if hit and hit[0] > self._reloj():
                return hit[1]

        usuario = self._get_json("/auth/v1/user", token)
        try:
            usuario_id = str(uuid.UUID(str(usuario["id"])))
        except (KeyError, TypeError, ValueError) as e:
            raise ErrorAutenticacion("Respuesta de sesión inesperada.") from e

        # `usuario_id` ya es un UUID canónico: es seguro ponerlo en la URL. La fila
        # propia la deja leer la política RLS del propio usuario.
        filas = self._get_json(
            "/rest/v1/usuarios?" + urllib.parse.urlencode({"select": "organizacion_id", "id": f"eq.{usuario_id}"}),
            token,
        )
        org = filas[0].get("organizacion_id") if isinstance(filas, list) and filas else None
        if org != self._org:
            raise ErrorAutenticacion("El usuario no pertenece a la organización de este nodo.")

        identidad = Identidad(usuario_id=usuario_id, organizacion_id=org)
        with self._lock:
            ahora = self._reloj()
            self._cache = {k: v for k, v in self._cache.items() if v[0] > ahora}
            if len(self._cache) < 1000:
                self._cache[clave_cache] = (ahora + self._ttl, identidad)
        return identidad


class EmisorTickets:
    """Tickets de un solo uso y vida corta para abrir el video.

    Un `<img src=...>` no puede mandar la cabecera Authorization, y poner el JWT en la
    URL lo dejaría en logs y en el historial. En su lugar el WebSocket (ya autenticado)
    entrega un ticket aleatorio que sirve una vez, durante unos segundos.
    """

    MAXIMO_PENDIENTES = 1000

    def __init__(self, ttl: float = 30.0, reloj: Callable[[], float] = time.monotonic):
        self._ttl = ttl
        self._reloj = reloj
        self._tickets: dict[str, Tuple[float, str]] = {}
        self._lock = threading.Lock()

    def emitir(self, usuario_id: str) -> str:
        ticket = secrets.token_urlsafe(32)
        with self._lock:
            ahora = self._reloj()
            self._tickets = {k: v for k, v in self._tickets.items() if v[0] > ahora}
            if len(self._tickets) >= self.MAXIMO_PENDIENTES:
                raise ErrorAutenticacion("Demasiados tickets pendientes.")
            self._tickets[ticket] = (ahora + self._ttl, usuario_id)
        return ticket

    def consumir(self, ticket: Optional[str]) -> Optional[str]:
        """Devuelve el usuario dueño del ticket y lo invalida; None si no sirve."""
        if not ticket:
            return None
        with self._lock:
            entrada = self._tickets.pop(ticket, None)
        if entrada is None or entrada[0] <= self._reloj():
            return None
        return entrada[1]


def fuente_permitida(
    valor: Any,
    fuentes_nombradas: Mapping[str, str],
    indices_locales: Iterable[int],
) -> Union[int, str, None]:
    """Resuelve la fuente de video pedida por un cliente. None = rechazada.

    Un cliente nunca elige la fuente libremente: `cv2.VideoCapture` abre archivos
    locales y URLs de red, así que aceptar texto arbitrario sería lectura de archivos
    y SSRF. Solo vale un índice de webcam detectado o el ALIAS de una fuente que el
    administrador declaró en `named_sources` (config.json). El cliente manda el alias;
    la URL real, que puede llevar usuario y contraseña, no sale nunca del servidor.
    """
    indices = set(indices_locales)
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int):
        return valor if valor in indices else None
    if isinstance(valor, str):
        if valor.isascii() and valor.isdigit():
            n = int(valor)
            return n if n in indices else None
        return fuentes_nombradas.get(valor)
    return None


def nombre_publico_de_fuente(actual: Union[int, str], fuentes_nombradas: Mapping[str, str]) -> Union[int, str]:
    """Lo que se le muestra a los clientes de la fuente en uso: índice o alias, jamás la URL."""
    if isinstance(actual, int):
        return actual
    for alias, url in fuentes_nombradas.items():
        if url == actual:
            return alias
    return "fuente-externa"
