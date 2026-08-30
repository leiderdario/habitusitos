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

import { useEffect, useRef } from "react";
import type { CalibracionPostural, CodigoError, Landmark, Landmark3D, PresentacionEstado } from "@/dominio/tipos";
import { config } from "@/config/app.config";
import { CATALOGO_ERRORES } from "@/datos/cliente";
import type { EstadoCamara } from "@/camara/use-camara";
import { OPCIONES_PERSPECTIVA, type PerspectivaCamara } from "@/dominio/perspectivas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Camera, CameraOff, Eye, Loader2, ShieldCheck } from "lucide-react";

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
  estado: EstadoCamara;
  error: CodigoError | null;
  origenRecursos: "local" | "cdn" | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarks: Landmark[] | null;
  worldLandmarks?: Landmark3D[] | null;
  presentacion: PresentacionEstado;
  perspectiva: PerspectivaCamara;
  onCambiarPerspectiva(perspectiva: PerspectivaCamara): void;
  calibracionPostural: CalibracionPostural;
  onMarcaPosturaNeutra(): void;
  onLimpiarCalibracion(): void;
}

export function VistaCamara({
  modoCamara,
  onCambiarModo,
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
}: Props) {
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);

  // Dibujo del esqueleto sobre el video.
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    if (!landmarks) return;

    const estilo = getComputedStyle(document.documentElement);
    const color = estilo.getPropertyValue(`--${presentacion.tokenColor}`).trim();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const umbral = config.UMBRAL_VISIBILIDAD_LANDMARK;

    // Conexiones estandar
    for (const [a, b] of CONEXIONES) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb || (pa.visibility ?? 1) < umbral || (pb.visibility ?? 1) < umbral) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * lienzo.width, pa.y * lienzo.height);
      ctx.lineTo(pb.x * lienzo.width, pb.y * lienzo.height);
      ctx.stroke();
    }

    const hombroIzq = landmarks[11];
    const hombroDer = landmarks[12];
    const orejaIzq = landmarks[7];
    const orejaDer = landmarks[8];
    const caderaIzq = landmarks[23];
    const caderaDer = landmarks[24];
    const bocaIzq = landmarks[9];
    const bocaDer = landmarks[10];
    const nariz = landmarks[0];

    // Conexiones anatomicas sintetizadas: Cadena de Cuello (C7, C4, C1) y Columna
    if (
      hombroIzq &&
      hombroDer &&
      (hombroIzq.visibility ?? 1) >= umbral &&
      (hombroDer.visibility ?? 1) >= umbral
    ) {
      // 1. Base del cuello (C7 / punto medio de hombros)
      const cuelloBaseX = (hombroIzq.x + hombroDer.x) / 2;
      const cuelloBaseY = (hombroIzq.y + hombroDer.y) / 2;

      // 2. Tope cervical (C1 / articulacion suboccipital)
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

      // 3. Centro del cuello (C4)
      const cuelloMedioX = (cuelloBaseX + cuelloTopeX) / 2;
      const cuelloMedioY = (cuelloBaseY + cuelloTopeY) / 2;

      // Trazo del cuello completo: Base (C7) -> Centro (C4) -> Tope (C1)
      ctx.beginPath();
      ctx.moveTo(cuelloBaseX * lienzo.width, cuelloBaseY * lienzo.height);
      ctx.lineTo(cuelloMedioX * lienzo.width, cuelloMedioY * lienzo.height);
      ctx.lineTo(cuelloTopeX * lienzo.width, cuelloTopeY * lienzo.height);
      ctx.stroke();

      // Trazo de hombros a base del cuello
      ctx.beginPath();
      ctx.moveTo(hombroIzq.x * lienzo.width, hombroIzq.y * lienzo.height);
      ctx.lineTo(cuelloBaseX * lienzo.width, cuelloBaseY * lienzo.height);
      ctx.lineTo(hombroDer.x * lienzo.width, hombroDer.y * lienzo.height);
      ctx.stroke();

      // Trazo de columna: cuello (C7) hacia pelvis
      if (
        caderaIzq &&
        caderaDer &&
        (caderaIzq.visibility ?? 1) >= umbral &&
        (caderaDer.visibility ?? 1) >= umbral
      ) {
        const pelvisX = (caderaIzq.x + caderaDer.x) / 2;
        const pelvisY = (caderaIzq.y + caderaDer.y) / 2;
        ctx.beginPath();
        ctx.moveTo(cuelloBaseX * lienzo.width, cuelloBaseY * lienzo.height);
        ctx.lineTo(pelvisX * lienzo.width, pelvisY * lienzo.height);
        ctx.stroke();
      }

      // Dibujar los 3 puntos del cuello explícitos
      // C7 - Base del cuello
      ctx.beginPath();
      ctx.arc(cuelloBaseX * lienzo.width, cuelloBaseY * lienzo.height, 6, 0, Math.PI * 2);
      ctx.fill();

      // C4 - Centro del cuello
      ctx.beginPath();
      ctx.arc(cuelloMedioX * lienzo.width, cuelloMedioY * lienzo.height, 5, 0, Math.PI * 2);
      ctx.fill();

      // C1 - Tope del cuello
      ctx.beginPath();
      ctx.arc(cuelloTopeX * lienzo.width, cuelloTopeY * lienzo.height, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Puntos del cuerpo
    for (const indice of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = landmarks[indice];
      if (!p || (p.visibility ?? 1) < umbral) continue;
      ctx.beginPath();
      ctx.arc(p.x * lienzo.width, p.y * lienzo.height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks, presentacion.tokenColor]);

  return (
    <div className="space-y-3">
      <div className="bg-muted relative aspect-4/3 overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          className={cn(
            "size-full object-cover",
            "-scale-x-100",
            estado === "activa" ? "opacity-100" : "opacity-0",
          )}
          playsInline
          muted
        />
        <canvas
          ref={lienzoRef}
          width={640}
          height={480}
          className={cn(
            "absolute inset-0 size-full -scale-x-100",
            estado === "activa" ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />

        {estado !== "activa" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {estado === "cargando-modelo" || estado === "pidiendo-permiso" ? (
              <>
                <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
                <p className="text-muted-foreground text-sm text-balance">
                  {estado === "cargando-modelo"
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

        {/* Badge de estado en la esquina superior izquierda */}
        <span className="bg-card/85 absolute top-2 left-2 rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur">
          {estado === "activa" ? "Camara en vivo" : "Vista simulada"}
        </span>

        {/* Selector de perspectiva (3 opciones de angulo horizontal) en la esquina superior derecha */}
        <div className="bg-card/90 absolute top-2 right-2 flex items-center gap-1 rounded-md p-1 text-[11px] font-medium backdrop-blur shadow-xs border border-border/40">
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Switch
            id="modo-camara"
            checked={modoCamara}
            onCheckedChange={onCambiarModo}
          />
          <Label htmlFor="modo-camara" className="flex items-center gap-1.5 text-sm">
            <Camera className="size-3.5" aria-hidden />
            Usar mi camara de verdad
          </Label>
        </div>

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
