/**
 * Sesion de hoy y evolucion del baseline — datos de arranque.
 *
 * Cuando se abre el panel, la sesion ya lleva un rato corriendo: el motor en
 * vivo (estado/simulacion.ts) va anadiendo muestras encima de estas. Sin esto,
 * la demostracion empezaria con las graficas vacias y habria que esperar minutos
 * para que se vea algo.
 *
 * La serie tiene una forma deliberada: buena al empezar la manana, declive
 * progresivo por fatiga, un par de recuperaciones tras las pausas. Es lo que
 * hace legible el indicador de declive intra-sesion.
 */

import { config } from "@/config/app.config";
import { actualizarBaseline, crearBaseline } from "@/dominio/baseline-adaptativo";
import type { ConfigBaseline } from "@/dominio/baseline-adaptativo";
import { metricasUniformes } from "@/dominio/postura-de-prueba";
import { ORDEN_METRICAS } from "@/dominio/puntaje";
import type { FilaBaseline, MetricasPostura, MuestraPuntaje } from "@/dominio/tipos";
import { crearAleatorio, fechaHace, gaussiano } from "../semilla";

const rnd = crearAleatorio(config.SEMILLA + 30);

/** Duracion de la sesion ya transcurrida, en segundos. */
export const SEGUNDOS_YA_TRANSCURRIDOS = 2 * 3600 + 40 * 60;

/**
 * Espaciado de las muestras historicas: una cada 2 segundos.
 *
 * NO se usa el intervalo real de muestreo (5 por segundo). A esa tasa, dos horas
 * y media de sesion son 48.000 muestras: el motor las recortaria por su limite de
 * memoria y el panel acabaria reportando una duracion de sesion distinta a la que
 * muestra la bandeja. Dos segundos dan resolucion de sobra para el sparkline y
 * mantienen la serie en unos pocos miles de puntos.
 *
 * Debe quedar por debajo del corte de 5 s con que `resumirSesion` detecta que la
 * aplicacion estuvo detenida, o la sesion entera contaria como tiempo muerto.
 */
const DT = 2;

/** Tramos con ausencias: la persona se levanto. */
const AUSENCIAS: [number, number][] = [
  [1850, 2180],
  [5400, 5760],
];

const enAusencia = (t: number) => AUSENCIAS.some(([a, b]) => t >= a && t <= b);

/**
 * Curva base del puntaje a lo largo de la sesion.
 *
 * Arranca alta, decae por fatiga y se recupera parcialmente tras cada ausencia
 * — que es exactamente el argumento a favor de los recordatorios de pausa.
 */
/**
 * Tramo de mala postura sostenida.
 *
 * NO es decorativo: sin el, la sesion entera se queda por encima del umbral de
 * aviso y el historial del baseline adaptativo no tendria NI UNA muestra
 * rechazada. La pantalla del aporte 1 mostraria 100% de aceptacion, que es
 * exactamente lo contrario de lo que hay que demostrar — las salvaguardas se
 * ven cuando rechazan algo, no cuando no tienen nada que rechazar.
 *
 * Ademas es realista: el bajon de la tarde es el patron que esta aplicacion
 * existe para detectar.
 */
const BAJON: [number, number] = [5900, 7300];

function curvaPuntaje(t: number): number {
  const fatiga = 14 * (1 - Math.exp(-t / 4200));
  const desdeUltimaPausa = AUSENCIAS.reduce(
    (acc, [, fin]) => (t > fin ? t - fin : acc),
    t,
  );
  const recuperacion = 9 * Math.exp(-desdeUltimaPausa / 900);
  const ondulacion = 3.5 * Math.sin(t / 260);

  // Entrada y salida suaves del bajon: un escalon se veria fabricado.
  const [inicio, fin] = BAJON;
  const dentro = t >= inicio && t <= fin;
  const rampa = dentro
    ? Math.min(1, (t - inicio) / 240) * Math.min(1, (fin - t) / 300)
    : 0;

  return 86 - fatiga + recuperacion + ondulacion - 24 * rampa;
}

function construirMuestras(): MuestraPuntaje[] {
  const muestras: MuestraPuntaje[] = [];
  for (let t = 0; t <= SEGUNDOS_YA_TRANSCURRIDOS; t += DT) {
    if (enAusencia(t)) {
      muestras.push({ t, score: 0, detectado: false });
      continue;
    }
    const score = Math.max(12, Math.min(99, curvaPuntaje(t) + gaussiano(0, 2.6, rnd)));
    muestras.push({ t, score, detectado: true });
  }
  return muestras;
}

export const MUESTRAS_SESION: MuestraPuntaje[] = construirMuestras();

/** Resultado de la calibracion inicial de 6 segundos de esta persona. */
export const CALIBRACION_INICIAL: MetricasPostura = {
  inclinacionCabeza: 0.86,
  cuelloVertical: 0.83,
  nivelHombros: 0.91,
  rotacionHombros: 0.88,
  alineacionColumna: 0.85,
  inclinacionLateralCabeza: 0.92,
};

const CFG_BASELINE: ConfigBaseline = {
  tauSegundos: config.BASELINE_TAU_SEGUNDOS,
  pisoCalidad: config.BASELINE_PISO_CALIDAD,
  derivaMaxima: config.BASELINE_DERIVA_MAXIMA,
  activo: true,
};

/**
 * Historial de evolucion del baseline — tabla `adaptive_baseline_history`.
 *
 * Se genera EJECUTANDO el motor real de baseline sobre las muestras de la
 * sesion, no escribiendo resultados a mano. Si manana se ajusta una salvaguarda,
 * esta grafica se ajusta con ella y no queda mintiendo. Un historial escrito a
 * mano se desincroniza del algoritmo en la primera modificacion.
 */
function construirHistorialBaseline(): FilaBaseline[] {
  let estado = crearBaseline(CALIBRACION_INICIAL);
  const filas: FilaBaseline[] = [];
  // Una fila cada 4 minutos: suficiente para ver la curva sin ahogar la grafica.
  const cada = Math.round(240 / DT);

  MUESTRAS_SESION.forEach((muestra, i) => {
    if (!muestra.detectado) return;

    // Se reconstruyen metricas plausibles a partir del puntaje: en el producto
    // real llegan del detector, aqui se derivan para que la evidencia sea
    // coherente con la serie de puntajes que se ve en el panel.
    const nivel = muestra.score / 100;
    const metricas = {} as MetricasPostura;
    for (const nombre of ORDEN_METRICAS) {
      metricas[nombre] = Math.max(0, Math.min(1, nivel + gaussiano(0, 0.035, rnd)));
    }

    const estadoFsm = muestra.score < config.UMBRAL_MALA_POSTURA ? "alerta" : "buena";
    const r = actualizarBaseline(estado, metricas, muestra.score, estadoFsm, DT, CFG_BASELINE);
    estado = r.estado;

    if (i % cada !== 0) return;
    filas.push({
      timestamp: fechaHace(0, (SEGUNDOS_YA_TRANSCURRIDOS - muestra.t) / 3600).toISOString(),
      metric_name: "cuelloVertical",
      baseline_value: estado.valores.cuelloVertical,
      sample_value: metricas.cuelloVertical,
      accepted: r.aceptada,
      motivo: r.motivo,
    });
  });

  return filas;
}

export const HISTORIAL_BASELINE: FilaBaseline[] = construirHistorialBaseline();

/** Estado final del baseline tras procesar toda la sesion. */
export const ESTADO_BASELINE = (() => {
  let estado = crearBaseline(CALIBRACION_INICIAL);
  const r2 = crearAleatorio(config.SEMILLA + 31);
  for (const muestra of MUESTRAS_SESION) {
    if (!muestra.detectado) continue;
    const nivel = muestra.score / 100;
    const metricas = {} as MetricasPostura;
    for (const nombre of ORDEN_METRICAS) {
      metricas[nombre] = Math.max(0, Math.min(1, nivel + gaussiano(0, 0.035, r2)));
    }
    const estadoFsm = muestra.score < config.UMBRAL_MALA_POSTURA ? "alerta" : "buena";
    estado = actualizarBaseline(
      estado,
      metricas,
      muestra.score,
      estadoFsm,
      DT,
      CFG_BASELINE,
    ).estado;
  }
  return estado;
})();

/** Metricas del ultimo frame, para que el desglose no arranque vacio. */
export const METRICAS_ACTUALES: MetricasPostura = metricasUniformes(0.82);
