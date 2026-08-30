/**
 * Preferencias de interfaz.
 *
 * Solo estado de presentacion: tema, barra lateral, avisos ya vistos. Los datos
 * de negocio NO viven aqui — se piden a `datos/api/*` en cada pantalla, igual
 * que se le pedirian a un servidor.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tema = "sistema" | "claro" | "oscuro";

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
      tema: "sistema",
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
    { name: "habitusitos_interfaz_v1" },
  ),
);

/**
 * Escribe la clase `dark` en el elemento raiz.
 *
 * Con `sistema` se sigue la preferencia del sistema operativo, que es lo que
 * pide la seccion 9.1: adaptarse al modo claro/oscuro de Windows.
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  const oscuroDelSistema = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const oscuro = tema === "oscuro" || (tema === "sistema" && oscuroDelSistema);
  raiz.classList.toggle("dark", oscuro);
}

/** Reacciona a los cambios de tema del sistema mientras la app esta abierta. */
export function escucharTemaDelSistema(): () => void {
  const consulta = window.matchMedia("(prefers-color-scheme: dark)");
  const alCambiar = () => {
    if (useInterfaz.getState().tema === "sistema") aplicarTema("sistema");
  };
  consulta.addEventListener("change", alCambiar);
  return () => consulta.removeEventListener("change", alCambiar);
}
