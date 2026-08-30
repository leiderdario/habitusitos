/**
 * Estadisticas de sesion, rachas y deteccion de declive.
 *
 * PROCEDENCIA: traduccion de `batesposture/services/score_service.py` (prompt
 * maestro seccion 4.6). Codigo heredado, no aporte propio — salvo
 * `promedioPorDiaSemana` y `tendenciaPorSemana`, que son parte de la
 * contribucion 3 (analitica ampliada, seccion 11.3).
 *
 * `decliveReciente` ya existia en el proyecto original como
 * `ScoreService.recent_decline()`, pero no se usaba en ninguna pantalla. Aqui se
 * conserva la logica y se le da uso visible.
 *
 * Este archivo no importa NADA fuera del dominio.
 */

import type {
  ComparacionDiaSemana,
  DiaHistorial,
  EstadisticasSesion,
  MuestraPuntaje,
} from "./tipos";

const SIN_DATOS: EstadisticasSesion = {
  muestras: 0,
  promedio: 0,
  minimo: 0,
  maximo: 0,
  duracionActivaSegundos: 0,
  rachaActualSegundos: 0,
  mejorRachaSegundos: 0,
  proporcionBuenaPostura: 0,
};

/**
 * Resume una sesion.
 *
 * Las muestras no detectadas se excluyen de TODO: no cuentan para el promedio,
 * no suman a la duracion activa y no rompen la racha. Contarlas seria decirle al
 * usuario que su postura empeoro cuando lo unico que hizo fue levantarse.
 */
export function resumirSesion(
  muestras: readonly MuestraPuntaje[],
  umbralBuena: number,
): EstadisticasSesion {
  const activas = muestras.filter((m) => m.detectado);
  if (activas.length === 0) return SIN_DATOS;

  let suma = 0;
  let minimo = Infinity;
  let maximo = -Infinity;
  for (const m of activas) {
    suma += m.score;
    if (m.score < minimo) minimo = m.score;
    if (m.score > maximo) maximo = m.score;
  }

  let duracionActiva = 0;
  let rachaActual = 0;
  let mejorRacha = 0;
  let segundosBuenos = 0;

  for (let i = 1; i < muestras.length; i++) {
    const previa = muestras[i - 1];
    const actual = muestras[i];
    const dt = actual.t - previa.t;
    // Un salto grande entre muestras significa que la app estuvo detenida o el
    // equipo suspendido. No se le atribuye tiempo a la sesion.
    if (dt <= 0 || dt > 5) continue;
    if (!actual.detectado) continue;

    duracionActiva += dt;
    if (actual.score >= umbralBuena) {
      rachaActual += dt;
      segundosBuenos += dt;
      if (rachaActual > mejorRacha) mejorRacha = rachaActual;
    } else {
      rachaActual = 0;
    }
  }

  return {
    muestras: activas.length,
    promedio: suma / activas.length,
    minimo,
    maximo,
    duracionActivaSegundos: duracionActiva,
    rachaActualSegundos: rachaActual,
    mejorRachaSegundos: mejorRacha,
    proporcionBuenaPostura:
      duracionActiva > 0 ? segundosBuenos / duracionActiva : 0,
  };
}

/** Promedio movil sobre una ventana de N muestras. Suaviza el sparkline. */
export function promedioMovil(
  valores: readonly number[],
  ventana: number,
): number[] {
  if (ventana <= 1) return [...valores];
  const salida: number[] = [];
  let acumulado = 0;
  for (let i = 0; i < valores.length; i++) {
    acumulado += valores[i];
    if (i >= ventana) acumulado -= valores[i - ventana];
    salida.push(acumulado / Math.min(i + 1, ventana));
  }
  return salida;
}

/**
 * Cuantos puntos ha caido la postura entre una ventana base y una reciente.
 *
 * Heredado de `ScoreService.recent_decline()`. Positivo = empeoro. Devuelve null
 * cuando no hay muestras suficientes en alguna de las dos ventanas: es honesto
 * decir "todavia no se" en vez de devolver 0 y que la interfaz lo lea como
 * "todo estable".
 */
export function decliveReciente(
  muestras: readonly MuestraPuntaje[],
  segundosVentana: number,
): number | null {
  const activas = muestras.filter((m) => m.detectado);
  if (activas.length < 6) return null;

  const fin = activas[activas.length - 1].t;
  const corte = fin - segundosVentana;

  const recientes = activas.filter((m) => m.t >= corte);
  const base = activas.filter((m) => m.t < corte);
  if (recientes.length < 3 || base.length < 3) return null;

  const media = (xs: readonly MuestraPuntaje[]) =>
    xs.reduce((a, m) => a + m.score, 0) / xs.length;

  return media(base) - media(recientes);
}

const ETIQUETAS_DIA = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

/**
 * Promedio por dia de la semana (aporte 3, seccion 11.3).
 *
 * Responde a la pregunta "los viernes mi postura empeora mas?", que es
 * accionable, a diferencia de un promedio global que no le dice nada a nadie.
 */
export function promedioPorDiaSemana(
  dias: readonly DiaHistorial[],
): ComparacionDiaSemana[] {
  const acumulado = ETIQUETAS_DIA.map(() => ({ suma: 0, minutos: 0, n: 0 }));

  for (const dia of dias) {
    if (dia.promedio === null) continue;
    // `fecha` es YYYY-MM-DD ya en zona de presentacion. Se parsea como UTC a
    // proposito para que el indice del dia no se corra por la zona horaria.
    const indice = (new Date(`${dia.fecha}T12:00:00Z`).getUTCDay() + 6) % 7;
    acumulado[indice].suma += dia.promedio;
    acumulado[indice].minutos += dia.minutosActivos;
    acumulado[indice].n += 1;
  }

  return acumulado.map((a, i) => ({
    dia: i + 1,
    etiqueta: ETIQUETAS_DIA[i],
    promedio: a.n > 0 ? a.suma / a.n : 0,
    minutosPromedio: a.n > 0 ? a.minutos / a.n : 0,
  }));
}

/** Agrupa el historial en semanas para la grafica de tendencia. */
export function tendenciaPorSemana(
  dias: readonly DiaHistorial[],
): { semana: string; promedio: number; minutos: number }[] {
  const grupos = new Map<string, { suma: number; minutos: number; n: number }>();

  for (const dia of dias) {
    if (dia.promedio === null) continue;
    const d = new Date(`${dia.fecha}T12:00:00Z`);
    // Lunes de esa semana, como clave estable.
    const desplazamiento = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - desplazamiento);
    const clave = d.toISOString().slice(0, 10);

    const g = grupos.get(clave) ?? { suma: 0, minutos: 0, n: 0 };
    g.suma += dia.promedio;
    g.minutos += dia.minutosActivos;
    g.n += 1;
    grupos.set(clave, g);
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, g]) => ({
      semana,
      promedio: g.suma / g.n,
      minutos: g.minutos,
    }));
}

/**
 * Traduce las estadisticas a una frase en espanol natural.
 *
 * La investigacion de tendencias 2026 en apps de bienestar es explicita: las
 * apps modernas "convierten los datos en guia clara en vez de actuar como
 * tableros de datos". Por eso el panel abre con una frase y las graficas van
 * debajo, no al reves.
 */
export function resumirEnPalabras(
  stats: EstadisticasSesion,
  diferenciaConAyer: number | null,
): string {
  if (stats.muestras === 0) {
    return "Todavia no hay datos de hoy. En cuanto te sientes frente a la camara empiezo a medir.";
  }

  const horas = Math.floor(stats.duracionActivaSegundos / 3600);
  const minutos = Math.round((stats.duracionActivaSegundos % 3600) / 60);
  const tiempo = horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
  const buenos = Math.round(stats.proporcionBuenaPostura * 100);

  const base = `Llevas ${tiempo} de sesion y mantuviste buena postura el ${buenos}% del tiempo.`;

  if (diferenciaConAyer === null) return base;
  if (Math.abs(diferenciaConAyer) < 2) return `${base} Vas parecido a ayer.`;
  return diferenciaConAyer > 0
    ? `${base} Vas ${Math.round(diferenciaConAyer)} puntos mejor que ayer.`
    : `${base} Hoy vas ${Math.abs(Math.round(diferenciaConAyer))} puntos por debajo de ayer.`;
}
