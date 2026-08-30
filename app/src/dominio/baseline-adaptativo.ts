/**
 * Baseline adaptativo por media movil exponencial (EMA).
 *
 * APORTE PROPIO DE HABITUSITOS — no existe en BatesPosture. Es la contribucion 1
 * de la tesis (prompt maestro seccion 11.1) y por eso vive en su propio modulo,
 * separado del motor de puntaje heredado.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * Hoy la calibracion del proyecto original dura 6 segundos y se congela para
 * siempre. Peor: se verifico contra el repositorio el 2026-07-31 que
 * `ui/onboarding.py` guarda `baseline_posture_score`, `baseline_neck_angle` y
 * `baseline_shoulder_level`, pero `ml/pose_detector.py` sigue usando vectores
 * ideales fijos `[0,-1,0]`. Es decir: la calibracion se guarda y no se usa.
 *
 * EL RIESGO DEL DISENO INGENUO
 * ----------------------------
 * Una EMA alimentada con CUALQUIER muestra arrastra el baseline hacia la mala
 * postura del propio usuario. Con el tiempo el sistema deja de avisar, no porque
 * la persona mejore, sino porque el sistema se acostumbro. Esto se llama deriva
 * del baseline y es el modo de fallo que hunde todo el aporte si no se ataca.
 *
 * TRES SALVAGUARDAS, EN ESTE ORDEN
 * --------------------------------
 * 1. COMPUERTA DE CALIDAD — solo entran al EMA las muestras cuyo puntaje ya
 *    supera un piso de calidad. El baseline se ajusta a variaciones normales de
 *    una BUENA postura; nunca se relaja hacia una mala.
 * 2. CONGELADO EN ALERTA — si la maquina de estado esta en `alerta`, el baseline
 *    no se actualiza en absoluto. Impide que la mala postura sostenida se
 *    autonormalice, que es justo el escenario que preocupa.
 * 3. ANCLA DURA — el baseline se satura dentro de una banda alrededor del optimo
 *    ergonomico. Aunque fallaran las dos anteriores, la deriva esta acotada por
 *    construccion.
 *
 * ALPHA SE DERIVA DE TAU, NO AL REVES
 * -----------------------------------
 * `alpha = 1 - exp(-dt / tau)`, con `tau` en SEGUNDOS y `dt` el intervalo real
 * entre muestras. Si alpha se fijara por frame, el baseline se adaptaria ~2.5
 * veces mas lento en un portatil que muestrea a 12 FPS que en uno a 30 — el
 * mismo software se comportaria distinto en cada equipo de la prueba con 15-70
 * participantes, y los resultados no serian comparables entre si.
 *
 * Cada muestra se registra con `accepted` y, si fue rechazada, con el motivo:
 * esa serie es la evidencia grafica de que el mecanismo funciona (seccion 12,
 * tabla `adaptive_baseline_history`).
 *
 * Este archivo no importa NADA fuera del dominio.
 */

import type {
  EstadoPostural,
  MetricasPostura,
  MotivoRechazo,
  NombreMetrica,
} from "./tipos";
import { ORDEN_METRICAS } from "./puntaje";

export interface ConfigBaseline {
  /** Constante de tiempo del EMA, en segundos. */
  tauSegundos: number;
  /** Puntaje minimo de la muestra para que entre al EMA (salvaguarda 1). */
  pisoCalidad: number;
  /** Desviacion maxima permitida respecto al optimo (salvaguarda 3), en
   *  unidades normalizadas de metrica [0,1]. */
  derivaMaxima: number;
  /** Si el mecanismo esta activo. Apagado = comportamiento del proyecto
   *  original (baseline estatico). El usuario puede volver a el cuando quiera. */
  activo: boolean;
}

/**
 * Optimo ergonomico por metrica, en unidades normalizadas.
 *
 * 1.0 significa "sin desviacion respecto a la geometria ideal". El ancla no se
 * pone en 1.0 exacto porque nadie se sienta perfecto ni deberia intentarlo: el
 * onboarding le dice explicitamente al usuario "sientate como normalmente te
 * sientas, no te alinees perfecto". Estos valores son el centro de la banda
 * dentro de la cual el baseline puede moverse.
 *
 * Referencia ergonomica: OSHA Computer Workstations eTool, posicion neutra
 * (https://www.osha.gov/etools/computer-workstations/positions).
 */
export const OPTIMO_ERGONOMICO: MetricasPostura = {
  inclinacionCabeza: 0.92,
  cuelloVertical: 0.9,
  nivelHombros: 0.94,
  rotacionHombros: 0.92,
  alineacionColumna: 0.9,
  inclinacionLateralCabeza: 0.94,
};

export interface EstadoBaseline {
  /** Valor actual del baseline por metrica. */
  valores: MetricasPostura;
  /** Muestras que se incorporaron al EMA. */
  aceptadas: number;
  /** Muestras descartadas, desglosadas por motivo. */
  rechazadas: Record<MotivoRechazo, number>;
}

export interface ResultadoActualizacion {
  estado: EstadoBaseline;
  aceptada: boolean;
  motivo: MotivoRechazo | null;
  /** alpha efectivo usado en esta actualizacion. Se expone para la grafica de
   *  evidencia: permite mostrar que alpha es estable aunque el FPS varie. */
  alpha: number;
}

/**
 * Convierte una constante de tiempo en segundos al factor de suavizado del EMA.
 *
 *     alpha = 1 - exp(-dt / tau)
 *
 * Con dt = tau, alpha ~= 0.63: el baseline recorre el 63% de la distancia hacia
 * la nueva medicion en un tau. Es la definicion estandar de constante de tiempo.
 */
export function alphaDesdeTau(dtSegundos: number, tauSegundos: number): number {
  if (tauSegundos <= 0) return 1;
  if (dtSegundos <= 0) return 0;
  return 1 - Math.exp(-dtSegundos / tauSegundos);
}

/** Inversa: cuantos segundos tarda el baseline en recorrer el 63% del camino. */
export function tauDesdeAlpha(dtSegundos: number, alpha: number): number {
  if (alpha <= 0) return Infinity;
  if (alpha >= 1) return 0;
  return -dtSegundos / Math.log(1 - alpha);
}

const acotar = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Baseline inicial: el resultado de la calibracion de 6 segundos. */
export function crearBaseline(calibracion: MetricasPostura): EstadoBaseline {
  return {
    valores: { ...calibracion },
    aceptadas: 0,
    rechazadas: {
      "calidad-insuficiente": 0,
      "estado-de-alerta": 0,
      "limite-de-deriva": 0,
    },
  };
}

/**
 * Incorpora una muestra al baseline, aplicando las tres salvaguardas.
 *
 * Devuelve siempre un estado (nunca lanza) y declara si la muestra fue aceptada
 * y por que no, si aplica. El llamador persiste ese veredicto en
 * `adaptive_baseline_history`.
 *
 * @param estado    Estado actual del baseline.
 * @param muestra   Metricas normalizadas del frame.
 * @param puntaje   Puntaje 0-100 de ese mismo frame.
 * @param estadoFsm Estado de la maquina de alertas en ese instante.
 * @param dtSegundos Intervalo real desde la muestra anterior.
 */
export function actualizarBaseline(
  estado: EstadoBaseline,
  muestra: MetricasPostura,
  puntaje: number,
  estadoFsm: EstadoPostural,
  dtSegundos: number,
  cfg: ConfigBaseline,
): ResultadoActualizacion {
  const sinCambio = (motivo: MotivoRechazo): ResultadoActualizacion => ({
    estado: {
      ...estado,
      rechazadas: { ...estado.rechazadas, [motivo]: estado.rechazadas[motivo] + 1 },
    },
    aceptada: false,
    motivo,
    alpha: 0,
  });

  // Salvaguarda 2 — congelado en alerta. Se evalua PRIMERO: si el sistema ya
  // esta avisando de mala postura, ninguna muestra debe mover el baseline, ni
  // siquiera una que casualmente pase el piso de calidad.
  if (estadoFsm === "alerta") return sinCambio("estado-de-alerta");

  // Salvaguarda 1 — compuerta de calidad.
  if (puntaje < cfg.pisoCalidad) return sinCambio("calidad-insuficiente");

  const alpha = alphaDesdeTau(dtSegundos, cfg.tauSegundos);
  const valores = {} as MetricasPostura;
  let saturoAlguna = false;

  for (const nombre of ORDEN_METRICAS) {
    const anterior = estado.valores[nombre];
    const propuesto = alpha * muestra[nombre] + (1 - alpha) * anterior;

    // Salvaguarda 3 — ancla dura alrededor del optimo ergonomico.
    const optimo = OPTIMO_ERGONOMICO[nombre];
    const acotado = acotar(
      propuesto,
      optimo - cfg.derivaMaxima,
      optimo + cfg.derivaMaxima,
    );
    if (Math.abs(acotado - propuesto) > 1e-9) saturoAlguna = true;

    valores[nombre] = acotado;
  }

  return {
    estado: {
      valores,
      aceptadas: estado.aceptadas + 1,
      rechazadas: saturoAlguna
        ? {
            ...estado.rechazadas,
            "limite-de-deriva": estado.rechazadas["limite-de-deriva"] + 1,
          }
        : estado.rechazadas,
    },
    aceptada: true,
    // La muestra entro, pero al menos una metrica choco contra el ancla. Se
    // registra para que la grafica de evidencia lo muestre: es la senal de que
    // la salvaguarda 3 esta interviniendo.
    motivo: saturoAlguna ? "limite-de-deriva" : null,
    alpha,
  };
}

/**
 * Cuanta parte de la diferencia entre la referencia personal y el optimo
 * ergonomico se le acredita al usuario.
 *
 * POR QUE NO SE NORMALIZA DIVIDIENDO. La formulacion obvia seria
 * `metrica / baseline`: una postura igual a la referencia puntuaria 1.0. Suena
 * bien y esta mal, por dos razones que se ven en cuanto se prueba:
 *
 *  1. Con la referencia relajada, TODO puntua alto. Una referencia en 0.72
 *     convierte una postura mediocre de 0.82 en un 100, y la aplicacion pasa a
 *     decir "excelente" todo el dia. Deja de servir para nada.
 *  2. Amplifica tambien la mala postura: 0.50 / 0.72 = 0.69, un encorvamiento
 *     claro disfrazado de aceptable.
 *
 * Es la deriva del baseline entrando por otra puerta: no por como se aprende la
 * referencia, sino por como se usa. La compensacion PARCIAL y ADITIVA arregla
 * las dos cosas: reconoce que no todo el mundo puede sentarse como un maniqui,
 * pero conserva el significado absoluto de la escala.
 *
 * 0.6 es una decision de diseno, no un valor medido: se acredita algo mas de la
 * mitad de la diferencia. Debe recalibrarse con los datos de los participantes.
 */
export const FACTOR_COMPENSACION = 0.6;

/**
 * Ajusta las metricas de un frame contra la referencia personal del usuario.
 *
 * Esta es la razon de ser del aporte: el puntaje deja de medirse solo contra una
 * geometria ideal universal y reconoce la postura habitual de esta persona.
 *
 *     ajustada = metrica + factor * max(0, optimo - referencia)
 *
 * La compensacion nunca es negativa: si alguien tiene una referencia MEJOR que
 * el optimo, no se le penaliza por ello.
 */
export function aplicarBaseline(
  metricas: MetricasPostura,
  baseline: MetricasPostura,
  factor: number = FACTOR_COMPENSACION,
): MetricasPostura {
  const salida = {} as MetricasPostura;
  for (const nombre of ORDEN_METRICAS) {
    const brecha = Math.max(0, OPTIMO_ERGONOMICO[nombre] - baseline[nombre]);
    salida[nombre] = acotar(metricas[nombre] + factor * brecha, 0, 1);
  }
  return salida;
}

/** Cuanto se ha alejado el baseline del optimo, por metrica. Para la UI. */
export function derivaActual(
  baseline: MetricasPostura,
): Record<NombreMetrica, number> {
  const salida = {} as Record<NombreMetrica, number>;
  for (const nombre of ORDEN_METRICAS) {
    salida[nombre] = baseline[nombre] - OPTIMO_ERGONOMICO[nombre];
  }
  return salida;
}
