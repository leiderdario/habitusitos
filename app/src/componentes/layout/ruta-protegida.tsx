/**
 * Guarda de ruta.
 *
 * Sin sesion, redirige a /ingresar. Mientras se resuelve si hay sesion o no
 * (arranque de la app), no redirige todavia -- redirigir antes de saber la
 * respuesta expulsaria a alguien que si tiene sesion valida, solo porque la
 * consulta a Supabase no habia vuelto aun.
 */

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { Cargando } from "@/componentes/comunes/avisos";

export function RutaProtegida({ children }: { children: ReactNode }) {
  const usuario = useSesionUsuario((s) => s.usuario);
  const cargando = useSesionUsuario((s) => s.cargando);
  const ubicacion = useLocation();

  if (cargando) return <Cargando texto="Verificando tu sesion..." />;
  if (!usuario) return <Navigate to="/ingresar" state={{ desde: ubicacion }} replace />;

  return <>{children}</>;
}
