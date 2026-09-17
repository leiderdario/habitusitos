/**
 * Recuadro de video con el esqueleto superpuesto.
 *
 * Muestra el video de la camara (en espejo) y un lienzo transparente encima
 * donde se dibuja la pose detectada. En modo simulado ensena una silueta
 * esquematica que reacciona al estado de la sesion.
 *
 * Incluye selector informativo de 3 angulos de perspectiva horizontal:
 * (Al frente, Al lado, En diagonal).
 */

import { useEffect, useRef, useState } from "react";
import type { CalibracionPostural, CodigoError, Landmark, Landmark3D, PresentacionEstado } from "@/dominio/tipos";
import { config } from "@/config/app.config";
import { CATALOGO_ERRORES } from "@/datos/cliente";
import type { DispositivoVideoInfo, EstadoCamara, FuenteCamara } from "@/camara/use-camara";
import { OPCIONES_PERSPECTIVA, type PerspectivaCamara } from "@/dominio/perspectivas";
import type { CamaraOficinaLocal, EstadoConexionVisionNode, EstadoPersona } from "@/estado/simulacion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Building2, Camera, CameraOff, Eye, Link2, Loader2, ShieldCheck, Users, Video } from "lucide-react";

/** Conexiones que forman el esqueleto visible. Indices de BlazePose / MediaPipe Pose. */
const CONEXIONES: readonly [number, number][] = [
  [11, 12], // hombro izquierdo - hombro derecho
  [11, 13], // hombro izq - codo izq
  [13, 15], // codo izq - muneca izq
  [12, 14], // hombro der - codo der
  [14, 16], // codo der - muneca der
  [11, 23], // hombro izq - cadera izq
  [12, 24], // hombro der - cadera der
  [23, 24], // cadera izq - cadera der
  [7, 8],   // oreja izq - oreja der
];

interface Props {
  modoCamara: boolean;
  onCambiarModo(activo: boolean): void;
  fuenteCamara?: FuenteCamara;
  onCambiarFuenteCamara?(fuente: FuenteCamara): void;
  personas?: Map<string, EstadoPersona>;
  estadoConexionVisionNode?: EstadoConexionVisionNode;
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

  // Selección de cámara web personal
  dispositivosVideo?: DispositivoVideoInfo[];
  idDispositivoSeleccionado?: string | null;
  onSeleccionarDispositivo?(deviceId: string): void;

  // Selección y control de fuente de oficina
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
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const [urlRtspInput, setUrlRtspInput] = useState<string>("");
  const [mostrarInputRtsp, setMostrarInputRtsp] = useState<boolean>(false);

  // Funcion auxiliar para dibujar un esqueleto individual
  const dibujarEsqueletoIndividual = (
    ctx: CanvasRenderingContext2D,
    lms: Landmark[],
    color: string,
    width: number,
    height: number,
    etiqueta?: string,
  ) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const umbral = config.UMBRAL_VISIBILIDAD_LANDMARK;

    // Conexiones estandar
    for (const [a, b] of CONEXIONES) {
      const pa = lms[a];
      const pb = lms[b];
      if (!pa || !pb || (pa.visibility ?? 1) < umbral || (pb.visibility ?? 1) < umbral) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * width, pa.y * height);
      ctx.lineTo(pb.x * width, pb.y * height);
      ctx.stroke();
    }

    const hombroIzq = lms[11];
    const hombroDer = lms[12];
    const orejaIzq = lms[7];
    const orejaDer = lms[8];
    const caderaIzq = lms[23];
    const caderaDer = lms[24];
    const bocaIzq = lms[9];
    const bocaDer = lms[10];
    const nariz = lms[0];

    // Conexiones anatomicas sintetizadas: Cadena de Cuello (C7, C4, C1) y Columna
    if (
      hombroIzq &&
      hombroDer &&
      (hombroIzq.visibility ?? 1) >= umbral &&
      (hombroDer.visibility ?? 1) >= umbral
    ) {
      const cuelloBaseX = (hombroIzq.x + hombroDer.x) / 2;
      const cuelloBaseY = (hombroIzq.y + hombroDer.y) / 2;

      let cuelloTopeX = cuelloBaseX;
      let cuelloTopeY = cuelloBaseY - 0.12;

      if (
        orejaIzq &&
        orejaDer &&
        (orejaIzq.visibility ?? 1) >= umbral &&
        (orejaDer.visibility ?? 1) >= umbral
      ) {
        const orejasX = (orejaIzq.x + orejaDer.x) / 2;
        const orejasY = (orejaIzq.y + orejaDer.y) / 2;

        if (bocaIzq && bocaDer && (bocaIzq.visibility ?? 1) >= umbral && (bocaDer.visibility ?? 1) >= umbral) {
          const bocaX = (bocaIzq.x + bocaDer.x) / 2;
          const bocaY = (bocaIzq.y + bocaDer.y) / 2;
          cuelloTopeX = orejasX * 0.65 + bocaX * 0.35;
          cuelloTopeY = orejasY * 0.65 + bocaY * 0.35;
        } else if (nariz && (nariz.visibility ?? 1) >= umbral) {
          cuelloTopeX = orejasX * 0.7 + nariz.x * 0.3;
          cuelloTopeY = orejasY * 0.7 + nariz.y * 0.3;
        } else {
          cuelloTopeX = orejasX;
          cuelloTopeY = orejasY;
        }
      }

      const cuelloMedioX = (cuelloBaseX + cuelloTopeX) / 2;
      const cuelloMedioY = (cuelloBaseY + cuelloTopeY) / 2;

      // Trazo del cuello completo: Base (C7) -> Centro (C4) -> Tope (C1)
      ctx.beginPath();
      ctx.moveTo(cuelloBaseX * width, cuelloBaseY * height);
      ctx.lineTo(cuelloMedioX * width, cuelloMedioY * height);
      ctx.lineTo(cuelloTopeX * width, cuelloTopeY * height);
      ctx.stroke();

      // Trazo de hombros a base del cuello
      ctx.beginPath();
      ctx.moveTo(hombroIzq.x * width, hombroIzq.y * height);
      ctx.lineTo(cuelloBaseX * width, cuelloBaseY * height);
      ctx.lineTo(hombroDer.x * width, hombroDer.y * height);
      ctx.stroke();

      // Trazo de columna
      if (
        caderaIzq &&
        caderaDer &&
        (caderaIzq.visibility ?? 1) >= umbral &&
        (caderaDer.visibility ?? 1) >= umbral
      ) {
        const pelvisX = (caderaIzq.x + caderaDer.x) / 2;
        const pelvisY = (caderaIzq.y + caderaDer.y) / 2;
        ctx.beginPath();
        ctx.moveTo(cuelloBaseX * width, cuelloBaseY * height);
        ctx.lineTo(pelvisX * width, pelvisY * height);
        ctx.stroke();
      }

      // Dibujar los 3 puntos del cuello
      ctx.beginPath();
      ctx.arc(cuelloBaseX * width, cuelloBaseY * height, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cuelloMedioX * width, cuelloMedioY * height, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cuelloTopeX * width, cuelloTopeY * height, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Puntos del cuerpo
    for (const indice of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = lms[indice];
      if (!p || (p.visibility ?? 1) < umbral) continue;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Etiqueta identificadora si se provee
    if (etiqueta && nariz && (nariz.visibility ?? 1) >= umbral) {
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(etiqueta, nariz.x * width - 30, Math.max(20, nariz.y * height - 16));
    }
  };

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
        const color = estilo.getPropertyValue(`--${p.presentacion.tokenColor}`).trim();
        const etiqueta = `${p.id} (${Math.round(p.puntajeSuavizado)} pts)`;
        dibujarEsqueletoIndividual(ctx, p.pose.landmarks, color, lienzo.width, lienzo.height, etiqueta);
      }
    } else if (landmarks) {
      // Modo personal clasico: un solo esqueleto
      const color = estilo.getPropertyValue(`--${presentacion.tokenColor}`).trim();
      dibujarEsqueletoIndividual(ctx, landmarks, color, lienzo.width, lienzo.height);
    }
  }, [landmarks, personas, fuenteCamara, presentacion.tokenColor]);

  return (
    <div className="space-y-3">
      <div className="bg-muted relative aspect-4/3 overflow-hidden rounded-xl">
        {fuenteCamara === "webcam" ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "size-full object-cover -scale-x-100",
              estado === "activa" ? "block" : "hidden",
            )}
          />
        ) : (
          <img
            src={
              (import.meta.env.VITE_VISION_STREAM_URL as string | undefined) ||
              "http://127.0.0.1:8766/video_feed"
            }
            alt="Video en vivo de camara de oficina"
            className={cn(
              "size-full object-cover",
              estado === "activa" ? "block" : "hidden",
            )}
          />
        )}
        <canvas
          ref={lienzoRef}
          width={640}
          height={480}
          className={cn(
            "pointer-events-none absolute inset-0 size-full",
            fuenteCamara === "webcam" ? "-scale-x-100" : "",
            estado === "activa" ? "block" : "hidden",
          )}
        />

        {estado !== "activa" && (
          <div className="bg-muted/90 text-card-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {estado === "cargando-modelo" || estado === "pidiendo-permiso" ? (
              <>
                <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
                <p className="text-muted-foreground text-sm text-balance">
                  {fuenteCamara === "oficina"
                    ? "Conectando al servicio Vision Node en ws://127.0.0.1:8765..."
                    : estado === "cargando-modelo"
                      ? "Preparando el detector de postura. La primera vez puede tardar unos segundos."
                      : "Esperando a que autorices el uso de la camara."}
                </p>
              </>
            ) : error ? (
              <>
                <CameraOff className="text-muted-foreground size-8" aria-hidden />
                <p className="text-sm font-medium">{CATALOGO_ERRORES[error].titulo}</p>
                <p className="text-muted-foreground max-w-sm text-xs text-balance">
                  {CATALOGO_ERRORES[error].mensaje}
                </p>
                <Button variant="outline" size="sm" onClick={() => onCambiarModo(true)}>
                  {CATALOGO_ERRORES[error].accion}
                </Button>
              </>
            ) : (
              <SiluetaSimulada presentacion={presentacion} />
            )}
          </div>
        )}

        {/* Barra superior de estado y perspectiva sin solapamiento */}
        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-2 z-10">
          <span className="bg-card/85 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur shadow-xs border border-border/40">
            {estado === "activa" ? (
              fuenteCamara === "oficina" ? (
                <>
                  <Users className="size-3 text-primary shrink-0" />
                  <span>Camara de oficina</span>
                </>
              ) : (
                <>
                  <Camera className="size-3 text-primary shrink-0" />
                  <span>Webcam en vivo</span>
                </>
              )
            ) : (
              "Vista simulada"
            )}
          </span>

          {fuenteCamara === "webcam" && (
            <div className="bg-card/90 flex items-center gap-1 rounded-md p-1 text-[11px] font-medium backdrop-blur shadow-xs border border-border/40 shrink-0">
              <span className="text-muted-foreground px-1 hidden sm:inline-flex items-center gap-1">
                <Eye className="size-3" />
                Angulo:
              </span>
              {OPCIONES_PERSPECTIVA.map((opc) => (
                <button
                  key={opc.id}
                  type="button"
                  onClick={() => onCambiarPerspectiva(opc.id)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                    perspectiva === opc.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title={opc.descripcion}
                >
                  {opc.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Banner de estado de conexion con Vision Node (Paso 2 mejora.md) */}
        {modoCamara && fuenteCamara === "oficina" && estadoConexionVisionNode && estadoConexionVisionNode.tipo !== "inactivo" && (
          <div
            className={cn(
              "absolute top-11 inset-x-3 z-10 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium backdrop-blur shadow-xs border transition-all",
              estadoConexionVisionNode.tipo === "desconectado"
                ? "border-destructive/30 bg-destructive/15 text-destructive"
                : estadoConexionVisionNode.tipo === "conectado_con_personas"
                  ? "border-primary/30 bg-primary/15 text-primary"
                  : estadoConexionVisionNode.tipo === "conectado_sin_personas"
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/90 text-muted-foreground"
            )}
          >
            {estadoConexionVisionNode.tipo === "conectando" && (
              <div className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                <span>Conectando al servidor de vision…</span>
              </div>
            )}
            {estadoConexionVisionNode.tipo === "conectado_sin_personas" && (
              <div className="flex items-center gap-2">
                <Users className="size-3.5 shrink-0" aria-hidden />
                <span>Conectado — buscando personas en el encuadre</span>
              </div>
            )}
            {estadoConexionVisionNode.tipo === "conectado_con_personas" && (
              <div className="flex items-center gap-2 font-semibold">
                <Users className="size-3.5 shrink-0" aria-hidden />
                <span>Conectado — {estadoConexionVisionNode.cantidad} persona(s) detectada(s)</span>
              </div>
            )}
            {estadoConexionVisionNode.tipo === "desconectado" && (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <CameraOff className="size-3.5 shrink-0" aria-hidden />
                  <span>Sin conexion con el servidor de vision</span>
                </div>
                {onCambiarFuenteCamara && (
                  <button
                    type="button"
                    onClick={() => onCambiarFuenteCamara("oficina")}
                    className="underline font-semibold cursor-pointer hover:opacity-80 ml-2"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="modo-camara"
              checked={modoCamara}
              onCheckedChange={onCambiarModo}
            />
            <Label htmlFor="modo-camara" className="flex items-center gap-1.5 text-sm font-medium">
              <Camera className="size-3.5" aria-hidden />
              Activar camara
            </Label>
          </div>

          {/* Selector de fuente de camara con alto contraste (Paso 5 mejora.md) */}
          {modoCamara && onCambiarFuenteCamara && (
            <div className="bg-muted p-1 inline-flex rounded-lg border border-border/60 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => onCambiarFuenteCamara("webcam")}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1.5",
                  fuenteCamara === "webcam"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40 font-normal"
                )}
              >
                <Camera className="size-3.5" />
                Webcam personal
              </button>
              <button
                type="button"
                onClick={() => onCambiarFuenteCamara("oficina")}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1.5",
                  fuenteCamara === "oficina"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40 font-normal"
                )}
              >
                <Building2 className="size-3.5" />
                Camara de oficina (servidor)
              </button>
            </div>
          )}
        </div>

        {/* Selector de dispositivo para Webcam personal */}
        {modoCamara && fuenteCamara === "webcam" && (
          <div className="bg-muted/40 border-border/50 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <Video className="size-3.5 text-primary" />
              Cámara personal:
            </span>
            {dispositivosVideo.length > 0 ? (
              <select
                aria-label="Seleccionar cámara web personal"
                value={idDispositivoSeleccionado ?? ""}
                onChange={(e) => onSeleccionarDispositivo?.(e.target.value)}
                className="bg-background border-border text-foreground hover:bg-muted/20 focus:ring-primary h-7 max-w-[280px] rounded-md border px-2 py-0.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-1 cursor-pointer"
              >
                {dispositivosVideo.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-muted-foreground italic">
                Detectando cámaras disponibles...
              </span>
            )}
          </div>
        )}

        {/* Selector de fuente para Cámara de oficina y vigilancia IP */}
        {modoCamara && fuenteCamara === "oficina" && (
          <div className="bg-muted/40 border-border/50 flex flex-col gap-2 rounded-lg border p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <Building2 className="size-3.5 text-primary" />
                Fuente de oficina:
              </span>
              <select
                aria-label="Seleccionar fuente de cámara de oficina"
                value={
                  typeof fuenteOficinaActual === "string" && fuenteOficinaActual.startsWith("rtsp://")
                    ? "rtsp"
                    : String(fuenteOficinaActual)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "rtsp") {
                    setMostrarInputRtsp(true);
                  } else {
                    setMostrarInputRtsp(false);
                    onCambiarFuenteOficina?.(Number(val));
                  }
                }}
                className="bg-background border-border text-foreground hover:bg-muted/20 focus:ring-primary h-7 rounded-md border px-2 py-0.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-1 cursor-pointer"
              >
                {camarasOficinaDisponibles.length > 0 ? (
                  camarasOficinaDisponibles.map((cam) => (
                    <option key={cam.id} value={String(cam.id)}>
                      {cam.nombre}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="0">Cámara local 0 (Integrada)</option>
                    <option value="1">Cámara local 1 (USB)</option>
                  </>
                )}
                <option value="rtsp">📹 Cámara IP de vigilancia (RTSP / HTTP)</option>
              </select>

              <button
                type="button"
                onClick={() => setMostrarInputRtsp((prev) => !prev)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] underline underline-offset-2 cursor-pointer"
              >
                <Link2 className="size-3" />
                {mostrarInputRtsp ? "Ocultar URL de vigilancia" : "Ingresar URL de vigilancia"}
              </button>
            </div>

            {mostrarInputRtsp && (
              <div className="bg-background/80 border-border/70 flex flex-wrap items-center gap-2 rounded-md border p-2 shadow-xs">
                <input
                  type="text"
                  placeholder="rtsp://admin:pass@192.168.1.50:554/stream1"
                  value={urlRtspInput}
                  onChange={(e) => setUrlRtspInput(e.target.value)}
                  className="border-input placeholder:text-muted-foreground focus:ring-primary h-7 flex-1 min-w-[220px] rounded-md border px-2.5 py-0.5 text-xs font-mono focus:outline-none focus:ring-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => {
                    if (urlRtspInput.trim()) {
                      onCambiarFuenteOficina?.(urlRtspInput.trim());
                    }
                  }}
                  disabled={!urlRtspInput.trim()}
                >
                  Conectar stream
                </Button>
                <span className="text-muted-foreground w-full text-[11px]">
                  Admite cámaras de vigilancia IP de oficina (RTSP/ONVIF), cámaras IP y streams HTTP/MJPEG.
                </span>
              </div>
            )}
          </div>
        )}

        {origenRecursos === "cdn" && estado === "activa" && (
          <span className="text-muted-foreground text-xs">
            Detector cargado desde internet. Ejecuta{" "}
            <code className="bg-muted rounded px-1">npm run preparar-camara</code> para
            que funcione sin conexion.
          </span>
        )}
      </div>

      {modoCamara && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-3 rounded-lg p-3">
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium">Tu postura de referencia</p>
            <p className="text-muted-foreground text-xs text-balance">
              {calibracionPostural.offsetZ > 0 || calibracionPostural.vectorArriba !== null
                ? calibracionPostural.vectorArriba !== null
                  ? "Calibrado: la app ajusto la distancia y la inclinacion respecto a tu camara."
                  : "Calibrado: la app ajusto la distancia natural de tu cabeza frente a la camara."
                : estado === "activa"
                  ? "Sientate como te sientas siempre y marca tu postura de referencia para calibrar angulo y distancia."
                  : "En cuanto la camara detecte tu rostro y cuerpo, podras marcar tu postura de referencia."}
            </p>
          </div>
          {calibracionPostural.offsetZ > 0 || calibracionPostural.vectorArriba !== null ? (
            <Button variant="outline" size="sm" onClick={onLimpiarCalibracion}>
              Quitar calibracion
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onMarcaPosturaNeutra}
              disabled={estado !== "activa" || !landmarks}
            >
              Marca tu postura normal
            </Button>
          )}
        </div>
      )}

      <p className="text-muted-foreground flex items-start gap-1.5 text-xs text-balance">
        <ShieldCheck className="text-accent mt-0.5 size-3.5 shrink-0" aria-hidden />
        El video nunca se guarda ni se envia a ningun servidor. Solo se calculan
        angulos y puntajes, y se quedan en este equipo.
      </p>
    </div>
  );
}

function SiluetaSimulada({ presentacion }: { presentacion: PresentacionEstado }) {
  const inclinacion =
    presentacion.estado === "alerta" ? 14 : presentacion.estado === "vigilando" ? 7 : 0;

  return (
    <svg
      viewBox="0 0 120 100"
      className="h-32 w-40"
      fill="none"
      stroke={`var(--${presentacion.tokenColor})`}
      strokeWidth="3"
      strokeLinecap="round"
      role="img"
      aria-label={`Silueta esquematica en estado ${presentacion.etiqueta}`}
    >
      <g style={{ transform: `rotate(${inclinacion}deg)`, transformOrigin: "60px 78px" }}>
        <circle cx="60" cy="26" r="13" />
        <path d="M60 39v26" />
        <path d="M38 66h44" />
        <path d="M42 66v22M78 66v22" />
      </g>
      <path d="M18 92h84" strokeOpacity="0.25" />
    </svg>
  );
}
