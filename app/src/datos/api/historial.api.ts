/**
 * Historial y analitica ampliada — aporte 3 de tesis (seccion 11.3).
 *
 * Rutas equivalentes en el producto real (consultas a SQLite, no HTTP):
 *   obtenerHistorial()    -> SELECT date(timestamp), avg(score) FROM posture_scores GROUP BY 1
 *   obtenerDiaSemana()    -> agregacion sobre lo anterior
 *   obtenerTendencia()    -> agregacion semanal sobre lo anterior
 *   exportarCsv()         -> Database.export_scores_csv()
 */

import { config } from "@/config/app.config";
import {
  promedioPorDiaSemana,
  tendenciaPorSemana,
} from "@/dominio/estadisticas";
import type { ComparacionDiaSemana, DiaHistorial } from "@/dominio/tipos";
import { resolver } from "../cliente";
import { HISTORIAL_BASE, aplicarFestivos, promedioDeAyer } from "../fixtures/historial";
import { obtenerFestivos } from "../fixtures/festivos";

export interface RespuestaHistorial {
  dias: DiaHistorial[];
  /** Si los festivos vinieron de la red o del respaldo local. Se muestra al
   *  usuario: presentar datos de respaldo como si fueran actuales seria mentir. */
  festivosDesdeRed: boolean;
  promedioAyer: number | null;
}

let cache: RespuestaHistorial | null = null;

export async function obtenerHistorial(): Promise<RespuestaHistorial> {
  if (cache) return cache;

  // La consulta de festivos va FUERA de `resolver` porque es una llamada de red
  // real, no simulada. Nunca lanza: cae al respaldo local.
  const anio = new Date(config.ANCLA_UTC).getUTCFullYear();
  const { festivos, desdeRed } = await obtenerFestivos(anio, config.PAIS_FESTIVOS);

  return resolver("SELECT date(timestamp), avg(score) FROM posture_scores", () => {
    const dias = aplicarFestivos(HISTORIAL_BASE, festivos);
    cache = { dias, festivosDesdeRed: desdeRed, promedioAyer: promedioDeAyer(dias) };
    return cache;
  });
}

export async function obtenerDiaSemana(): Promise<ComparacionDiaSemana[]> {
  const { dias } = await obtenerHistorial();
  return promedioPorDiaSemana(dias);
}

export async function obtenerTendencia() {
  const { dias } = await obtenerHistorial();
  return tendenciaPorSemana(dias);
}

/**
 * Genera el CSV de exportacion.
 *
 * SEGURIDAD: se neutraliza la inyeccion de formulas. Un valor que empiece por
 * `=`, `+`, `-` o `@` lo ejecuta Excel al abrir el archivo. Aqui los campos son
 * numeros y fechas, pero la funcion es la que el producto real reutilizara con
 * datos de texto, y esa proteccion tiene que estar desde el principio.
 */
export function generarCsvHistorial(dias: readonly DiaHistorial[]): string {
  const escapar = (valor: string | number | null): string => {
    if (valor === null) return "";
    const texto = String(valor);
    const peligroso = /^[=+\-@\t\r]/.test(texto);
    const necesitaComillas = peligroso || /[",\n]/.test(texto);
    const contenido = peligroso ? `'${texto}` : texto;
    return necesitaComillas ? `"${contenido.replace(/"/g, '""')}"` : contenido;
  };

  const cabecera = ["fecha", "promedio_score", "minutos_activos", "es_festivo"];
  const filas = dias.map((d) =>
    [
      escapar(d.fecha),
      escapar(d.promedio === null ? null : d.promedio.toFixed(2)),
      escapar(d.minutosActivos),
      escapar(d.esFestivo ? "si" : "no"),
    ].join(","),
  );

  return [cabecera.join(","), ...filas].join("\r\n");
}

export async function exportarHistorialCsv(): Promise<{ nombre: string; csv: string }> {
  const { dias } = await obtenerHistorial();
  return resolver(
    "Database.export_scores_csv()",
    () => ({
      nombre: `habitusitos_export_${new Date(config.ANCLA_UTC)
        .toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, "")
        .replace("T", "_")}.csv`,
      csv: generarCsvHistorial(dias),
    }),
    { factorLatencia: 1.8 },
  );
}
