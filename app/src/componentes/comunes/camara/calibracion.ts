/**
 * Aporte propio de Espinker (Fase 4). Vive aparte de tarjeta-calibracion.tsx
 * porque un archivo de componentes no debe exportar funciones sueltas (rompe la
 * recarga en caliente) y la usan tanto la tarjeta como la barra de controles.
 */

import type { CalibracionPostural } from "@/dominio/tipos";

/** true si la persona ya marco su postura de referencia (distancia o angulo). */
export function estaCalibrada(calibracion: CalibracionPostural): boolean {
  return calibracion.offsetZ > 0 || calibracion.vectorArriba !== null;
}
