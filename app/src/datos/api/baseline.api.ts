/**
 * Baseline adaptativo — aporte 1 de tesis (seccion 11.1).
 *
 * Equivalencias en el producto real:
 *   obtenerEstadoBaseline()  -> AdaptiveBaselineService.current()
 *   obtenerHistorialBaseline()-> SELECT * FROM adaptive_baseline_history
 *   resetearBaseline()       -> AdaptiveBaselineService.reset_to_calibration()
 *   exportarBaselineCsv()    -> exportacion para el capitulo de resultados
 *
 * El modulo del producto real debe vivir en `services/adaptive_baseline_service.py`,
 * separado de `pose_detector.py` y de `score_service.py`: es un requisito de
 * trazabilidad de autoria ante el jurado, no solo buena practica (seccion 13).
 */

import type { EstadoBaseline } from "@/dominio/baseline-adaptativo";
import { OPTIMO_ERGONOMICO, derivaActual } from "@/dominio/baseline-adaptativo";
import type { FilaBaseline, MotivoRechazo, NombreMetrica } from "@/dominio/tipos";
import { actualizar, almacen } from "../almacen";
import { resolver } from "../cliente";
import {
  CALIBRACION_INICIAL,
  ESTADO_BASELINE,
  HISTORIAL_BASELINE,
} from "../fixtures/sesion";
import { crearBaseline } from "@/dominio/baseline-adaptativo";

export interface ResumenBaseline {
  estado: EstadoBaseline;
  calibracionInicial: typeof CALIBRACION_INICIAL;
  optimo: typeof OPTIMO_ERGONOMICO;
  deriva: Record<NombreMetrica, number>;
  totalRechazadas: number;
  reseteadoEn: string | null;
}

/** Se resetea en memoria cuando el usuario lo pide; no hay backend que guarde. */
let estadoActual: EstadoBaseline = ESTADO_BASELINE;

export async function obtenerEstadoBaseline(): Promise<ResumenBaseline> {
  return resolver("AdaptiveBaselineService.current()", () => ({
    estado: estadoActual,
    calibracionInicial: CALIBRACION_INICIAL,
    optimo: OPTIMO_ERGONOMICO,
    deriva: derivaActual(estadoActual.valores),
    totalRechazadas: Object.values(estadoActual.rechazadas).reduce((a, b) => a + b, 0),
    reseteadoEn: almacen().baselineReseteadoEn,
  }));
}

export async function obtenerHistorialBaseline(): Promise<FilaBaseline[]> {
  return resolver("SELECT * FROM adaptive_baseline_history", () => HISTORIAL_BASELINE);
}

/**
 * Vuelve a la calibracion inicial.
 *
 * Es una accion destructiva: borra lo aprendido. La pantalla confirma antes
 * (seccion 9.3). Poder volver al comportamiento original en cualquier momento es
 * una de las salvaguardas exigidas por la seccion 11.1.
 */
export async function resetearBaseline(): Promise<ResumenBaseline> {
  await resolver("AdaptiveBaselineService.reset_to_calibration()", () => {
    estadoActual = crearBaseline(CALIBRACION_INICIAL);
    actualizar({ baselineReseteadoEn: new Date(Date.now()).toISOString() });
  });
  return obtenerEstadoBaseline();
}

export const ETIQUETA_MOTIVO: Record<MotivoRechazo, string> = {
  "calidad-insuficiente": "La postura no era lo bastante buena para aprender de ella",
  "estado-de-alerta": "El sistema estaba avisando: no aprende mientras corrige",
  "limite-de-deriva": "Se alcanzo el limite maximo de ajuste permitido",
};

/** Explicacion de cada salvaguarda, para la pantalla del aporte. */
export const SALVAGUARDAS = [
  {
    numero: 1,
    nombre: "Compuerta de calidad",
    resumen: "Solo aprende de posturas que ya son buenas.",
    detalle:
      "Una media movil alimentada con cualquier muestra terminaria desplazando la referencia hacia la mala postura del propio usuario, volviendo el sistema cada vez menos sensible. Solo entran las muestras cuyo puntaje supera el piso de calidad.",
    motivo: "calidad-insuficiente" as MotivoRechazo,
  },
  {
    numero: 2,
    nombre: "Congelado durante la alerta",
    resumen: "Mientras te esta avisando, no aprende.",
    detalle:
      "Si el sistema esta en estado de alerta, ninguna muestra actualiza la referencia. Impide que una mala postura sostenida se normalice sola, que es exactamente el modo de fallo que preocupa.",
    motivo: "estado-de-alerta" as MotivoRechazo,
  },
  {
    numero: 3,
    nombre: "Limite duro de ajuste",
    resumen: "La referencia nunca se aleja demasiado del optimo ergonomico.",
    detalle:
      "Aunque fallaran las dos anteriores, la referencia esta acotada dentro de una banda alrededor de la postura neutra recomendada. La deriva esta limitada por construccion, no por confianza en el algoritmo.",
    motivo: "limite-de-deriva" as MotivoRechazo,
  },
];
