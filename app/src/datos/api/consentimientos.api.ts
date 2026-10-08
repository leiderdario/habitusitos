/**
 * Consentimientos. Tabla `consentimientos` (insert-only, ver
 * supabase/migrations/0004_fase8_roles_consentimientos.sql): cada aceptacion o retiro
 * es una fila nueva con la version del texto, nunca se edita ni se borra.
 */

import { supabase } from "../supabase/cliente";
import { consentimientosVigentes, VERSION_CONSENTIMIENTOS } from "@/dominio/consentimientos";
import type { FilaConsentimiento, TipoConsentimiento } from "@/dominio/consentimientos";
import { ErrorApp } from "@/dominio/tipos";

export async function leerConsentimientosVigentes(usuarioId: string) {
  const { data, error } = await supabase
    .from("consentimientos")
    .select("tipo, version, aceptado, creado_en")
    .eq("usuario_id", usuarioId);
  if (error) throw new ErrorApp("fallo-base-datos", error.message);
  return consentimientosVigentes((data ?? []) as FilaConsentimiento[]);
}

export async function registrarConsentimiento(
  usuarioId: string,
  tipo: TipoConsentimiento,
  aceptado: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("consentimientos")
    .insert({ usuario_id: usuarioId, tipo, version: VERSION_CONSENTIMIENTOS, aceptado });
  if (error) throw new ErrorApp("fallo-base-datos", error.message);
}
