/**
 * Antecedentes de salud.
 *
 * Igual que `auth.api.ts`: backend real desde el dia uno, no pasa por
 * `resolver()` de `datos/cliente.ts`. Tabla `antecedentes_salud` (una fila por
 * usuario, se actualiza con upsert) + `antecedentes_cambios` (insert-only,
 * historico de que cambio y cuando -- ver supabase/migrations/0002_fase2_antecedentes.sql).
 *
 * NO diagnostica. Solo contextualiza alertas (ver pantalla, que lo declara en
 * texto) y, mas adelante, evita que la Fase 7 sugiera una pausa contraindicada.
 */

import { supabase } from "../supabase/cliente";
import { ANTECEDENTES_VACIOS, ErrorApp } from "@/dominio/tipos";
import { leerConsentimientosVigentes } from "./consentimientos.api";
import type { AntecedentesSalud, CambioAntecedente } from "@/dominio/tipos";

type CamposEditables = Omit<AntecedentesSalud, "usuario_id" | "actualizado_en">;

export async function leerAntecedentes(usuarioId: string): Promise<AntecedentesSalud> {
  const { data, error } = await supabase
    .from("antecedentes_salud")
    .select("*")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error) throw new ErrorApp("fallo-base-datos", error.message);
  if (!data) {
    return { usuario_id: usuarioId, actualizado_en: null, ...ANTECEDENTES_VACIOS };
  }
  return data as AntecedentesSalud;
}

/**
 * Fusiona `parcial` sobre el valor actual (upsert) y anota en
 * `antecedentes_cambios` cada campo que de verdad cambio de valor -- nunca
 * sobreescribe en silencio, que es justo lo que el feedback original pedia
 * ("editable despues, con rastro de cambios").
 */
export async function guardarAntecedentes(
  usuarioId: string,
  parcial: Partial<CamposEditables>,
): Promise<AntecedentesSalud> {
  // Datos de salud: sin consentimiento vigente no se guarda nada (Fase 8).
  const consentimientos = await leerConsentimientosVigentes(usuarioId);
  if (!consentimientos.salud) {
    throw new ErrorApp(
      "consentimiento-requerido",
      "No hay consentimiento vigente para guardar datos de salud.",
    );
  }

  const actual = await leerAntecedentes(usuarioId);

  const cambios: Omit<CambioAntecedente, "id" | "cambiado_en">[] = [];
  for (const campo of Object.keys(parcial) as (keyof CamposEditables)[]) {
    const valorNuevo = parcial[campo];
    if (valorNuevo === undefined) continue;
    const valorAnterior = actual[campo];
    if (valorNuevo === valorAnterior) continue;
    cambios.push({
      usuario_id: usuarioId,
      campo,
      valor_anterior: valorAnterior === null ? null : String(valorAnterior),
      valor_nuevo: String(valorNuevo),
    });
  }

  const { data, error } = await supabase
    .from("antecedentes_salud")
    .upsert({ ...actual, ...parcial, usuario_id: usuarioId })
    .select("*")
    .single();
  if (error) throw new ErrorApp("fallo-base-datos", error.message);

  if (cambios.length > 0) {
    const { error: errorLog } = await supabase.from("antecedentes_cambios").insert(cambios);
    if (errorLog) {
      console.error("No se pudo registrar el cambio de antecedentes:", errorLog.message);
    }
  }

  return data as AntecedentesSalud;
}
