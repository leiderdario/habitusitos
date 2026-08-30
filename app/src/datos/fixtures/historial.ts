/**
 * Historial simulado de 98 dias.
 *
 * No es ruido: tiene una historia que el presentador puede contar.
 *
 *  - Las primeras semanas son peores. La persona acaba de instalar la app.
 *  - Hay una mejora progresiva, con recaidas. Nadie mejora en linea recta, y un
 *    historial que sube monotonicamente se ve fabricado a un kilometro.
 *  - Los viernes caen. Es el patron que la vista de "dia de la semana" existe
 *    para revelar (seccion 11.3 del prompt maestro).
 *  - Las tardes son peores que las mananas: fatiga acumulada.
 *  - Los fines de semana casi no hay uso, y los festivos ninguno.
 *
 * Todo sale del generador con semilla fija: dos demostraciones consecutivas
 * producen exactamente el mismo historial.
 */

import { config } from "@/config/app.config";
import type { DiaHistorial } from "@/dominio/tipos";
import { crearAleatorio, diaHace, gaussiano } from "../semilla";

const rnd = crearAleatorio(config.SEMILLA + 10);

/** Cuanto peor puntua cada dia de la semana. Lunes = 0 ... Domingo = 6. */
const SESGO_DIA_SEMANA = [1.5, 2.0, 0.5, -1.0, -4.5, 1.0, 2.5];

/** Dias sueltos con una caida marcada, para que la tendencia no sea plana. */
const RECAIDAS = new Set([12, 13, 31, 46, 47, 48, 70]);

function construirHistorial(): DiaHistorial[] {
  const dias: DiaHistorial[] = [];

  for (let atras = config.DIAS_HISTORIAL - 1; atras >= 0; atras--) {
    const fecha = diaHace(atras);
    const diaSemana = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7;
    const esFinDeSemana = diaSemana >= 5;

    // Progreso: de ~62 al principio a ~79 al final, con la curva aplanandose.
    const avance = 1 - atras / config.DIAS_HISTORIAL;
    const base = 62 + 17 * Math.sqrt(avance);

    // Probabilidad de uso. Los primeros dias hay entusiasmo, luego se asienta.
    const probUso = esFinDeSemana ? 0.22 : 0.88 - (atras > 80 ? 0 : 0.05);

    if (rnd() > probUso) {
      dias.push({ fecha, promedio: null, minutosActivos: 0, esFestivo: false });
      continue;
    }

    const recaida = RECAIDAS.has(atras) ? -9 : 0;
    const promedio = Math.max(
      28,
      Math.min(97, base + SESGO_DIA_SEMANA[diaSemana] + recaida + gaussiano(0, 3.4, rnd)),
    );

    const minutos = esFinDeSemana
      ? Math.round(40 + rnd() * 90)
      : Math.round(210 + rnd() * 220);

    dias.push({
      fecha,
      promedio: Math.round(promedio * 10) / 10,
      minutosActivos: minutos,
      esFestivo: false,
    });
  }

  return dias;
}

/** Historial base, sin festivos aplicados todavia. */
export const HISTORIAL_BASE: DiaHistorial[] = construirHistorial();

/**
 * Aplica los festivos: marca el dia y borra el uso.
 *
 * Se hace en un paso aparte porque los festivos llegan de la red (o del
 * respaldo local) y no se pueden conocer al construir el historial.
 */
export function aplicarFestivos(
  dias: readonly DiaHistorial[],
  festivos: readonly { fecha: string; nombre: string }[],
): DiaHistorial[] {
  const porFecha = new Map(festivos.map((f) => [f.fecha, f.nombre]));
  return dias.map((dia) => {
    const nombre = porFecha.get(dia.fecha);
    if (!nombre) return dia;
    return {
      ...dia,
      promedio: null,
      minutosActivos: 0,
      esFestivo: true,
      nombreFestivo: nombre,
    };
  });
}

/** Promedio del dia anterior al ancla, para la comparacion "mejor que ayer". */
export function promedioDeAyer(dias: readonly DiaHistorial[]): number | null {
  const ayer = diaHace(1);
  return dias.find((d) => d.fecha === ayer)?.promedio ?? null;
}
