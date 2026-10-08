/**
 * Barra de controles de la camara.
 *
 * Aporte propio de Espinker (docs/PLAN_REDISENO_ESPINKER.md, Fase 4). Reune en
 * una sola fila, bajo el video y siempre en el mismo sitio, lo que antes estaba
 * repartido: el selector de angulo (encima de la imagen, con botones de 11 px),
 * el interruptor de camara, las fuentes y la calibracion.
 *
 * Objetivos de 40 px de alto (WCAG 2.5.8 pide 24): se manejan con mouse sin
 * apuntar con cuidado. Los desplegables usan CampoSelect, no <select> nativos.
 */

import { Building2, Camera, Crosshair, Video, VideoOff } from "lucide-react";
import type { DispositivoVideoInfo, FuenteCamara } from "@/camara/use-camara";
import { OPCIONES_PERSPECTIVA, type PerspectivaCamara } from "@/dominio/perspectivas";
import type { CamaraOficinaLocal } from "@/estado/simulacion";
import { CampoSelect } from "@/componentes/comunes/campo-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Opcion<T extends string> {
  valor: T;
  texto: string;
  titulo?: string;
  icono?: typeof Camera;
}

function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  onCambio(valor: T): void;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="border-input inline-flex overflow-hidden rounded-lg border"
    >
      {opciones.map(({ valor: v, texto, titulo, icono: Icono }) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          title={titulo}
          onClick={() => onCambio(v)}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 px-3 text-sm transition-colors",
            valor === v
              ? "bg-primary text-primary-foreground font-semibold"
              : "bg-card text-card-foreground hover:bg-muted",
          )}
        >
          {Icono && <Icono className="size-4" aria-hidden />}
          {texto}
        </button>
      ))}
    </div>
  );
}

const OPCIONES_FUENTE: readonly Opcion<FuenteCamara>[] = [
  { valor: "webcam", texto: "Webcam personal", icono: Camera },
  { valor: "oficina", texto: "Cámara de oficina", icono: Building2 },
];

interface Props {
  modoCamara: boolean;
  onCambiarModo(activo: boolean): void;
  fuenteCamara: FuenteCamara;
  onCambiarFuenteCamara?(fuente: FuenteCamara): void;
  perspectiva: PerspectivaCamara;
  onCambiarPerspectiva(perspectiva: PerspectivaCamara): void;
  dispositivosVideo: DispositivoVideoInfo[];
  idDispositivoSeleccionado?: string | null;
  onSeleccionarDispositivo?(deviceId: string): void;
  camarasOficinaDisponibles: CamaraOficinaLocal[];
  fuenteOficinaActual: number | string;
  onCambiarFuenteOficina?(nuevaFuente: number | string): void;
  calibrada: boolean;
  puedeMarcarPostura: boolean;
  onMarcaPosturaNeutra(): void;
  onLimpiarCalibracion(): void;
}

export function BarraControlesCamara({
  modoCamara,
  onCambiarModo,
  fuenteCamara,
  onCambiarFuenteCamara,
  perspectiva,
  onCambiarPerspectiva,
  dispositivosVideo,
  idDispositivoSeleccionado,
  onSeleccionarDispositivo,
  camarasOficinaDisponibles,
  fuenteOficinaActual,
  onCambiarFuenteOficina,
  calibrada,
  puedeMarcarPostura,
  onMarcaPosturaNeutra,
  onLimpiarCalibracion,
}: Props) {
  const esWebcam = fuenteCamara === "webcam";

  return (
    <div
      role="toolbar"
      aria-label="Controles de la cámara"
      className="bg-card border-border flex flex-wrap items-center justify-center gap-2 rounded-2xl border p-2"
    >
      <Button
        type="button"
        variant={modoCamara ? "outline" : "default"}
        className={cn("h-10 px-4", modoCamara && "border-input")}
        onClick={() => onCambiarModo(!modoCamara)}
      >
        {modoCamara ? <VideoOff aria-hidden /> : <Video aria-hidden />}
        {modoCamara ? "Apagar cámara" : "Activar cámara"}
      </Button>

      {modoCamara && onCambiarFuenteCamara && (
        <Segmentado
          etiqueta="Fuente de la cámara"
          opciones={OPCIONES_FUENTE}
          valor={fuenteCamara}
          onCambio={onCambiarFuenteCamara}
        />
      )}

      {modoCamara && esWebcam && (
        <CampoSelect
          id="dispositivo-webcam"
          etiqueta="Cámara personal"
          etiquetaOculta
          claseDisparador="data-[size=default]:h-10 min-w-48 max-w-64"
          valor={idDispositivoSeleccionado ?? ""}
          opciones={
            dispositivosVideo.length > 0
              ? dispositivosVideo.map((d) => ({ valor: d.deviceId, texto: d.label }))
              : [{ valor: "", texto: "Detectando cámaras…" }]
          }
          onCambio={(id) => onSeleccionarDispositivo?.(id)}
        />
      )}

      {modoCamara && !esWebcam && (
        // Solo se ofrecen camaras detectadas y fuentes de red que el administrador
        // declaro en el nodo: el cliente no puede escribir una URL.
        <CampoSelect
          id="fuente-oficina"
          etiqueta="Fuente de la cámara de oficina"
          etiquetaOculta
          claseDisparador="data-[size=default]:h-10 min-w-48 max-w-64"
          valor={String(fuenteOficinaActual)}
          opciones={
            camarasOficinaDisponibles.length > 0
              ? camarasOficinaDisponibles.map((c) => ({ valor: String(c.id), texto: c.nombre }))
              : [{ valor: String(fuenteOficinaActual), texto: "Sin fuentes disponibles" }]
          }
          onCambio={(v) => {
            const elegida = camarasOficinaDisponibles.find((c) => String(c.id) === v);
            if (elegida) onCambiarFuenteOficina?.(elegida.id);
          }}
        />
      )}

      {esWebcam && (
        <Segmentado
          etiqueta="Ángulo de la cámara"
          opciones={OPCIONES_PERSPECTIVA.map((o) => ({
            valor: o.id,
            texto: o.etiqueta,
            titulo: o.descripcion,
          }))}
          valor={perspectiva}
          onCambio={onCambiarPerspectiva}
        />
      )}

      {modoCamara && esWebcam &&
        (calibrada ? (
          <Button type="button" variant="outline" className="border-input h-10" onClick={onLimpiarCalibracion}>
            Quitar calibración
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="h-10"
            onClick={onMarcaPosturaNeutra}
            disabled={!puedeMarcarPostura}
          >
            <Crosshair aria-hidden />
            Marca tu postura normal
          </Button>
        ))}
    </div>
  );
}
