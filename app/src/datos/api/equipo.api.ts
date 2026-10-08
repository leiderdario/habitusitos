/**
 * Vista de equipo para RRHH. Unica puerta: la funcion SQL `resumen_equipo`, que
 * valida el rol, suma por dia y omite los dias con menos de 5 fuentes. Ninguna
 * consulta directa a las tablas individuales funciona para ese rol (RLS), y eso se
 * prueba en supabase/pruebas/rls_fase8.sql.
 */

import { supabase } from "../supabase/cliente";
import { normalizarResumenEquipo } from "@/dominio/resumen-equipo";
import type { ResumenEquipoDia } from "@/dominio/resumen-equipo";
import { ErrorApp } from "@/dominio/tipos";

export async function obtenerResumenEquipo(dias = 28): Promise<ResumenEquipoDia[]> {
  const { data, error } = await supabase.rpc("resumen_equipo", { p_dias: dias });
  if (error) {
    if (error.message.includes("acceso-denegado")) {
      throw new ErrorApp("acceso-denegado", error.message);
    }
    throw new ErrorApp("fallo-base-datos", error.message);
  }
  return normalizarResumenEquipo((data ?? []) as Record<string, unknown>[]);
}
