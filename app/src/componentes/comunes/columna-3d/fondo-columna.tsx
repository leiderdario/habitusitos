/**
 * Fondo interactivo del login: la columna 3D y su tooltip.
 *
 * Aporte propio de Espinker (docs/PLAN_REDISENO_ESPINKER.md, Fase 3). Este
 * archivo NO importa three: decide si la escena se carga y, solo entonces, la
 * pide con React.lazy. No se carga si:
 * - la pantalla mide menos de 1024 px (en movil el panel se oculta y el modelo
 *   ni siquiera se descarga), o
 * - el navegador no tiene WebGL, o la carga falla: queda el panel liso, porque
 *   nada del acceso depende de la columna.
 *
 * Es decorativo para tecnologias de asistencia (aria-hidden). Con
 * prefers-reduced-motion la columna se queda quieta, pero el resaltado al pasar
 * el mouse sigue: es respuesta directa a la persona, no decoracion.
 */

import { Component, lazy, type ReactNode, Suspense, useState, useSyncExternalStore } from "react";
import type { VertebraBajoPuntero } from "./use-interaccion-columna";
import { nombreVertebra } from "./vertebras";

const EscenaColumna = lazy(() => import("./escena"));

function useCoincideMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const media = window.matchMedia(consulta);
      media.addEventListener("change", avisar);
      return () => media.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
  );
}

function hayWebGL(): boolean {
  const lienzo = document.createElement("canvas");
  return Boolean(lienzo.getContext("webgl2") ?? lienzo.getContext("webgl"));
}

class SinEscenaSiFalla extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? null : this.props.children;
  }
}

export function FondoColumna() {
  const escritorio = useCoincideMedia("(min-width: 1024px)");
  const movimientoReducido = useCoincideMedia("(prefers-reduced-motion: reduce)");
  const [webgl] = useState(hayWebGL);
  const [vertebra, setVertebra] = useState<VertebraBajoPuntero | null>(null);

  if (!escritorio || !webgl) return null;

  return (
    <div className="absolute inset-0" aria-hidden>
      <SinEscenaSiFalla>
        <Suspense fallback={null}>
          <EscenaColumna movimientoReducido={movimientoReducido} onVertebra={setVertebra} />
        </Suspense>
      </SinEscenaSiFalla>
      {vertebra && (
        <div
          className="bg-card text-card-foreground border-madera pointer-events-none absolute z-10 rounded-lg border-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-md"
          style={{ left: vertebra.x + 16, top: vertebra.y + 16 }}
        >
          {nombreVertebra(vertebra.codigo)}
        </div>
      )}
    </div>
  );
}
