/**
 * Sesion de cuenta.
 *
 * Envuelve el estado de autenticacion en un store de Zustand, igual que
 * `estado/interfaz.ts` envuelve preferencias de UI. No duplica logica de
 * negocio: solo refleja el perfil actual y delega cada accion a
 * `datos/api/auth.api.ts`, que es quien de verdad habla con Supabase.
 */

import { create } from "zustand";
import * as auth from "@/datos/api/auth.api";
import type { CredencialesCorreo, DatosRegistro } from "@/datos/api/auth.api";
import type { Usuario } from "@/dominio/tipos";
import { useSimulacion } from "@/estado/simulacion";
import { supabase } from "@/datos/supabase/cliente";

interface EstadoSesionUsuario {
  usuario: Usuario | null;
  /** true mientras no se ha resuelto si hay sesion o no (arranque de la app). */
  cargando: boolean;
  error: unknown;
  inicializar(): Promise<void>;
  registrarse(datos: DatosRegistro): Promise<void>;
  iniciarSesionConCorreo(credenciales: CredencialesCorreo): Promise<void>;
  iniciarSesionConCodigoOrganizacion(codigo: string): Promise<void>;
  cerrarSesion(): Promise<void>;
}

export const useSesionUsuario = create<EstadoSesionUsuario>()((set) => {
  // Si Supabase cierra la sesion por su cuenta (token expirado, etc.), refleja
  // el estado aqui -- no en cada pantalla por separado.
  supabase.auth.onAuthStateChange((_evento, sesion) => {
    if (!sesion) set({ usuario: null });
  });

  return {
    usuario: null,
    cargando: true,
    error: null,

    async inicializar() {
      set({ cargando: true, error: null });
      try {
        const usuario = await auth.sesionActual();
        set({ usuario, cargando: false });
      } catch (error) {
        set({ error, cargando: false });
      }
    },

    async registrarse(datos) {
      set({ cargando: true, error: null });
      try {
        const usuario = await auth.registrarse(datos);
        set({ usuario, cargando: false });
      } catch (error) {
        set({ error, cargando: false });
        throw error;
      }
    },

    async iniciarSesionConCorreo(credenciales) {
      set({ cargando: true, error: null });
      try {
        const usuario = await auth.iniciarSesionConCorreo(credenciales);
        set({ usuario, cargando: false });
      } catch (error) {
        set({ error, cargando: false });
        throw error;
      }
    },

    async iniciarSesionConCodigoOrganizacion(codigo) {
      set({ cargando: true, error: null });
      try {
        const usuario = await auth.iniciarSesionConCodigoOrganizacion(codigo);
        set({ usuario, cargando: false });
      } catch (error) {
        set({ error, cargando: false });
        throw error;
      }
    },

    async cerrarSesion() {
      await auth.cerrarSesion();
      // Sin esto, la cuenta siguiente en la misma pestana heredaria la sesion
      // simulada de la anterior: `cargar()` no hace nada si `listo` ya es true.
      useSimulacion.getState().detener();
      useSimulacion.setState({ listo: false });
      set({ usuario: null });
    },
  };
});
