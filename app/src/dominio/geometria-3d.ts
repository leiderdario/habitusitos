/**
 * Matematica vectorial y geometria 3D para analisis postural.
 *
 * UNICA FUENTE DE VERDAD de operaciones vectoriales en el dominio.
 * CERO dependencias externas: logica pura sobre numeros.
 *
 * NOTA METODOLOGICA:
 * La orientacion de la cabeza 3D (pitch, yaw, roll) calculada a partir de los
 * landmarks faciales dispersos de BlazePose es una APROXIMACION biomecanica, no
 * una captura 6DOF de grado clinico. Es suficiente para discriminar posturas de
 * oficina (cabeza agachada, girada al monitor secundario o ladeada).
 */

import type { Landmark, Landmark3D } from "./tipos";
import { PUNTO } from "./tipos";

export type Vec3 = { x: number; y: number; z: number };

export const acotar = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export function restar(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function sumar(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function escalar(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

export function productoPunto(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function productoCruz(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function norma(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalizarVector(v: Vec3): Vec3 {
  const n = norma(v);
  if (n === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

export function distanciaMetros(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function puntoMedioVec(a: Vec3, b: Vec3): Vec3 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

export interface PuntosCadenaCuello {
  /** Base cervical (vertebra C7 / centro de hombros) */
  base: Vec3;
  /** Centro del cuello (vertebra C4 / punto medio) */
  medio: Vec3;
  /** Tope cervical / Base del craneo (punto de articulacion suboccipital) */
  tope: Vec3;
}

/**
 * Punto sintetico de base del cuello (vertebra C7 / centro de hombros).
 */
export function puntoCuello(hombroIzq: Vec3, hombroDer: Vec3): Vec3 {
  return puntoMedioVec(hombroIzq, hombroDer);
}

/**
 * Punto sintetico del centro craneal (entre orejas o triangulacion con nariz).
 */
export function puntoCabezaCentro(orejaIzq: Vec3, orejaDer: Vec3, nariz?: Vec3): Vec3 {
  const medioOrejas = puntoMedioVec(orejaIzq, orejaDer);
  if (!nariz) return medioOrejas;
  return {
    x: medioOrejas.x * 0.7 + nariz.x * 0.3,
    y: medioOrejas.y * 0.7 + nariz.y * 0.3,
    z: medioOrejas.z * 0.7 + nariz.z * 0.3,
  };
}

/**
 * Calcula la cadena completa de 3 puntos del cuello (C7 base, C4 medio, C1 tope craneal).
 * El centro entre orejas representa anatomicamente la articulacion atlanto-occipital C1.
 */
export function calcularCadenaCuello(
  hombroIzq: Vec3,
  hombroDer: Vec3,
  orejaIzq: Vec3,
  orejaDer: Vec3,
): PuntosCadenaCuello {
  const base = puntoMedioVec(hombroIzq, hombroDer);
  const tope = puntoMedioVec(orejaIzq, orejaDer);
  const medio = puntoMedioVec(base, tope);

  return { base, medio, tope };
}

/**
 * Rota un vector 3D alrededor del eje vertical Y por un angulo en grados.
 * Positivo = rotacion en sentido horario vista desde arriba.
 */
export function rotarY(v: Vec3, anguloGrados: number): Vec3 {
  if (anguloGrados === 0) return { x: v.x, y: v.y, z: v.z };
  const rad = (anguloGrados * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: v.x * cos + v.z * sin,
    y: v.y,
    z: -v.x * sin + v.z * cos,
  };
}

/**
 * Verifica si todos los indices especificados tienen suficiente visibilidad.
 */
export function visiblePara(
  puntos: readonly Landmark[],
  indices: readonly number[],
  umbral: number,
): boolean {
  for (const idx of indices) {
    const p = puntos[idx];
    if (!p || (p.visibility ?? 1) < umbral) {
      return false;
    }
  }
  return true;
}

/**
 * Angulo en grados entre el vector (desde -> hasta) y el vector vertical de referencia.
 *
 * Por defecto `verticalIdeal` es `[0, -1, 0]` (apuntando hacia arriba en el
 * sistema de coordenadas de MediaPipe donde Y crece hacia abajo).
 */
export function anguloConVertical(
  desde: Vec3,
  hasta: Vec3,
  verticalIdeal: [number, number, number] = [0, -1, 0],
): number {
  const v = [hasta.x - desde.x, hasta.y - desde.y, hasta.z - desde.z];
  const n = Math.hypot(v[0], v[1], v[2]);
  if (n === 0) return 0;

  const nVert = Math.hypot(verticalIdeal[0], verticalIdeal[1], verticalIdeal[2]);
  if (nVert === 0) return 0;

  const vNorm = [v[0] / n, v[1] / n, v[2] / n];
  const vertNorm = [
    verticalIdeal[0] / nVert,
    verticalIdeal[1] / nVert,
    verticalIdeal[2] / nVert,
  ];

  const dot = vNorm[0] * vertNorm[0] + vNorm[1] * vertNorm[1] + vNorm[2] * vertNorm[2];
  const coseno = acotar(dot, -1, 1);
  return (Math.acos(coseno) * 180) / Math.PI;
}

/**
 * Calcula los angulos de Euler aproximados de la cabeza (Pitch, Yaw, Roll) en grados
 * a partir de worldLandmarks metricos 3D.
 *
 * Convencion:
 * - Pitch (inclinacion hacia adelante/atras): positivo = flexion hacia abajo / adelante.
 * - Yaw (giro izquierda/derecha): positivo = giro hacia la derecha del usuario.
 * - Roll (ladeo hacia los lados): positivo = inclinacion hacia el hombro derecho.
 *
 * Maneja adecuadamente el bloqueo cardanico (gimbal lock) en pitch extremos sin NaN.
 */
export function rotacionCabeza3D(
  worldLandmarks: readonly Landmark3D[],
  vectorArriba: [number, number, number] | null = null,
): { pitch: number; yaw: number; roll: number } | null {
  const nariz = worldLandmarks[PUNTO.NARIZ];
  const ojoIzq = worldLandmarks[PUNTO.OJO_IZQ];
  const ojoDer = worldLandmarks[PUNTO.OJO_DER];
  const orejaIzq = worldLandmarks[PUNTO.OREJA_IZQ];
  const orejaDer = worldLandmarks[PUNTO.OREJA_DER];
  const bocaIzq = worldLandmarks[PUNTO.BOCA_IZQ];
  const bocaDer = worldLandmarks[PUNTO.BOCA_DER];

  if (!nariz || !ojoIzq || !ojoDer || !orejaIzq || !orejaDer || !bocaIzq || !bocaDer) {
    return null;
  }

  // Eje X cefalico: de oreja izquierda a oreja derecha
  const ejeX = normalizarVector(restar(orejaDer, orejaIzq));
  if (norma(ejeX) === 0) return null;

  // Centro facial entre ojos y centro de boca
  const centroOjos = puntoMedioVec(ojoIzq, ojoDer);
  const centroBoca = puntoMedioVec(bocaIzq, bocaDer);

  // Eje Y cefalico: de boca hacia arriba (centro ojos)
  const ejeYTemp = restar(centroOjos, centroBoca);
  // Ortogonalizar eje Y respecto a eje X
  const dotYX = productoPunto(ejeYTemp, ejeX);
  const ejeY = normalizarVector(restar(ejeYTemp, escalar(ejeX, dotYX)));
  if (norma(ejeY) === 0) return null;

  // Eje Z cefalico: normal al plano facial (apuntando hacia adelante desde la cara)
  // En MediaPipe coordinate system (X right, Y down, Z forward towards camera or back)
  const ejeZ = normalizarVector(productoCruz(ejeX, ejeY));
  if (norma(ejeZ) === 0) return null;

  // Vector vertical de referencia (global o calibrado)
  const upRef: Vec3 = vectorArriba
    ? normalizarVector({
        x: vectorArriba[0],
        y: vectorArriba[1],
        z: vectorArriba[2],
      })
    : { x: 0, y: -1, z: 0 };

  // Pitch: Angulo entre el eje Y cefalico y el vector arriba en el plano sagital (o angulo nariz-orejas)
  // Medimos que tanto se inclina la cabeza hacia abajo respecto a la vertical
  const anguloCefaloVertical = anguloConVertical({ x: 0, y: 0, z: 0 }, ejeY, [
    upRef.x,
    upRef.y,
    upRef.z,
  ]);

  // Signo del pitch: comparamos profundidad relativa de nariz vs orejas
  const medioOrejas = puntoMedioVec(orejaIzq, orejaDer);
  const direccionNarizZ = nariz.z - medioOrejas.z;
  const pitch = direccionNarizZ < 0 ? anguloCefaloVertical : -anguloCefaloVertical;

  // Yaw: rotacion horizontal. Diferencia de distancia Z entre oreja izq y oreja der
  const dzOrejas = orejaDer.z - orejaIzq.z;
  const dxOrejas = Math.max(0.01, Math.hypot(orejaDer.x - orejaIzq.x, orejaDer.y - orejaIzq.y));
  const yaw = (Math.atan2(dzOrejas, dxOrejas) * 180) / Math.PI;

  // Roll: desnivel en Y entre orejas respecto al eje horizontal
  const dyOrejas = orejaDer.y - orejaIzq.y;
  const roll = (Math.atan2(dyOrejas, dxOrejas) * 180) / Math.PI;

  return {
    pitch: Number.isFinite(pitch) ? acotar(pitch, -90, 90) : 0,
    yaw: Number.isFinite(yaw) ? acotar(yaw, -90, 90) : 0,
    roll: Number.isFinite(roll) ? acotar(roll, -90, 90) : 0,
  };
}
