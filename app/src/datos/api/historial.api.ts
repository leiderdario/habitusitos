/**
 * Historial y analitica ampliada — aporte 3 de tesis (seccion 11.3).
 *
 * Backend real desde la Fase 5: tabla `historial_diario` en Supabase (un agregado
 * por usuario y dia, ver supabase/migrations/0003_fase5_historial.sql). Igual que
 * `auth.api.ts`, no pasa por `resolver()`: ya no hay nada que simular.
 *
 * Las funciones publicas conservan el contrato de antes (`obtenerHistorial`,
 * `obtenerDiaSemana`, `obtenerTendencia`), por eso las pantallas casi no cambiaron.
 *
 * Solo se acumula tiempo con una persona real frente a la camara; el modo simulado
 * nunca escribe aqui, o el historial mezclaria datos inventados con medidos.
 */

import { config } from "@/config/app.config";
import { promedioPorDiaSemana, tendenciaPorSemana } from "@/dominio/estadisticas";
import { construirDias, filasExportacion, restarDias } from "@/dominio/historial-diario";
import type { FilaDia } from "@/dominio/historial-diario";
import { ErrorApp } from "@/dominio/tipos";
import type { ComparacionDiaSemana, DiaHistorial } from "@/dominio/tipos";
import { supabase } from "../supabase/cliente";
import { obtenerFestivos } from "../fixtures/festivos";
import { registrarEvento } from "./registro.api";

export interface RespuestaHistorial {
  dias: DiaHistorial[];
  /** Si los festivos vinieron de la red o del respaldo local. Se muestra al
   *  usuario: presentar datos de respaldo como si fueran actuales seria mentir. */
  festivosDesdeRed: boolean;
}

// ---------------------------------------------------------------------------
// Escritura: acumulacion en memoria y envio por lotes
// ---------------------------------------------------------------------------

/** Un lote por minuto: una escritura por muestra (5 por segundo) saturaria la base. */
const SEGUNDOS_POR_LOTE = 60;
/** Un dt mayor es una pausa de la pestana, no tiempo frente a la camara. */
const DT_MAXIMO = 2;

const pendiente = { segundos: 0, ponderado: 0, mala: 0 };

export function acumularMuestraHistorial(dt: number, puntaje: number): void {
  if (!(dt > 0) || dt > DT_MAXIMO) return;
  pendiente.segundos += dt;
  pendiente.ponderado += puntaje * dt;
  if (puntaje < config.UMBRAL_MALA_POSTURA) pendiente.mala += dt;
  if (pendiente.segundos >= SEGUNDOS_POR_LOTE) void vaciarHistorialPendiente();
}

/** Envia lo acumulado. Nunca lanza: un fallo de red no debe tumbar la camara; el
 *  lote se devuelve al acumulador para el siguiente intento. */
export async function vaciarHistorialPendiente(): Promise<void> {
  if (pendiente.segundos <= 0) return;
  const lote = { ...pendiente };
  pendiente.segundos = 0;
  pendiente.ponderado = 0;
  pendiente.mala = 0;

  const { error } = await supabase.rpc("acumular_historial_diario", {
    p_segundos: lote.segundos,
    p_puntaje_ponderado: lote.ponderado,
    p_segundos_mala: lote.mala,
  });
  if (error) {
    console.error("No se pudo guardar el historial:", error.message);
    // El tope del servidor es 3600 s: pasado eso, reintentar solo seguiria fallando.
    if (pendiente.segundos + lote.segundos <= 3600) {
      pendiente.segundos += lote.segundos;
      pendiente.ponderado += lote.ponderado;
      pendiente.mala += lote.mala;
    }
  }
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function fechaHoy(): string {
  // `en-CA` formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.ZONA_HORARIA }).format(Date.now());
}

export async function obtenerHistorial(): Promise<RespuestaHistorial> {
  const hoy = fechaHoy();
  const desde = restarDias(hoy, config.DIAS_HISTORIAL - 1);
  const anio = Number(hoy.slice(0, 4));

  // Los festivos son una llamada de red real y nunca lanzan: caen al respaldo local.
  const [{ data, error }, { festivos, desdeRed }] = await Promise.all([
    supabase
      .from("historial_diario")
      .select("fecha, segundos_monitoreados, puntaje_ponderado, segundos_mala_postura")
      .gte("fecha", desde)
      .order("fecha"),
    obtenerFestivos(anio, config.PAIS_FESTIVOS),
  ]);
  if (error) throw new ErrorApp("fallo-base-datos", error.message);

  return {
    dias: construirDias((data ?? []) as FilaDia[], hoy, festivos, config.DIAS_HISTORIAL),
    festivosDesdeRed: desdeRed,
  };
}

export async function obtenerDiaSemana(): Promise<ComparacionDiaSemana[]> {
  const { dias } = await obtenerHistorial();
  return promedioPorDiaSemana(dias);
}

export async function obtenerTendencia() {
  const { dias } = await obtenerHistorial();
  return tendenciaPorSemana(dias);
}

// ---------------------------------------------------------------------------
// Exportacion
// ---------------------------------------------------------------------------

/**
 * Columnas de la hoja "Por persona". El orden y los nombres NO se cambian entre
 * versiones: un auditor de SST compara archivos de un ano a otro, y renombrar una
 * columna rompe esa comparacion en silencio. Si hace falta una nueva, va al final.
 */
export const COLUMNAS_EXPORTACION = [
  { clave: "fecha", titulo: "fecha" },
  { clave: "minutos_monitoreados", titulo: "minutos_monitoreados" },
  { clave: "puntaje_promedio", titulo: "puntaje_promedio" },
  { clave: "porcentaje_mala_postura", titulo: "porcentaje_mala_postura" },
  { clave: "es_festivo", titulo: "es_festivo" },
] as const;

/**
 * Genera el .xlsx. ExcelJS se importa al exportar (pesa cientos de KB y casi nadie
 * exporta en cada visita). Las celdas se escriben como valores, nunca como formulas,
 * asi que un texto que empiece por `=` no se ejecuta al abrir el archivo.
 *
 * Hoja unica por ahora. Las hojas "por sala" y "pausas" del export SST esperan a que
 * existan sus fuentes de datos (agregado persistido de `vision-node/` y Fase 7); no se
 * crean hojas vacias que parezcan datos.
 */
export async function exportarHistorialExcel(): Promise<{ nombre: string; blob: Blob }> {
  const { dias } = await obtenerHistorial();
  const { Workbook } = await import("exceljs");

  const libro = new Workbook();
  const hoja = libro.addWorksheet("Por persona");
  hoja.columns = COLUMNAS_EXPORTACION.map((c) => ({
    header: c.titulo,
    key: c.clave,
    width: 24,
  }));
  hoja.addRows(filasExportacion(dias));
  hoja.getRow(1).font = { bold: true };

  const buffer = await libro.xlsx.writeBuffer();
  const hoy = fechaHoy();
  const { data: sesion } = await supabase.auth.getSession();
  const usuarioId = sesion.session?.user.id ?? null;
  void registrarEvento({ usuario_id: usuarioId, tipo: "exportacion" });

  return {
    nombre: `espinker_historial_${hoy}.xlsx`,
    blob: new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  };
}
