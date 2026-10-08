/**
 * Silueta esquematica que se muestra cuando no hay camara.
 *
 * Heredada de la vista de camara; movida aqui al dividirla (Espinker, Fase 4).
 * Va en claro porque el fondo del video es siempre oscuro (token --video). El
 * estado ya no se pinta con su color aqui: lo comunican el anillo del marco, la
 * insignia del panel y la inclinacion de la propia silueta.
 */

import type { PresentacionEstado } from "@/dominio/tipos";

export function SiluetaSimulada({ presentacion }: { presentacion: PresentacionEstado }) {
  const inclinacion =
    presentacion.estado === "alerta" ? 14 : presentacion.estado === "vigilando" ? 7 : 0;

  return (
    <svg
      viewBox="0 0 120 100"
      className="text-sobre-panel h-36 w-48"
      fill="none"
      stroke="currentColor"
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
