/**
 * Calculo del puntaje de postura — las siete metricas geometricas ponderadas.
 *
 * PROCEDENCIA: este modulo es la traduccion fiel a TypeScript de
 * `batesposture/ml/pose_detector.py::_compute_posture_metrics_from_points` del
 * proyecto original, especificado en la seccion 4.4 del prompt maestro. La
 * formula NO es un aporte de Habitusitos: es codigo heredado que aqui se
 * reimplementa para que el prototipo calcule exactamente lo mismo que el
 * software real, no una aproximacion.
 *
 * COMPUERTA DE VISIBILIDAD:
 * Cada metrica declara los landmarks que requiere. Si alguno tiene visibilidad
 * inferior al umbral (por ejemplo caderas fuera de cuadro en encuadre selfie),
 * la metrica se marca como no disponible y no se inventa un valor penalizado.
 * El puntaje total renormaliza los pesos solo entre las metricas confiables.
 */

import type {
  Landmark,
  MetricasPostura,
  NombreMetrica,
  ResultadoPostura,
} from "./tipos";
import { PUNTO } from "./tipos";
import {
  acotar,
  anguloConVertical,
  calcularCadenaCuello,
  puntoMedioVec,
  rotacionCabeza3D,
  visiblePara,
} from "./geometria-3d";

/** Orden canonico de las metricas. Debe coincidir con `PESOS_POR_DEFECTO`. */
export const ORDEN_METRICAS: readonly NombreMetrica[] = [
  "inclinacionCabeza",
  "cuelloVertical",
  "nivelHombros",
  "rotacionHombros",
  "alineacionColumna",
  "rotacionCabeza",
  "inclinacionLateralCabeza",
] as const;

export const ETIQUETA_METRICA: Record<NombreMetrica, string> = {
  inclinacionCabeza: "Cabeza adelantada",
  cuelloVertical: "Angulo del cuello",
  nivelHombros: "Hombros nivelados",
  rotacionHombros: "Torso de frente",
  alineacionColumna: "Espalda alineada",
  rotacionCabeza: "Cabeza al frente",
  inclinacionLateralCabeza: "Cabeza sin ladear",
};

/** Explicacion en lenguaje llano, para el usuario final. Sin jerga tecnica: la
 *  seccion 5 del prompt maestro prohibe "landmark", "CLAHE" y "EMA" en la UI. */
export const AYUDA_METRICA: Record<NombreMetrica, string> = {
  inclinacionCabeza: "Que tanto adelantas la cabeza respecto a los hombros.",
  cuelloVertical: "Cuanto se inclina tu cuello respecto a la vertical.",
  nivelHombros: "Si un hombro esta mas alto que el otro.",
  rotacionHombros: "Si el torso esta girado en vez de mirar al frente.",
  alineacionColumna: "Cuanto se inclina tu espalda respecto a la vertical.",
  rotacionCabeza: "Si la cabeza esta girada hacia un lado.",
  inclinacionLateralCabeza: "Si la cabeza esta ladeada hacia un hombro.",
};

/** Landmarks requeridos por cada una de las siete metricas para ser confiable. */
export const PUNTOS_POR_METRICA: Record<NombreMetrica, readonly number[]> = {
  inclinacionCabeza: [PUNTO.NARIZ, PUNTO.OREJA_IZQ, PUNTO.OREJA_DER],
  cuelloVertical: [PUNTO.HOMBRO_IZQ, PUNTO.HOMBRO_DER, PUNTO.OREJA_IZQ, PUNTO.OREJA_DER],
  nivelHombros: [PUNTO.HOMBRO_IZQ, PUNTO.HOMBRO_DER],
  rotacionHombros: [PUNTO.HOMBRO_IZQ, PUNTO.HOMBRO_DER],
  alineacionColumna: [PUNTO.CADERA_IZQ, PUNTO.CADERA_DER, PUNTO.HOMBRO_IZQ, PUNTO.HOMBRO_DER],
  rotacionCabeza: [PUNTO.HOMBRO_IZQ, PUNTO.HOMBRO_DER, PUNTO.OREJA_IZQ, PUNTO.OREJA_DER],
  inclinacionLateralCabeza: [PUNTO.OREJA_IZQ, PUNTO.OREJA_DER],
} as const;

export interface UmbralesMetricas {
  inclinacionCabeza: number;
  cuelloVertical: number;
  nivelHombros: number;
  rotacionHombros: number;
  alineacionColumna: number;
  rotacionCabeza: number;
  inclinacionLateralCabeza: number;
}

const VERTICAL_IDEAL_DEFAULT: [number, number, number] = [0, -1, 0];
const PROPORCION_OREJAS_HOMBROS = 0.7;

const normalizar = (desviacion: number, umbral: number) =>
  acotar(1 - desviacion / umbral, 0, 1);

/**
 * Calcula las siete metricas a partir de los landmarks de un frame.
 * Soporta worldLandmarks metricos en 3D para precision biomecanica libre de distorsion 2D.
 */
export function calcularMetricas(
  puntos: readonly Landmark[],
  umbrales: UmbralesMetricas,
  offsetCabezaAdelante = 0,
  verticalIdeal: [number, number, number] = VERTICAL_IDEAL_DEFAULT,
  worldLandmarks?: readonly Landmark[] | null,
): MetricasPostura {
  if (
    worldLandmarks &&
    worldLandmarks.length >= 25 &&
    visiblePara(worldLandmarks, [PUNTO.HOMBRO_IZQ, PUNTO.HOMBRO_DER], 0.3)
  ) {
    const hombroIzq = worldLandmarks[PUNTO.HOMBRO_IZQ];
    const hombroDer = worldLandmarks[PUNTO.HOMBRO_DER];
    const orejaIzq = worldLandmarks[PUNTO.OREJA_IZQ];
    const orejaDer = worldLandmarks[PUNTO.OREJA_DER];
    const caderaIzq = worldLandmarks[PUNTO.CADERA_IZQ];
    const caderaDer = worldLandmarks[PUNTO.CADERA_DER];

    const cadena = calcularCadenaCuello(
      hombroIzq,
      hombroDer,
      orejaIzq,
      orejaDer,
    );
    const medioCaderas = puntoMedioVec(caderaIzq, caderaDer);
    const nariz3D = worldLandmarks[PUNTO.NARIZ];

    // 1. Cabeza adelantada (Profundidad sagital 3D + Flexion cefalica)
    // a) Desplazamiento sagital del centro de la cabeza respecto a la base del cuello C7
    const dzOrejas = Math.max(0, (cadena.base.z - cadena.tope.z) - offsetCabezaAdelante);
    const desvTranslacion = dzOrejas / 0.06;

    // b) Flexion/inclinacion de la cabeza hacia adelante (Pitch cefalico en grados)
    const rot = rotacionCabeza3D(worldLandmarks, verticalIdeal);
    const pitch = rot ? rot.pitch : 0;
    const desvPitch = Math.max(0, pitch - 8) / 18;

    // c) Avance del rostro/nariz respecto al plano de los hombros
    const dzNariz = nariz3D
      ? Math.max(0, (cadena.base.z - nariz3D.z) - offsetCabezaAdelante - 0.08) / 0.09
      : 0;

    const desviacionCabeza = Math.max(desvTranslacion, desvPitch, dzNariz);
    const inclinacionCabeza = normalizar(desviacionCabeza, 1.0);

    // 2. Angulo del cuello (3D)
    const anguloCuello3D = anguloConVertical(cadena.base, cadena.tope, verticalIdeal);
    const cuelloVertical = normalizar(anguloCuello3D, umbrales.cuelloVertical);

    // 3. Nivel de hombros
    const nivelHombros = normalizar(
      Math.abs(hombroIzq.y - hombroDer.y),
      umbrales.nivelHombros,
    );

    // 4. Rotacion de hombros
    const rotacionHombros = normalizar(
      Math.abs(hombroIzq.z - hombroDer.z),
      umbrales.rotacionHombros,
    );

    // 5. Alineacion de columna
    const alineacionColumna = normalizar(
      anguloConVertical(medioCaderas, cadena.base, verticalIdeal),
      umbrales.alineacionColumna,
    );

    // 6. Rotacion de cabeza
    const rotacionCabeza = normalizar(
      Math.abs(orejaDer.z - orejaIzq.z),
      umbrales.rotacionCabeza * 0.25,
    );

    // 7. Inclinacion lateral de cabeza (Coronal cervical)
    const dxCervical = Math.abs(cadena.tope.x - cadena.base.x);
    const dyCervical = Math.max(0.01, Math.abs(cadena.tope.y - cadena.base.y));
    const anguloLateral = (Math.atan2(dxCervical, dyCervical) * 180) / Math.PI;
    const inclinacionLateralCabeza = normalizar(Math.max(0, anguloLateral - 3), 15);

    return {
      inclinacionCabeza,
      cuelloVertical,
      nivelHombros,
      rotacionHombros,
      alineacionColumna,
      rotacionCabeza,
      inclinacionLateralCabeza,
    };
  }

  // Fallback 2D canonico con cadena de cuello
  const nariz = puntos[PUNTO.NARIZ] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const orejaIzq = puntos[PUNTO.OREJA_IZQ] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const orejaDer = puntos[PUNTO.OREJA_DER] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const hombroIzq = puntos[PUNTO.HOMBRO_IZQ] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const hombroDer = puntos[PUNTO.HOMBRO_DER] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const caderaIzq = puntos[PUNTO.CADERA_IZQ] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const caderaDer = puntos[PUNTO.CADERA_DER] ?? { x: 0, y: 0, z: 0, visibility: 0 };

  const cadena = calcularCadenaCuello(
    hombroIzq,
    hombroDer,
    orejaIzq,
    orejaDer,
  );
  const medioCaderas = puntoMedioVec(caderaIzq, caderaDer);

  const dzCruda = Math.abs(nariz.z - cadena.tope.z);
  const dz = Math.max(0, dzCruda - offsetCabezaAdelante);
  const inclinacionCabeza = acotar(1 - dz * umbrales.inclinacionCabeza, 0, 1);

  const cuelloVertical = normalizar(
    anguloConVertical(cadena.base, cadena.tope, verticalIdeal),
    umbrales.cuelloVertical,
  );

  const nivelHombros = normalizar(
    Math.abs(hombroIzq.y - hombroDer.y),
    umbrales.nivelHombros,
  );

  const rotacionHombros = normalizar(
    Math.abs(hombroIzq.z - hombroDer.z),
    umbrales.rotacionHombros,
  );

  const alineacionColumna = normalizar(
    anguloConVertical(medioCaderas, cadena.base, verticalIdeal),
    umbrales.alineacionColumna,
  );

  const anchoHombros = Math.hypot(hombroIzq.x - hombroDer.x, hombroIzq.y - hombroDer.y);
  const distanciaOrejas = Math.hypot(orejaIzq.x - orejaDer.x, orejaIzq.y - orejaDer.y);
  const idealOrejas = anchoHombros * PROPORCION_OREJAS_HOMBROS;
  const rotacionCabeza =
    idealOrejas === 0
      ? 1
      : normalizar(
          Math.abs(distanciaOrejas - idealOrejas) / idealOrejas,
          umbrales.rotacionCabeza,
        );

  const inclinacionLateralCabeza = normalizar(
    Math.abs(orejaIzq.y - orejaDer.y),
    umbrales.inclinacionLateralCabeza,
  );

  return {
    inclinacionCabeza,
    cuelloVertical,
    nivelHombros,
    rotacionHombros,
    alineacionColumna,
    rotacionCabeza,
    inclinacionLateralCabeza,
  };
}

/**
 * Calcula las metricas evaluando ademas la compuerta de visibilidad de cada una.
 */
export function calcularMetricasConDisponibilidad(
  puntos: readonly Landmark[],
  umbrales: UmbralesMetricas,
  offsetCabezaAdelante = 0,
  verticalIdeal: [number, number, number] = VERTICAL_IDEAL_DEFAULT,
  umbralVisibilidad = 0.4,
  worldLandmarks?: readonly Landmark[] | null,
): { metricas: MetricasPostura; disponibilidad: Record<NombreMetrica, boolean> } {
  const metricas = calcularMetricas(
    puntos,
    umbrales,
    offsetCabezaAdelante,
    verticalIdeal,
    worldLandmarks,
  );

  const disponibilidad: Record<NombreMetrica, boolean> = {
    inclinacionCabeza: visiblePara(puntos, PUNTOS_POR_METRICA.inclinacionCabeza, umbralVisibilidad),
    cuelloVertical: visiblePara(puntos, PUNTOS_POR_METRICA.cuelloVertical, umbralVisibilidad),
    nivelHombros: visiblePara(puntos, PUNTOS_POR_METRICA.nivelHombros, umbralVisibilidad),
    rotacionHombros: visiblePara(puntos, PUNTOS_POR_METRICA.rotacionHombros, umbralVisibilidad),
    alineacionColumna: visiblePara(puntos, PUNTOS_POR_METRICA.alineacionColumna, umbralVisibilidad),
    rotacionCabeza: visiblePara(puntos, PUNTOS_POR_METRICA.rotacionCabeza, umbralVisibilidad),
    inclinacionLateralCabeza: visiblePara(puntos, PUNTOS_POR_METRICA.inclinacionLateralCabeza, umbralVisibilidad),
  };

  return { metricas, disponibilidad };
}

export function normalizarPesos(pesos: readonly number[]): number[] {
  if (pesos.length !== ORDEN_METRICAS.length) {
    throw new Error(
      `Se esperaban ${ORDEN_METRICAS.length} pesos y llegaron ${pesos.length}.`,
    );
  }
  if (pesos.some((p) => p < 0 || !Number.isFinite(p))) {
    throw new Error("Los pesos deben ser numeros finitos y no negativos.");
  }
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0) {
    throw new Error("La suma de los pesos debe ser positiva.");
  }
  return pesos.map((p) => p / suma);
}

export function calcularPuntaje(
  metricas: MetricasPostura,
  pesos: readonly number[],
  disponibilidad?: Partial<Record<NombreMetrica, boolean>>,
): ResultadoPostura {
  const pesosNormGlobal = normalizarPesos(pesos);

  const dispMap: Record<NombreMetrica, boolean> = {
    inclinacionCabeza: disponibilidad?.inclinacionCabeza !== false,
    cuelloVertical: disponibilidad?.cuelloVertical !== false,
    nivelHombros: disponibilidad?.nivelHombros !== false,
    rotacionHombros: disponibilidad?.rotacionHombros !== false,
    alineacionColumna: disponibilidad?.alineacionColumna !== false,
    rotacionCabeza: disponibilidad?.rotacionCabeza !== false,
    inclinacionLateralCabeza: disponibilidad?.inclinacionLateralCabeza !== false,
  };

  const aportes: MetricasPostura = {
    inclinacionCabeza: 0,
    cuelloVertical: 0,
    nivelHombros: 0,
    rotacionHombros: 0,
    alineacionColumna: 0,
    rotacionCabeza: 0,
    inclinacionLateralCabeza: 0,
  };

  const sumaPesosDisponibles = ORDEN_METRICAS.reduce((acc, nombre, i) => {
    return dispMap[nombre] ? acc + pesos[i] : acc;
  }, 0);

  let acumulado = 0;

  if (sumaPesosDisponibles > 0) {
    ORDEN_METRICAS.forEach((nombre, i) => {
      if (dispMap[nombre]) {
        const pesoNormDisp = pesos[i] / sumaPesosDisponibles;
        const aporte = metricas[nombre] * pesoNormDisp * 100;
        aportes[nombre] = aporte;
        acumulado += aporte;
      } else {
        aportes[nombre] = 0;
      }
    });
  } else {
    ORDEN_METRICAS.forEach((nombre, i) => {
      aportes[nombre] = metricas[nombre] * pesosNormGlobal[i] * 100;
      acumulado += aportes[nombre];
    });
  }

  return {
    puntaje: acotar(acumulado, 0, 100),
    metricas,
    aportes,
    disponibilidad: dispMap,
  };
}

export function evaluarFrame(
  puntos: readonly Landmark[] | null,
  umbrales: UmbralesMetricas,
  pesos: readonly number[],
  offsetCabezaAdelante = 0,
  verticalIdeal: [number, number, number] = VERTICAL_IDEAL_DEFAULT,
  umbralVisibilidad = 0.4,
): ResultadoPostura | null {
  if (!puntos || puntos.length < 25) return null;
  try {
    const { metricas, disponibilidad } = calcularMetricasConDisponibilidad(
      puntos,
      umbrales,
      offsetCabezaAdelante,
      verticalIdeal,
      umbralVisibilidad,
    );
    return calcularPuntaje(metricas, pesos, disponibilidad);
  } catch {
    return null;
  }
}
