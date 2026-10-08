/**
 * Marco del video: la camara como protagonista de la pantalla.
 *
 * Marco de madera de bordes muy redondeados, y dentro el video (en espejo) con un
 * lienzo transparente encima donde se dibuja la pose. El anillo interior toma el
 * color del estado postural: es un canal mas, nunca el unico, porque el estado
 * tambien viaja en forma y texto en la insignia del panel.
 *
 * Sobre el video solo queda lo que no se puede poner fuera: la etiqueta de la
 * fuente y el aviso de conexion con el nodo de vision. Los controles viven en
 * la barra de debajo (barra-controles-camara.tsx), no tapando la imagen.
 *
 * Separado de vista-camara.tsx (Espinker, Fase 4) cuando ese archivo llego a 615
 * lineas. El video y el dibujo son heredados; el marco y los avisos, propios.
 */

import { useEffect, useRef } from "react";
import { Camera, CameraOff, Loader2, Users } from "lucide-react";
import { CATALOGO_ERRORES } from "@/datos/cliente";
import type { CodigoError, Landmark, PresentacionEstado } from "@/dominio/tipos";
import type { EstadoCamara, FuenteCamara } from "@/camara/use-camara";
import type { EstadoConexionVisionNode, EstadoPersona } from "@/estado/simulacion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dibujarEsqueletoIndividual } from "./dibujar-esqueleto";
import { SiluetaSimulada } from "./silueta-simulada";

/** URL del video del nodo con su ticket. Sin ticket no hay URL: el `<img>` espera a la autenticacion. */
function urlVideoOficina(ticket: string | null): string | undefined {
  if (!ticket) return undefined;
  const base =
    (import.meta.env.VITE_VISION_STREAM_URL as string | undefined) || "http://127.0.0.1:8766/video_feed";
  const url = new URL(base);
  url.searchParams.set("t", ticket);
  return url.toString();
}

interface Props {
  modoCamara: boolean;
  onCambiarModo(activo: boolean): void;
  fuenteCamara: FuenteCamara;
  onCambiarFuenteCamara?(fuente: FuenteCamara): void;
  personas?: Map<string, EstadoPersona>;
  estadoConexionVisionNode?: EstadoConexionVisionNode;
  /** Ticket de un solo uso para abrir el video del nodo; sin el, el nodo responde 401. */
  ticketVideoOficina: string | null;
  estado: EstadoCamara;
  error: CodigoError | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarks: Landmark[] | null;
  presentacion: PresentacionEstado;
}

export function MarcoVideo({
  modoCamara,
  onCambiarModo,
  fuenteCamara,
  onCambiarFuenteCamara,
  personas,
  estadoConexionVisionNode,
  ticketVideoOficina,
  estado,
  error,
  videoRef,
  landmarks,
  presentacion,
}: Props) {
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const activa = estado === "activa";

  // Dibujo del esqueleto (o esqueletos) sobre el video
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, lienzo.width, lienzo.height);

    const estilo = getComputedStyle(document.documentElement);

    if (fuenteCamara === "oficina" && personas && personas.size > 0) {
      // Modo oficina: renderizado multi-esqueleto para cada persona (Paso 7)
      for (const p of personas.values()) {
        if (p.id === "local") continue; // Excluir la simulacion local
        if (!p.pose?.landmarks) continue;
        // Sin etiqueta: ni el id de seguimiento ni el puntaje se dibujan sobre
        // el video. El panel de oficina ya no muestra puntaje numerico por
        // persona en ningun lado (ver funcionalidades/panel-oficina/).
        const color = estilo.getPropertyValue(`--${p.presentacion.tokenColor}`).trim();
        dibujarEsqueletoIndividual(ctx, p.pose.landmarks, color, lienzo.width, lienzo.height);
      }
    } else if (landmarks) {
      // Modo personal clasico: un solo esqueleto
      const color = estilo.getPropertyValue(`--${presentacion.tokenColor}`).trim();
      dibujarEsqueletoIndividual(ctx, landmarks, color, lienzo.width, lienzo.height);
    }
  }, [landmarks, personas, fuenteCamara, presentacion.tokenColor]);

  const etiquetaFuente = activa
    ? fuenteCamara === "oficina"
      ? { icono: Users, texto: "Cámara de oficina" }
      : { icono: Camera, texto: "Webcam en vivo" }
    : { icono: null, texto: "Vista simulada" };

  const conexion =
    modoCamara && fuenteCamara === "oficina" && estadoConexionVisionNode?.tipo !== "inactivo"
      ? estadoConexionVisionNode
      : undefined;

  return (
    <div className="border-madera-suave bg-madera-suave rounded-[1.75rem] border-[6px]">
      <div
        className="bg-video relative aspect-4/3 overflow-hidden rounded-[1.375rem] -outline-offset-[3px] outline-[3px]"
        style={{ outlineColor: `var(--${presentacion.tokenColor})` }}
      >
        {fuenteCamara === "webcam" ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn("size-full -scale-x-100 object-cover", activa ? "block" : "hidden")}
          />
        ) : (
          <img
            src={urlVideoOficina(ticketVideoOficina)}
            alt="Video en vivo de la cámara de oficina"
            className={cn("size-full object-cover", activa ? "block" : "hidden")}
          />
        )}
        <canvas
          ref={lienzoRef}
          width={640}
          height={480}
          className={cn(
            "pointer-events-none absolute inset-0 size-full",
            fuenteCamara === "webcam" && "-scale-x-100",
            activa ? "block" : "hidden",
          )}
        />

        {!activa && (
          <div className="text-sobre-panel absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {estado === "cargando-modelo" || estado === "pidiendo-permiso" ? (
              <>
                <Loader2 className="size-8 animate-spin" aria-hidden />
                <p className="text-panel-suave max-w-sm text-sm text-balance">
                  {fuenteCamara === "oficina"
                    ? "Conectando con el servicio de visión de la oficina…"
                    : estado === "cargando-modelo"
                      ? "Preparando el detector de postura. La primera vez puede tardar unos segundos."
                      : "Esperando a que autorices el uso de la cámara."}
                </p>
              </>
            ) : error ? (
              <>
                <CameraOff className="size-8" aria-hidden />
                <p className="text-sm font-medium">{CATALOGO_ERRORES[error].titulo}</p>
                <p className="text-panel-suave max-w-sm text-xs text-balance">
                  {CATALOGO_ERRORES[error].mensaje}
                </p>
                <Button variant="secondary" size="sm" onClick={() => onCambiarModo(true)}>
                  {CATALOGO_ERRORES[error].accion}
                </Button>
              </>
            ) : (
              <SiluetaSimulada presentacion={presentacion} />
            )}
          </div>
        )}

        <span className="bg-card/90 text-card-foreground border-border absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium backdrop-blur">
          {etiquetaFuente.icono && <etiquetaFuente.icono className="text-primary size-3.5" aria-hidden />}
          {etiquetaFuente.texto}
        </span>

        {conexion && (
          <div
            role="status"
            className={cn(
              "bg-card/95 absolute inset-x-3 top-12 z-10 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium backdrop-blur",
              conexion.tipo === "desconectado"
                ? "border-destructive/40 text-destructive"
                : "border-border text-card-foreground",
            )}
          >
            {conexion.tipo === "conectando" && (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                <span>Conectando con el servidor de visión…</span>
              </>
            )}
            {conexion.tipo === "conectado_sin_personas" && (
              <>
                <Users className="size-3.5 shrink-0" aria-hidden />
                <span>Conectado: buscando personas en el encuadre</span>
              </>
            )}
            {conexion.tipo === "conectado_con_personas" && (
              <>
                <Users className="text-primary size-3.5 shrink-0" aria-hidden />
                <span>Conectado: {conexion.cantidad} persona(s) detectada(s)</span>
              </>
            )}
            {conexion.tipo === "desconectado" && (
              <>
                <CameraOff className="size-3.5 shrink-0" aria-hidden />
                <span>Sin conexión con el servidor de visión</span>
                {onCambiarFuenteCamara && (
                  <button
                    type="button"
                    onClick={() => onCambiarFuenteCamara("oficina")}
                    className="ml-auto font-semibold underline underline-offset-2"
                  >
                    Reintentar
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
