/**
 * Formas del estado postural.
 *
 * NO son decoracion. El criterio 1.4.1 de WCAG 2.2 ("Use of Color") prohibe
 * comunicar informacion solo con color, y un semaforo verde/ambar/rojo lo
 * infringe por si solo: cerca del 8% de los hombres no distingue rojo de verde.
 *
 * El caso critico es el icono de bandeja de Windows: mide 16x16 px, ahi no cabe
 * texto, y la forma pasa a ser el unico canal disponible ademas del color. Por
 * eso cada estado tiene una silueta inconfundible incluso a ese tamano:
 *
 *   circulo      postura correcta
 *   triangulo    vigilando (mismo simbolo que una senal de precaucion)
 *   octagono     corregir (mismo simbolo que un pare)
 *   pausa        sin deteccion
 *   interrogante sin camara
 */

import type { PresentacionEstado } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

interface Props {
  forma: PresentacionEstado["forma"];
  className?: string;
  /** Tamano en px del lado del cuadro. */
  tamano?: number;
}

export function FormaEstado({ forma, className, tamano = 24 }: Props) {
  const comun = {
    width: tamano,
    height: tamano,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cn("shrink-0", className),
    // Decorativo: el texto que lo acompana ya lleva la informacion. Anunciarlo
    // dos veces al lector de pantalla es ruido.
    "aria-hidden": true,
  };

  switch (forma) {
    case "circulo":
      return (
        <svg {...comun}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
        </svg>
      );

    case "triangulo":
      return (
        <svg {...comun}>
          <path d="M12 3.6 22 20H2Z" />
          <path d="M12 10v4.2" />
          <path d="M12 17.2h.01" />
        </svg>
      );

    case "octagono":
      return (
        <svg {...comun}>
          <path d="M8.4 2.5h7.2L21.5 8.4v7.2l-5.9 5.9H8.4l-5.9-5.9V8.4Z" />
          <path d="M12 7.8v4.6" />
          <path d="M12 16h.01" />
        </svg>
      );

    case "pausa":
      return (
        <svg {...comun}>
          <rect x="4.5" y="4" width="4.6" height="16" rx="1.4" />
          <rect x="14.9" y="4" width="4.6" height="16" rx="1.4" />
        </svg>
      );

    case "interrogacion":
      return (
        <svg {...comun}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.4 9.3a2.7 2.7 0 1 1 3.5 2.6c-.6.2-.9.8-.9 1.4v.5" />
          <path d="M12 17h.01" />
        </svg>
      );
  }
}

/**
 * Version diminuta, tal como se veria en la bandeja del sistema de Windows.
 *
 * Se dibuja a 16 px reales, sin escalar desde un tamano mayor: es la unica forma
 * de comprobar que las siluetas siguen siendo distinguibles a ese tamano.
 */
export function IconoBandeja({
  forma,
  className,
}: {
  forma: PresentacionEstado["forma"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-4 items-center justify-center rounded-[3px]",
        className,
      )}
    >
      <FormaEstado forma={forma} tamano={16} className="[stroke-width:2.75]" />
    </span>
  );
}
