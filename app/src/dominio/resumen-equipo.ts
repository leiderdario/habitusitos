/**
 * Resumen de equipo para la vista RRHH.
 *
 * REGLA QUE NO SE PUEDE ROMPER (misma filosofia que agregacion-oficina.ts): una fila
 * del resumen nunca lleva un campo que identifique a una persona. La lista cerrada y
 * su test existen para que agregar un campo exija una revision explicita, no un
 * descuido. El minimo de fuentes por dia lo impone la base de datos, no esta capa.
 */

export interface ResumenEquipoDia {
  fecha: string;
  /** Cuentas con uso ese dia. En oficina una cuenta compartida es un equipo. */
  fuentes_activas: number;
  minutos_monitoreados: number;
  puntaje_promedio: number | null;
  porcentaje_mala_postura: number | null;
}

export const CAMPOS_RESUMEN_EQUIPO = [
  "fecha",
  "fuentes_activas",
  "minutos_monitoreados",
  "puntaje_promedio",
  "porcentaje_mala_postura",
] as const;

/** Convierte lo que devuelve Postgres (numeric llega como texto) a numeros, y solo
 *  conserva los campos de la lista cerrada: cualquier extra se descarta aqui. */
export function normalizarResumenEquipo(filas: readonly Record<string, unknown>[]): ResumenEquipoDia[] {
  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return filas.map((f) => ({
    fecha: String(f.fecha),
    fuentes_activas: Number(f.fuentes_activas),
    minutos_monitoreados: Number(f.minutos_monitoreados),
    puntaje_promedio: num(f.puntaje_promedio),
    porcentaje_mala_postura: num(f.porcentaje_mala_postura),
  }));
}

/** Promedios del periodo ponderados por tiempo, no media de medias. */
export function totalesEquipo(dias: readonly ResumenEquipoDia[]) {
  const minutos = dias.reduce((a, d) => a + d.minutos_monitoreados, 0);
  const ponderar = (campo: "puntaje_promedio" | "porcentaje_mala_postura") =>
    minutos > 0
      ? dias.reduce((a, d) => a + (d[campo] ?? 0) * d.minutos_monitoreados, 0) / minutos
      : null;
  return {
    diasConDatos: dias.length,
    minutos,
    puntajePromedio: ponderar("puntaje_promedio"),
    porcentajeMalaPostura: ponderar("porcentaje_mala_postura"),
  };
}
