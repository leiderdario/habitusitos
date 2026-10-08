/**
 * Guarda por rol. Es comodidad de interfaz, NO seguridad: aunque alguien la salte,
 * la base de datos rechaza la consulta (la funcion `resumen_equipo` valida el rol y
 * ninguna policy deja leer filas individuales). Ver supabase/pruebas/rls_fase8.sql.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router";
import type { RolUsuario } from "@/dominio/tipos";
import { useSesionUsuario } from "@/estado/sesion-usuario";

export function RutaRol({ rol, children }: { rol: RolUsuario; children: ReactNode }) {
  const usuario = useSesionUsuario((s) => s.usuario);
  if (usuario?.rol !== rol) return <Navigate to="/" replace />;
  return <>{children}</>;
}
