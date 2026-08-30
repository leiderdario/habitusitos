/**
 * Medidor del puntaje de postura.
 *
 * Es el elemento con mas peso visual del panel, asi que carga tambien la
 * responsabilidad de accesibilidad: el numero es texto real (no una imagen), el
 * arco tiene `role="img"` con su etiqueta, y el estado va acompanado de forma y
 * palabra ademas de color.
 */

import type { PresentacionEstado } from "@/dominio/tipos";
import { cn } from "@/lib/utils";
import { InsigniaEstado } from "./insignia-estado";

interface Props {
  puntaje: number;
  presentacion: PresentacionEstado;
  className?: string;
}

const RADIO = 74;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
/** El arco cubre 270 grados: deja un hueco abajo que evita que se lea como un
 *  anillo cerrado de "progreso completado", que aqui no significaria nada. */
const PROPORCION_ARCO = 0.75;

export function MedidorPostura({ puntaje, presentacion, className }: Props) {
  const valor = Math.max(0, Math.min(100, puntaje));
  const relleno = CIRCUNFERENCIA * PROPORCION_ARCO * (valor / 100);
  const hueco = CIRCUNFERENCIA - relleno;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative">
        <svg
          width={188}
          height={188}
          viewBox="0 0 188 188"
          role="img"
          aria-label={`Puntaje de postura ${Math.round(valor)} de 100. Estado: ${presentacion.etiqueta}.`}
        >
          <g transform="rotate(135 94 94)">
            <circle
              cx="94"
              cy="94"
              r={RADIO}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUNFERENCIA * PROPORCION_ARCO} ${CIRCUNFERENCIA}`}
            />
            <circle
              cx="94"
              cy="94"
              r={RADIO}
              fill="none"
              stroke={`var(--${presentacion.tokenColor})`}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${relleno} ${hueco}`}
              className="transition-[stroke-dasharray,stroke] duration-500 ease-out"
            />
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-6xl leading-none font-semibold">
            {Math.round(valor)}
          </span>
          <span className="text-muted-foreground mt-1 text-xs tracking-wide uppercase">
            de 100
          </span>
        </div>
      </div>

      <InsigniaEstado presentacion={presentacion} tamano="lg" />
      <p className="text-muted-foreground max-w-xs text-center text-sm text-balance">
        {presentacion.descripcion}
      </p>
    </div>
  );
}
