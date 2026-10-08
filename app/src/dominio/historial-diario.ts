/**
 * Del agregado diario guardado en la base al `DiaHistorial` que consumen las
 * pantallas y el export.
 *
 * Aporte propio de Espinker (Fase 5). Puro y sin imports externos, como todo
 * `dominio/`; por eso la ventana de dias llega por parametro y no desde config.
 */

import type { DiaHistorial } from "./tipos";

/** Fila de `historial_diario` (espeja las columnas reales de Postgres). */
export interface FilaDia {
  fecha: string;
  segundos_monitoreados: number;
  puntaje_ponderado: number;
  segundos_mala_postura: number;
}

export function restarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
}

/** Ventana continua de `cantidad` dias terminando en `hoy`. Los dias sin uso llevan
 *  `promedio: null`, que es lo que el calendario espera para dibujar el hueco. Un
 *  festivo se marca sin borrar el uso real si lo hubo. */
export function construirDias(
  filas: readonly FilaDia[],
  hoy: string,
  festivos: readonly { fecha: string; nombre: string }[],
  cantidad: number,
): DiaHistorial[] {
  const porFecha = new Map(filas.map((f) => [f.fecha, f]));
  const nombreFestivo = new Map(festivos.map((f) => [f.fecha, f.nombre]));
  const dias: DiaHistorial[] = [];
  for (let atras = cantidad - 1; atras >= 0; atras--) {
    const fecha = restarDias(hoy, atras);
    const fila = porFecha.get(fecha);
    const festivo = nombreFestivo.get(fecha);
    const base = festivo ? { esFestivo: true, nombreFestivo: festivo } : { esFestivo: false };
    const seg = fila ? Number(fila.segundos_monitoreados) : 0;
    if (!fila || seg <= 0) {
      dias.push({ fecha, promedio: null, minutosActivos: 0, porcentajeMalaPostura: null, ...base });
      continue;
    }
    dias.push({
      fecha,
      promedio: Math.round((Number(fila.puntaje_ponderado) / seg) * 10) / 10,
      minutosActivos: Math.round(seg / 60),
      porcentajeMalaPostura: Math.round((Number(fila.segundos_mala_postura) / seg) * 1000) / 10,
      ...base,
    });
  }
  return dias;
}

/** Filas de la hoja "Por persona": solo dias con uso o festivos, sin relleno. */
export function filasExportacion(dias: readonly DiaHistorial[]) {
  return dias
    .filter((d) => d.promedio !== null || d.esFestivo)
    .map((d) => ({
      fecha: d.fecha,
      minutos_monitoreados: d.minutosActivos,
      puntaje_promedio: d.promedio,
      porcentaje_mala_postura: d.porcentajeMalaPostura,
      es_festivo: d.esFestivo ? "si" : "no",
    }));
}
