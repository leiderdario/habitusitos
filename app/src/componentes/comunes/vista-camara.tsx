/**
 * Vista de camara: el video como protagonista y, debajo, sus controles.
 *
 * Compone tres piezas (Espinker, Fase 4; antes eran 615 lineas en este archivo):
 * - camara/marco-video.tsx: el video con el esqueleto, el marco y los avisos.
 * - camara/barra-controles-camara.tsx: todos los controles, en una sola fila.
 * - camara/tarjeta-calibracion.tsx: en que punto esta la calibracion.
 *
 * La interfaz publica (las props) no cambia: la usan el panel personal y el de
 * oficina. En modo simulado el video muestra una silueta esquematica que
 * reacciona al estado de la sesion.
 */

import { ShieldCheck } from "lucide-react";
import type { CalibracionPostural, CodigoError, Landmark, Landmark3D, PresentacionEstado } from "@/dominio/tipos";
import type { DispositivoVideoInfo, EstadoCamara, FuenteCamara } from "@/camara/use-camara";
import type { PerspectivaCamara } from "@/dominio/perspectivas";
import type { CamaraOficinaLocal, EstadoConexionVisionNode, EstadoPersona } from "@/estado/simulacion";
import { BarraControlesCamara } from "./camara/barra-controles-camara";
import { MarcoVideo } from "./camara/marco-video";
import { estaCalibrada } from "./camara/calibracion";
import { TarjetaCalibracion } from "./camara/tarjeta-calibracion";

interface Props {
  modoCamara: boolean;
  onCambiarModo(activo: boolean): void;
  fuenteCamara?: FuenteCamara;
  onCambiarFuenteCamara?(fuente: FuenteCamara): void;
  personas?: Map<string, EstadoPersona>;
  estadoConexionVisionNode?: EstadoConexionVisionNode;
  /** Ticket de un solo uso para abrir el video del nodo; sin el, el nodo responde 401. */
  ticketVideoOficina?: string | null;
  estado: EstadoCamara;
  error: CodigoError | null;
  origenRecursos: "local" | "cdn" | "oficina" | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarks: Landmark[] | null;
  worldLandmarks?: Landmark3D[] | null;
  presentacion: PresentacionEstado;
  perspectiva: PerspectivaCamara;
  onCambiarPerspectiva(perspectiva: PerspectivaCamara): void;
  calibracionPostural: CalibracionPostural;
  onMarcaPosturaNeutra(): void;
  onLimpiarCalibracion(): void;

  // Seleccion de camara web personal
  dispositivosVideo?: DispositivoVideoInfo[];
  idDispositivoSeleccionado?: string | null;
  onSeleccionarDispositivo?(deviceId: string): void;

  // Seleccion y control de fuente de oficina
  camarasOficinaDisponibles?: CamaraOficinaLocal[];
  fuenteOficinaActual?: number | string;
  onCambiarFuenteOficina?(nuevaFuente: number | string): void;
}

export function VistaCamara({
  modoCamara,
  onCambiarModo,
  fuenteCamara = "webcam",
  onCambiarFuenteCamara,
  personas,
  estadoConexionVisionNode,
  ticketVideoOficina = null,
  estado,
  error,
  origenRecursos,
  videoRef,
  landmarks,
  presentacion,
  perspectiva,
  onCambiarPerspectiva,
  calibracionPostural,
  onMarcaPosturaNeutra,
  onLimpiarCalibracion,
  dispositivosVideo = [],
  idDispositivoSeleccionado,
  onSeleccionarDispositivo,
  camarasOficinaDisponibles = [],
  fuenteOficinaActual = 0,
  onCambiarFuenteOficina,
}: Props) {
  const activa = estado === "activa";

  return (
    <div className="space-y-3">
      <MarcoVideo
        modoCamara={modoCamara}
        onCambiarModo={onCambiarModo}
        fuenteCamara={fuenteCamara}
        onCambiarFuenteCamara={onCambiarFuenteCamara}
        personas={personas}
        estadoConexionVisionNode={estadoConexionVisionNode}
        ticketVideoOficina={ticketVideoOficina}
        estado={estado}
        error={error}
        videoRef={videoRef}
        landmarks={landmarks}
        presentacion={presentacion}
      />

      <BarraControlesCamara
        modoCamara={modoCamara}
        onCambiarModo={onCambiarModo}
        fuenteCamara={fuenteCamara}
        onCambiarFuenteCamara={onCambiarFuenteCamara}
        perspectiva={perspectiva}
        onCambiarPerspectiva={onCambiarPerspectiva}
        dispositivosVideo={dispositivosVideo}
        idDispositivoSeleccionado={idDispositivoSeleccionado}
        onSeleccionarDispositivo={onSeleccionarDispositivo}
        camarasOficinaDisponibles={camarasOficinaDisponibles}
        fuenteOficinaActual={fuenteOficinaActual}
        onCambiarFuenteOficina={onCambiarFuenteOficina}
        calibrada={estaCalibrada(calibracionPostural)}
        puedeMarcarPostura={activa && landmarks !== null}
        onMarcaPosturaNeutra={onMarcaPosturaNeutra}
        onLimpiarCalibracion={onLimpiarCalibracion}
      />

      {modoCamara && fuenteCamara === "webcam" && (
        <TarjetaCalibracion calibracion={calibracionPostural} camaraActiva={activa} />
      )}

      {origenRecursos === "cdn" && activa && (
        <p className="text-muted-foreground text-center text-xs text-balance">
          El detector se cargó desde internet. Ejecuta <code className="bg-muted rounded px-1">npm run preparar-camara</code>{" "}
          para que funcione sin conexión.
        </p>
      )}

      <p className="text-muted-foreground text-center text-xs text-balance">
        <ShieldCheck className="text-primary mr-1.5 inline size-3.5 align-text-bottom" aria-hidden />
        El video nunca se guarda ni se envía a ningún servidor. Solo se calculan ángulos y puntajes, y se
        quedan en este equipo.
      </p>
    </div>
  );
}
