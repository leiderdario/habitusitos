/**
 * Insignia del estado postural — los tres canales redundantes juntos.
 *
 * color + forma + texto, siempre. Ninguno de los tres se puede desactivar: es la
 * pieza que hace que la aplicacion cumpla WCAG 2.2 criterio 1.4.1 y que sea
 * legible para alguien con daltonismo rojo-verde.
 */

import type { PresentacionEstado } from "@/dominio/tipos";
import { cn } from "@/lib/utils";
import { FormaEstado } from "./forma-estado";

/** Clases por token. Se enumeran porque Tailwind no puede resolver nombres de
 *  clase construidos dinamicamente: `bg-${token}` nunca ha funcionado. */
const ESTILOS: Record<string, { texto: string; fondo: string; borde: string }> = {
  "estado-buena": {
    texto: "text-estado-buena",
    fondo: "bg-estado-buena-suave",
    borde: "border-estado-buena/25",
  },
  "estado-regular": {
    texto: "text-estado-regular",
    fondo: "bg-estado-regular-suave",
    borde: "border-estado-regular/25",
  },
  "estado-corrige": {
    texto: "text-estado-corrige",
    fondo: "bg-estado-corrige-suave",
    borde: "border-estado-corrige/25",
  },
  "estado-pausa": {
    texto: "text-estado-pausa",
    fondo: "bg-estado-pausa-suave",
    borde: "border-estado-pausa/25",
  },
};

interface Props {
  presentacion: PresentacionEstado;
  tamano?: "sm" | "md" | "lg";
  className?: string;
}

export function InsigniaEstado({ presentacion, tamano = "md", className }: Props) {
  const estilo = ESTILOS[presentacion.tokenColor] ?? ESTILOS["estado-pausa"];
  const dimensiones = {
    sm: { caja: "gap-1.5 px-2.5 py-1 text-xs", icono: 14 },
    md: { caja: "gap-2 px-3 py-1.5 text-sm", icono: 18 },
    lg: { caja: "gap-2.5 px-4 py-2 text-base", icono: 22 },
  }[tamano];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        estilo.fondo,
        estilo.texto,
        estilo.borde,
        dimensiones.caja,
        className,
      )}
    >
      <FormaEstado forma={presentacion.forma} tamano={dimensiones.icono} />
      {presentacion.etiqueta}
    </span>
  );
}

/** Clases de color sueltas, para quien necesite pintar otra cosa con el estado. */
export function clasesEstado(token: string) {
  return ESTILOS[token] ?? ESTILOS["estado-pausa"];
}
