/**
 * Preferencias de interfaz.
 *
 * Solo estado de presentacion: tema, barra lateral, avisos ya vistos. Los datos
 * de negocio NO viven aqui — se piden a `datos/api/*` en cada pantalla, igual
 * que se le pedirian a un servidor.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Dos estados, un boton sol/luna (decision del 2026-10-08). La primera visita
 *  arranca segun el sistema operativo; despues manda la eleccion del usuario. */
export type Tema = "claro" | "oscuro";

function temaDelSistema(): Tema {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

interface EstadoInterfaz {
  tema: Tema;
  barraLateralAbierta: boolean;
  /** El aviso de que la persistencia local fallo se muestra UNA vez, no cada
   *  vez que se guarda algo. Repetirlo seria el peor tipo de ruido. */
  avisoPersistenciaVisto: boolean;
  fijarTema(tema: Tema): void;
  alternarBarraLateral(): void;
  marcarAvisoPersistenciaVisto(): void;
}

export const useInterfaz = create<EstadoInterfaz>()(
  persist(
    (set, get) => ({
      tema: temaDelSistema(),
      barraLateralAbierta: true,
      avisoPersistenciaVisto: false,
      fijarTema: (tema) => {
        set({ tema });
        aplicarTema(tema);
      },
      alternarBarraLateral: () =>
        set({ barraLateralAbierta: !get().barraLateralAbierta }),
      marcarAvisoPersistenciaVisto: () => set({ avisoPersistenciaVisto: true }),
    }),
    // Nombre anterior a proposito: cambiar la clave borraria el tema guardado.
    {
      name: "habitusitos_interfaz_v1",
      version: 1,
      // v0 admitia "sistema": se resuelve una vez al tema que el sistema tenga hoy.
      migrate: (guardado, version) => {
        const estado = guardado as { tema?: string };
        if (version === 0 && estado.tema !== "claro" && estado.tema !== "oscuro") {
          estado.tema = temaDelSistema();
        }
        return estado as EstadoInterfaz;
      },
    },
  ),
);

/** Escribe la clase `dark` en el elemento raiz. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle("dark", tema === "oscuro");
}
