#!/usr/bin/env python3
"""
Genera los documentos de apoyo para la prueba con usuarios de Habitusitos.

Usa SOLO la biblioteca estandar de Python: sin reportlab, sin fpdf, sin pip
install. Un script de apoyo que exige instalar dependencias es un script que
alguien no va a poder correr el dia que lo necesite.

Los PDF se escriben a mano con las fuentes base-14 que todo lector de PDF
incorpora (Helvetica). No es elegante, pero es reproducible en cualquier equipo
con Python 3.10 o superior y sin conexion.

Uso:
    python documentos/generar_documentos.py

Salida:
    app/public/documentos/*.pdf   los documentos imprimibles
    app/public/documentos/*.csv   los ejemplos de exportacion

Los archivos generados se descargan desde la pantalla de Ayuda del prototipo.
Estan en .gitignore: se regeneran con este script, no se versionan.
"""

from __future__ import annotations

import csv
import io
import math
import random
import sys
import textwrap
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "app" / "public" / "documentos"

# Fecha ancla. Fija a proposito: dos ejecuciones del script producen archivos
# identicos. Debe coincidir con config.ANCLA_UTC del prototipo.
ANCLA = datetime(2026, 7, 31, 21, 0, 0, tzinfo=timezone.utc)
SEMILLA = 20260731

# ---------------------------------------------------------------------------
# Motor de PDF minimo
# ---------------------------------------------------------------------------

ANCHO, ALTO = 595.28, 841.89  # A4 en puntos
MARGEN = 56.0

# Anchos de caracter aproximados de Helvetica, para poder ajustar el texto al
# ancho de linea. Es una aproximacion suficiente para prosa: no se usa para
# maquetacion fina.
_ANCHO_MEDIO = 0.50


def _ancho_texto(texto: str, tamano: float) -> float:
    return len(texto) * tamano * _ANCHO_MEDIO


def _escapar(texto: str) -> str:
    """Escapa los caracteres con significado en un literal de cadena PDF."""
    return texto.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def _a_latin1(texto: str) -> str:
    """
    Los tipos base-14 usan la codificacion WinAnsi, que no cubre todo Unicode.

    Se sustituyen las comillas tipograficas y los guiones largos, que son lo que
    en la practica se cuela al escribir en espanol. Las tildes y la enne SI
    existen en WinAnsi y se conservan.
    """
    reemplazos = {
        "‘": "'", "’": "'", "“": '"', "”": '"',
        "–": "-", "—": "-", "…": "...", " ": " ",
        "→": "->", "·": "-",
    }
    for viejo, nuevo in reemplazos.items():
        texto = texto.replace(viejo, nuevo)
    return texto.encode("latin-1", "replace").decode("latin-1")


class Pagina:
    """Acumula operadores de contenido de una pagina."""

    def __init__(self) -> None:
        self.ops: list[str] = []

    def texto(self, x: float, y: float, contenido: str, tamano: float, fuente: str) -> None:
        contenido = _escapar(_a_latin1(contenido))
        self.ops.append(
            f"BT /{fuente} {tamano:.1f} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({contenido}) Tj ET"
        )

    def linea(self, x1: float, y1: float, x2: float, y2: float, grosor: float = 0.6) -> None:
        self.ops.append(
            f"q {grosor:.2f} w 0.75 0.75 0.75 RG {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S Q"
        )

    def rectangulo(self, x: float, y: float, ancho: float, alto: float, gris: float = 0.94) -> None:
        self.ops.append(
            f"q {gris:.2f} {gris:.2f} {gris:.2f} rg {x:.2f} {y:.2f} {ancho:.2f} {alto:.2f} re f Q"
        )

    def contenido(self) -> bytes:
        return "\n".join(self.ops).encode("latin-1")


class Documento:
    """Constructor de PDF con flujo vertical y salto de pagina automatico."""

    def __init__(self, titulo: str) -> None:
        self.titulo = titulo
        self.paginas: list[Pagina] = []
        self.pagina = Pagina()
        self.paginas.append(self.pagina)
        self.y = ALTO - MARGEN

    # -- control de flujo ---------------------------------------------------

    def espacio(self, alto: float) -> None:
        self.y -= alto

    def _asegurar(self, alto: float) -> None:
        if self.y - alto < MARGEN + 28:
            self.pagina = Pagina()
            self.paginas.append(self.pagina)
            self.y = ALTO - MARGEN

    # -- bloques ------------------------------------------------------------

    def titulo_principal(self, texto: str) -> None:
        self._asegurar(34)
        self.pagina.texto(MARGEN, self.y, texto, 19, "F2")
        self.y -= 26

    def subtitulo(self, texto: str) -> None:
        self._asegurar(26)
        self.y -= 8
        self.pagina.texto(MARGEN, self.y, texto, 12.5, "F2")
        self.y -= 16

    def parrafo(self, texto: str, tamano: float = 10, fuente: str = "F1") -> None:
        util = ANCHO - 2 * MARGEN
        maximo = max(20, int(util / (tamano * _ANCHO_MEDIO)))
        for linea in textwrap.wrap(texto, maximo) or [""]:
            self._asegurar(tamano + 4)
            self.pagina.texto(MARGEN, self.y, linea, tamano, fuente)
            self.y -= tamano + 3.2
        self.y -= 4

    def vineta(self, texto: str, marca: str = "-") -> None:
        util = ANCHO - 2 * MARGEN - 14
        maximo = max(20, int(util / (10 * _ANCHO_MEDIO)))
        lineas = textwrap.wrap(texto, maximo) or [""]
        for i, linea in enumerate(lineas):
            self._asegurar(14)
            if i == 0:
                self.pagina.texto(MARGEN, self.y, marca, 10, "F1")
            self.pagina.texto(MARGEN + 14, self.y, linea, 10, "F1")
            self.y -= 13.2
        self.y -= 2

    def campo(self, etiqueta: str, alto: float = 26) -> None:
        """Campo rellenable a mano, con su linea de escritura."""
        self._asegurar(alto + 12)
        self.pagina.texto(MARGEN, self.y, etiqueta, 9, "F1")
        self.y -= alto
        self.pagina.linea(MARGEN, self.y + 6, ANCHO - MARGEN, self.y + 6)
        self.y -= 8

    def casilla(self, texto: str) -> None:
        self._asegurar(18)
        self.pagina.ops.append(
            f"q 0.7 w 0.35 0.35 0.35 RG {MARGEN:.2f} {self.y - 1:.2f} 10 10 re S Q"
        )
        self.pagina.texto(MARGEN + 17, self.y, texto, 9.5, "F1")
        self.y -= 18

    def separador(self) -> None:
        self._asegurar(14)
        self.y -= 4
        self.pagina.linea(MARGEN, self.y, ANCHO - MARGEN, self.y)
        self.y -= 12

    def tabla(self, cabeceras: list[str], filas: list[list[str]], anchos: list[float]) -> None:
        total = ANCHO - 2 * MARGEN
        cols = [total * a for a in anchos]

        self._asegurar(24)
        self.pagina.rectangulo(MARGEN, self.y - 5, total, 17, 0.92)
        x = MARGEN + 4
        for cab, ancho in zip(cabeceras, cols):
            self.pagina.texto(x, self.y, cab, 9, "F2")
            x += ancho
        self.y -= 20

        for fila in filas:
            alto_fila = 14 * max(
                1,
                max(
                    len(textwrap.wrap(celda, max(10, int(ancho / (8.5 * _ANCHO_MEDIO)))) or [""])
                    for celda, ancho in zip(fila, cols)
                ),
            )
            self._asegurar(alto_fila + 6)
            y_inicial = self.y
            x = MARGEN + 4
            for celda, ancho in zip(fila, cols):
                maximo = max(10, int(ancho / (8.5 * _ANCHO_MEDIO)))
                yy = y_inicial
                for linea in textwrap.wrap(celda, maximo) or [""]:
                    self.pagina.texto(x, yy, linea, 8.5, "F1")
                    yy -= 11.5
                x += ancho
            self.y = y_inicial - alto_fila
            self.pagina.linea(MARGEN, self.y + 7, ANCHO - MARGEN, self.y + 7, 0.4)
        self.y -= 6

    def pie_en_todas(self, texto: str) -> None:
        for i, pagina in enumerate(self.paginas, start=1):
            pagina.texto(MARGEN, MARGEN - 18, _a_latin1(texto), 7.5, "F1")
            pagina.texto(
                ANCHO - MARGEN - 46, MARGEN - 18, f"Pagina {i} de {len(self.paginas)}", 7.5, "F1"
            )

    # -- serializacion ------------------------------------------------------

    def guardar(self, ruta: Path) -> None:
        objetos: list[bytes] = []

        def agregar(cuerpo: bytes) -> int:
            objetos.append(cuerpo)
            return len(objetos)

        fuente_normal = agregar(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
        )
        fuente_negrita = agregar(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
        )

        # Cada pagina aporta dos objetos (su contenido y la pagina en si), y el
        # arbol de paginas va justo despues. Hay que saber su id de antemano
        # porque cada pagina lo referencia en /Parent. El assert de mas abajo
        # comprueba que este calculo siga siendo cierto.
        id_paginas = len(objetos) + 2 * len(self.paginas) + 1
        ids_pagina: list[int] = []

        for pagina in self.paginas:
            datos = pagina.contenido()
            id_contenido = agregar(
                b"<< /Length " + str(len(datos)).encode() + b" >>\nstream\n" + datos + b"\nendstream"
            )
            ids_pagina.append(
                agregar(
                    f"<< /Type /Page /Parent {id_paginas} 0 R "
                    f"/MediaBox [0 0 {ANCHO:.2f} {ALTO:.2f}] "
                    f"/Resources << /Font << /F1 {fuente_normal} 0 R /F2 {fuente_negrita} 0 R >> >> "
                    f"/Contents {id_contenido} 0 R >>".encode("latin-1")
                )
            )

        kids = " ".join(f"{i} 0 R" for i in ids_pagina)
        id_arbol = agregar(
            f"<< /Type /Pages /Kids [{kids}] /Count {len(ids_pagina)} >>".encode("latin-1")
        )
        assert id_arbol == id_paginas, "El calculo previo del id del arbol de paginas fallo"

        id_info = agregar(
            f"<< /Title ({_escapar(_a_latin1(self.titulo))}) "
            f"/Producer (Habitusitos - generador de documentos de prueba) >>".encode("latin-1")
        )
        id_catalogo = agregar(f"<< /Type /Catalog /Pages {id_arbol} 0 R >>".encode("latin-1"))

        salida = io.BytesIO()
        salida.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        posiciones = []
        for i, cuerpo in enumerate(objetos, start=1):
            posiciones.append(salida.tell())
            salida.write(f"{i} 0 obj\n".encode())
            salida.write(cuerpo)
            salida.write(b"\nendobj\n")

        inicio_xref = salida.tell()
        salida.write(f"xref\n0 {len(objetos) + 1}\n".encode())
        salida.write(b"0000000000 65535 f \n")
        for pos in posiciones:
            salida.write(f"{pos:010d} 00000 n \n".encode())
        salida.write(
            f"trailer\n<< /Size {len(objetos) + 1} /Root {id_catalogo} 0 R "
            f"/Info {id_info} 0 R >>\nstartxref\n{inicio_xref}\n%%EOF\n".encode()
        )

        ruta.write_bytes(salida.getvalue())
        print(f"  {ruta.name}  ({ruta.stat().st_size / 1024:.1f} KB)")


def encabezado(doc: Documento, titulo: str, subtitulo: str) -> None:
    doc.titulo_principal(titulo)
    doc.parrafo(subtitulo, 9.5)
    doc.parrafo(
        "Habitusitos - Monitor de postura por webcam | Trabajo de grado, Ingenieria de "
        "Software, Universidad de Cartagena",
        8.5,
    )
    doc.separador()


# ---------------------------------------------------------------------------
# Documentos
# ---------------------------------------------------------------------------


def consentimiento() -> None:
    doc = Documento("Consentimiento informado - Habitusitos")
    encabezado(
        doc,
        "Consentimiento informado",
        "Participacion voluntaria en la evaluacion de Habitusitos",
    )

    doc.subtitulo("Que es esto")
    doc.parrafo(
        "Te invitamos a participar en la evaluacion de Habitusitos, una aplicacion de "
        "escritorio para Windows que revisa tu postura mientras trabajas frente al "
        "computador y te avisa cuando llevas un rato en una posicion que te puede cansar. "
        "Tu participacion es completamente voluntaria y puedes retirarte en cualquier "
        "momento, sin dar explicaciones y sin ninguna consecuencia."
    )

    doc.subtitulo("Que vas a hacer")
    doc.vineta("Instalar la aplicacion en tu propio computador con Windows 10 u 11.")
    doc.vineta("Completar una configuracion inicial que toma menos de un minuto.")
    doc.vineta("Usarla normalmente durante el periodo acordado, sin cambiar tu rutina.")
    doc.vineta("Responder unas preguntas breves al final sobre tu experiencia.")

    doc.subtitulo("Que pasa con tu informacion - lee esto con atencion")
    doc.parrafo(
        "Esta es la parte mas importante del documento y por eso esta escrita sin "
        "tecnicismos:"
    )
    doc.vineta(
        "El video de tu camara NUNCA se guarda. No se graba, no se toman fotos, y no se "
        "envia a ningun servidor, ni nuestro ni de terceros. Bajo ninguna configuracion.",
        marca="*",
    )
    doc.vineta(
        "Lo unico que se calcula son angulos: cuanto se inclina tu cuello, si tienes un "
        "hombro mas alto que el otro, y cosas asi. Esos numeros se guardan en un archivo "
        "dentro de TU computador.",
        marca="*",
    )
    doc.vineta(
        "Si al final aceptas compartir esos numeros para el estudio, se entregan sin tu "
        "nombre: solo un codigo de participante.",
        marca="*",
    )
    doc.vineta(
        "La aplicacion funciona sin conexion a internet. Puedes desconectarte y comprobarlo.",
        marca="*",
    )
    doc.vineta(
        "Puedes borrar todos tus datos cuando quieras desde la pantalla de Ajustes, o "
        "simplemente eliminar el archivo.",
        marca="*",
    )

    doc.subtitulo("Riesgos y beneficios")
    doc.parrafo(
        "No hay riesgos fisicos. La molestia mas probable es que la aplicacion te avise en "
        "un momento inoportuno; puedes silenciarla o cerrarla cuando quieras. El beneficio "
        "directo es tomar conciencia de tu postura; el beneficio para el estudio es evaluar "
        "si una herramienta asi resulta util en condiciones reales."
    )
    doc.parrafo(
        "Nota: mientras la aplicacion esta midiendo, la luz de tu camara va a estar "
        "encendida. Es normal y significa que la camara esta en uso, no que se este grabando."
    )

    doc.subtitulo("Tus derechos")
    doc.vineta("Puedes retirarte en cualquier momento, sin justificarte.")
    doc.vineta("Puedes pedir que se eliminen tus datos incluso despues de haberlos entregado.")
    doc.vineta("Puedes preguntar cualquier cosa antes, durante y despues de la prueba.")

    doc.separador()
    doc.subtitulo("Declaracion")
    doc.parrafo(
        "He leido este documento, entendi en que consiste la prueba y acepto participar de "
        "forma voluntaria."
    )
    doc.espacio(6)
    doc.casilla("Acepto participar en la evaluacion.")
    doc.casilla(
        "Acepto que los datos de postura (sin video, sin mi nombre) se usen en el estudio."
    )
    doc.casilla("Quiero recibir un resumen de los resultados cuando termine el estudio.")

    doc.espacio(14)
    doc.campo("Nombre completo")
    doc.campo("Documento de identidad")
    doc.campo("Correo de contacto (opcional)")
    doc.campo("Firma")
    doc.campo("Fecha")

    doc.espacio(8)
    doc.parrafo(
        "Codigo de participante (lo completa quien aplica la prueba): P-____", 9
    )

    doc.pie_en_todas(
        "Habitusitos - Consentimiento informado - Conserva una copia de este documento."
    )
    doc.guardar(SALIDA / "Consentimiento_Informado.pdf")


def protocolo() -> None:
    doc = Documento("Protocolo de la prueba con usuarios - Habitusitos")
    encabezado(
        doc,
        "Protocolo de la prueba con usuarios",
        "Guion para quien aplica la prueba. No es para el participante.",
    )

    doc.subtitulo("Antes de empezar")
    doc.vineta("Confirma que el equipo tiene Windows 10 u 11 y una camara que funcione.")
    doc.vineta("Entrega el consentimiento informado y espera a que lo lea. No lo resumas tu.")
    doc.vineta("Anota el codigo de participante en la ficha de incidencias.")
    doc.vineta(
        "Pide que cierre las videollamadas abiertas: si otra aplicacion tiene la camara, la "
        "instalacion parece fallar cuando en realidad esta ocupada."
    )

    doc.subtitulo("Fase 1 - Instalacion (5 minutos)")
    doc.parrafo(
        "No ayudes salvo que la persona se bloquee mas de dos minutos. El objetivo de esta "
        "fase es medir si alguien puede instalar la aplicacion SIN asistencia. Cada vez que "
        "intervienes, se pierde ese dato.",
    )
    doc.vineta("Entrega el instalador y la guia rapida. Nada mas.")
    doc.vineta("Cronometra desde el doble clic hasta que la aplicacion abra.")
    doc.vineta(
        "Anota cualquier alerta del antivirus o de SmartScreen: es un obstaculo conocido de "
        "los ejecutables sin firma digital."
    )

    doc.subtitulo("Fase 2 - Configuracion inicial (2 minutos)")
    doc.vineta("Observa si lee la pantalla de privacidad o la salta.")
    doc.vineta("Anota si duda al elegir camara.")
    doc.vineta(
        "En la calibracion, fijate si POSA para la camara. Es el error mas comun y arruina "
        "la referencia: la instruccion dice que se siente como siempre, no perfecto."
    )

    doc.subtitulo("Fase 3 - Sesion de uso (segun lo acordado)")
    doc.vineta("Pide que trabaje normalmente. No debe actuar para la camara.")
    doc.vineta("Anota cada aviso: si lo vio, si le molesto, si corrigio la postura.")
    doc.vineta("Anota si la aplicacion se quedo sin responder o consumio demasiado el equipo.")

    doc.subtitulo("Fase 4 - Cierre")
    doc.vineta("Abre el panel con la persona y pidele que interprete lo que ve, en voz alta.")
    doc.vineta("Pregunta si entiende que significa el puntaje. No se lo expliques antes.")
    doc.vineta("Pregunta si la volveria a usar manana, y por que si o por que no.")
    doc.vineta("Exporta sus datos si autorizo compartirlos y guarda el archivo con su codigo.")

    doc.subtitulo("Preguntas de cierre - textuales")
    doc.vineta("En una frase, para que crees que sirve esta aplicacion?")
    doc.vineta("Hubo algun momento en que te molestara? Cuando?")
    doc.vineta("Hubo algo que no entendiste o que te confundio?")
    doc.vineta("Que le quitarias? Que le agregarias?")
    doc.vineta("Del 1 al 5, que tan probable es que la sigas usando?")

    doc.subtitulo("Que NO hacer")
    doc.vineta("No expliques el algoritmo. Si preguntan, responde despues de la prueba.")
    doc.vineta("No corrijas la postura de la persona: falsearias la medicion.")
    doc.vineta("No arregles el equipo del participante. Registra el problema y sigue.")
    doc.vineta(
        "No descartes una incidencia por parecer menor. Una confusion de treinta segundos en "
        "una prueba son quince minutos perdidos en produccion."
    )

    doc.pie_en_todas("Habitusitos - Protocolo de la prueba con usuarios")
    doc.guardar(SALIDA / "Protocolo_Prueba_Usuario.pdf")


def guia_rapida() -> None:
    doc = Documento("Guia rapida - Habitusitos")
    encabezado(
        doc,
        "Habitusitos en una pagina",
        "Todo lo que necesitas saber para empezar.",
    )

    doc.subtitulo("Que hace")
    doc.parrafo(
        "Revisa como estas sentado usando la camara de tu computador. Si llevas un buen rato "
        "encorvado, te manda un aviso discreto. Si vas bien, no te molesta."
    )

    doc.subtitulo("Que NO hace")
    doc.parrafo(
        "No graba video. No toma fotos. No sube nada a internet. Solo calcula angulos y los "
        "guarda en tu computador."
    )

    doc.subtitulo("Como empezar")
    doc.vineta("Abre el instalador y sigue los pasos. Si Windows te pregunta, acepta.", "1.")
    doc.vineta("Cuando abra, lee las tres pantallas de bienvenida.", "2.")
    doc.vineta(
        "Cuando te pida la camara, autorizala. Sin eso no puede medir nada.", "3."
    )
    doc.vineta(
        "Sientate COMO TE SIENTAS SIEMPRE y pulsa el boton de medir. Son 6 segundos. "
        "No te pongas derecho a proposito: si posas, despues te va a avisar de mas.",
        "4.",
    )
    doc.vineta("Listo. Ya puedes trabajar normal.", "5.")

    doc.subtitulo("Donde queda")
    doc.parrafo(
        "Habitusitos no deja una ventana abierta. Vive abajo a la derecha, junto al reloj. "
        "Haz clic ahi para ver como vas o cambiar algo. Si no lo ves, pulsa la flechita que "
        "muestra los iconos ocultos."
    )

    doc.subtitulo("El color y la forma del icono")
    doc.tabla(
        ["Se ve asi", "Significa"],
        [
            ["Circulo con visto", "Vas bien. No hay nada que corregir."],
            ["Triangulo con signo", "Tu postura bajo. Si sigue asi, te aviso."],
            ["Octagono", "Llevas rato en una postura que te puede cansar."],
            ["Dos barras", "No te veo en camara. Se pauso solo."],
        ],
        [0.32, 0.68],
    )
    doc.parrafo(
        "Fijate en la FORMA, no solo en el color: asi funciona igual para quien no "
        "distingue bien los colores.",
        9,
    )

    doc.subtitulo("Si algo no funciona")
    doc.vineta(
        "No encuentra la camara: revisa que no la tenga abierta otra aplicacion, como una "
        "videollamada."
    )
    doc.vineta("Te avisa demasiado: en Ajustes puedes hacerla menos exigente.")
    doc.vineta("Te avisa poco: en Ajustes puedes hacerla mas exigente.")
    doc.vineta(
        "Necesitas silencio un rato: activa el modo enfoque. Sigue midiendo pero no te avisa."
    )
    doc.vineta("Cambiaste de silla o escritorio: repite la medicion inicial desde Ajustes.")

    doc.separador()
    doc.parrafo(
        "Cualquier problema, por pequeno que sea, cuentaselo a quien te entrego la "
        "aplicacion. Eso es exactamente lo que estamos midiendo.",
        9.5,
    )

    doc.pie_en_todas("Habitusitos - Guia rapida del participante")
    doc.guardar(SALIDA / "Guia_Rapida_Participante.pdf")


def ficha_incidencias() -> None:
    doc = Documento("Ficha de incidencias - Habitusitos")
    encabezado(
        doc,
        "Ficha de incidencias",
        "Una ficha por participante. Registra todo, aunque parezca menor.",
    )

    doc.campo("Codigo de participante")
    doc.campo("Fecha y hora de la sesion")
    doc.campo("Equipo (marca, modelo, camara integrada o externa)")
    doc.campo("Version de Windows")

    doc.subtitulo("Instalacion")
    doc.campo("Tiempo desde el doble clic hasta que abrio")
    doc.casilla("El antivirus o SmartScreen mostro una alerta")
    doc.casilla("Hubo que darle permisos de administrador")
    doc.casilla("Necesito ayuda para completar la instalacion")
    doc.campo("Detalle")

    doc.subtitulo("Configuracion inicial")
    doc.casilla("Leyo la pantalla de privacidad")
    doc.casilla("Dudo al elegir la camara")
    doc.casilla("POSO durante la medicion inicial en vez de sentarse normal")
    doc.casilla("Necesito repetir la medicion")
    doc.campo("Detalle")

    doc.subtitulo("Durante el uso")
    doc.campo("Cuantos avisos recibio")
    doc.campo("Cuantos avisos le parecieron oportunos")
    doc.casilla("Le parecio que avisaba demasiado")
    doc.casilla("Le parecio que no avisaba lo suficiente")
    doc.casilla("El equipo se sintio mas lento")
    doc.casilla("La aplicacion dejo de responder o se cerro sola")
    doc.casilla("Hubo problemas de camara a mitad de sesion")
    doc.campo("Detalle")

    doc.subtitulo("Comprension de la interfaz")
    doc.campo("Que dijo que significaba el puntaje (textual)")
    doc.campo("Que no entendio")

    doc.subtitulo("Cierre")
    doc.campo("Del 1 al 5, que tan probable es que la siga usando")
    doc.campo("Que le quitaria")
    doc.campo("Que le agregaria")

    doc.subtitulo("Observaciones de quien aplica la prueba")
    doc.campo("", 34)
    doc.campo("", 34)
    doc.campo("", 34)

    doc.pie_en_todas("Habitusitos - Ficha de incidencias")
    doc.guardar(SALIDA / "Ficha_Incidencias.pdf")


# ---------------------------------------------------------------------------
# Ejemplos de exportacion
# ---------------------------------------------------------------------------


def csv_historial() -> None:
    """
    Ejemplo del CSV de historial.

    Debe coincidir campo por campo con `generarCsvHistorial` del prototipo
    (app/src/datos/api/historial.api.ts). Si uno cambia, cambia el otro: quien
    prepare los scripts de analisis lo hara contra este archivo.
    """
    rnd = random.Random(SEMILLA)
    ruta = SALIDA / "habitusitos_export_ejemplo.csv"

    with ruta.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\r\n")
        w.writerow(["fecha", "promedio_score", "minutos_activos", "es_festivo"])

        for atras in range(97, -1, -1):
            dia = ANCLA - timedelta(days=atras)
            fecha = dia.strftime("%Y-%m-%d")
            fin_de_semana = dia.weekday() >= 5

            if rnd.random() > (0.22 if fin_de_semana else 0.88):
                w.writerow([fecha, "", 0, "no"])
                continue

            avance = 1 - atras / 98
            base = 62 + 17 * math.sqrt(avance)
            sesgo = [1.5, 2.0, 0.5, -1.0, -4.5, 1.0, 2.5][dia.weekday()]
            promedio = max(28.0, min(97.0, base + sesgo + rnd.gauss(0, 3.4)))
            minutos = rnd.randint(40, 130) if fin_de_semana else rnd.randint(210, 430)
            w.writerow([fecha, f"{promedio:.2f}", minutos, "no"])

    print(f"  {ruta.name}  ({ruta.stat().st_size / 1024:.1f} KB)")


def csv_benchmark() -> None:
    """Ejemplo del CSV de benchmark, con los metadatos de metodologia."""
    rnd = random.Random(SEMILLA + 1)
    ruta = SALIDA / "benchmark_antes_despues.csv"
    calentamiento = 15
    duracion = 300

    perfiles = {
        "run-antes": dict(cpu=41.8, rss=612.0, fps=21.4, det=0.973),
        "run-despues": dict(cpu=9.6, rss=388.0, fps=5.0, det=0.961),
    }

    with ruta.open("w", newline="", encoding="utf-8") as f:
        f.write("# Habitusitos - exportacion de benchmark (DATOS SIMULADOS DEL PROTOTIPO)\r\n")
        f.write("# ATENCION: estas cifras NO pueden citarse en el documento de tesis.\r\n")
        f.write("# equipo,Portatil de gama media / Intel Core i5-1135G7 4C-8T / 8 GB\r\n")
        f.write("# sistema,Windows 11 Pro 24H2\r\n")
        f.write("# plan_energia,Alto rendimiento (declarado: Windows hace throttling en equilibrado)\r\n")
        f.write(f"# calentamiento_descartado_s,{calentamiento}\r\n")
        f.write("# corrida,run-antes,Antes (ingenua),1280x720,30fps,complejidad=1,adaptativa=False\r\n")
        f.write("# corrida,run-despues,Despues (optimizada),640x480,5fps,complejidad=0,adaptativa=True\r\n")
        f.write("\r\n")

        w = csv.writer(f, lineterminator="\r\n")
        w.writerow(
            [
                "run_id", "timestamp", "cpu_percent", "rss_mb",
                "effective_fps", "detection_rate", "en_calentamiento",
            ]
        )

        for run_id, p in perfiles.items():
            inicio = ANCLA - timedelta(days=3 if run_id == "run-antes" else 2)
            for s in range(duracion):
                calentando = s < calentamiento
                factor_cpu = 1.55 if calentando else 1.0
                factor_rss = (0.82 + (s / calentamiento) * 0.18) if calentando else 1.0
                w.writerow(
                    [
                        run_id,
                        (inicio + timedelta(seconds=s)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                        f"{max(0.5, p['cpu'] * factor_cpu + rnd.gauss(0, p['cpu'] * 0.09)):.2f}",
                        f"{max(60.0, p['rss'] * factor_rss + rnd.gauss(0, 7)):.1f}",
                        f"{max(0.5, p['fps'] + rnd.gauss(0, p['fps'] * 0.05)):.2f}",
                        f"{min(1.0, max(0.75, p['det'] + rnd.gauss(0, 0.014))):.4f}",
                        "si" if calentando else "no",
                    ]
                )

    print(f"  {ruta.name}  ({ruta.stat().st_size / 1024:.1f} KB)")


def main() -> int:
    if sys.version_info < (3, 10):
        print("Se necesita Python 3.10 o superior.")
        return 1

    SALIDA.mkdir(parents=True, exist_ok=True)
    print(f"Generando documentos en {SALIDA}\n")

    consentimiento()
    protocolo()
    guia_rapida()
    ficha_incidencias()
    csv_historial()
    csv_benchmark()

    print("\nListo. Se descargan desde la pantalla de Ayuda del prototipo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
