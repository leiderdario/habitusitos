/**
 * Registro de eventos de auditoria.
 *
 * Tabla `eventos_log` (ver supabase/migrations/0001_fase1_cuentas.sql):
 * inmutable, se escribe y nunca se edita ni se borra desde la aplicacion. Es
 * la respuesta a "quien inicio sesion, cuando, y que hizo" del feedback
 * original.
 */

import { supabase } from "../supabase/cliente";
import type { EventoRegistro } from "@/dominio/tipos";

export async function registrarEvento(
  evento: Omit<EventoRegistro, "creado_en" | "id">,
): Promise<void> {
  // Un fallo al registrar el evento nunca debe tumbar el flujo principal (ej.
  // que no se pueda iniciar sesion porque el log fallo). El caso mas dificil
  // ya esta cubierto: login_fallido ocurre ANTES de tener una sesion, por eso
  // la policy de insert en la migracion permite usuario_id nulo.
  const { error } = await supabase.from("eventos_log").insert(evento);
  if (error) {
    console.error("No se pudo registrar el evento de auditoria:", error.message);
  }
}
