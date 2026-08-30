import type { FramePose, Landmark3D } from "./tipos";
import { PUNTO } from "./tipos";
import {
  normalizarVector,
  puntoMedioVec,
  restar,
  rotarY,
  visiblePara,
} from "./geometria-3d";

const PUNTOS_CALIBRACION = [
  PUNTO.OREJA_IZQ,
  PUNTO.OREJA_DER,
  PUNTO.HOMBRO_IZQ,
  PUNTO.HOMBRO_DER,
  PUNTO.CADERA_IZQ,
  PUNTO.CADERA_DER,
] as const;

/**
 * Deriva el vector vertical personal [x, y, z] a partir de los worldLandmarks
 * en reposo.
 */
export function calibrarVectorArriba(
  worldLandmarks: readonly Landmark3D[],
  umbralVisibilidad: number,
): [number, number, number] | null {
  if (!worldLandmarks || worldLandmarks.length < 25) {
    return null;
  }

  if (!visiblePara(worldLandmarks, PUNTOS_CALIBRACION, umbralVisibilidad)) {
    return null;
  }

  const orejaIzq = worldLandmarks[PUNTO.OREJA_IZQ];
  const orejaDer = worldLandmarks[PUNTO.OREJA_DER];
  const hombroIzq = worldLandmarks[PUNTO.HOMBRO_IZQ];
  const hombroDer = worldLandmarks[PUNTO.HOMBRO_DER];
  const caderaIzq = worldLandmarks[PUNTO.CADERA_IZQ];
  const caderaDer = worldLandmarks[PUNTO.CADERA_DER];

  const medioOrejas = puntoMedioVec(orejaIzq, orejaDer);
  const medioHombros = puntoMedioVec(hombroIzq, hombroDer);
  const medioCaderas = puntoMedioVec(caderaIzq, caderaDer);

  // Vector columna: de caderas hacia hombros
  const vecColumna = restar(medioHombros, medioCaderas);
  // Vector cuello: de hombros hacia orejas
  const vecCuello = restar(medioOrejas, medioHombros);

  // Promedio ponderado (torso + cuello)
  const combinada = {
    x: vecColumna.x * 0.6 + vecCuello.x * 0.4,
    y: vecColumna.y * 0.6 + vecCuello.y * 0.4,
    z: vecColumna.z * 0.6 + vecCuello.z * 0.4,
  };

  const norm = normalizarVector(combinada);
  if (norm.x === 0 && norm.y === 0 && norm.z === 0) {
    return null;
  }

  return [norm.x, norm.y, norm.z];
}

export type PerspectivaCamara = "frente" | "lado" | "diagonal";

export const ANGULO_POR_PERSPECTIVA: Record<PerspectivaCamara, number> = {
  frente: 0,
  diagonal: 40,
  lado: 90,
} as const;

export const OPCIONES_PERSPECTIVA: readonly {
  id: PerspectivaCamara;
  etiqueta: string;
  descripcion: string;
}[] = [
  { id: "frente", etiqueta: "Al frente", descripcion: "Camara centrada frente a ti" },
  { id: "lado", etiqueta: "Al lado", descripcion: "Camara en posicion lateral" },
  { id: "diagonal", etiqueta: "En diagonal", descripcion: "Camara a un costado en angulo de 30 a 45 grados" },
] as const;

/**
 * Transforma los puntos 3D de la pose para compensar el angulo de la camara
 * segun la perspectiva seleccionada (frente, lado o diagonal).
 */
export function aplicarPerspectivaAPose(
  pose: FramePose,
  perspectiva: PerspectivaCamara,
): FramePose {
  const angulo = ANGULO_POR_PERSPECTIVA[perspectiva] ?? 0;
  if (angulo === 0 || !pose.worldLandmarks) {
    return pose;
  }

  // Rotamos en sentido inverso para devolver los puntos al sistema de referencia frontal del usuario
  const worldLandmarksTransformados = pose.worldLandmarks.map((p) => {
    const rotado = rotarY(p, -angulo);
    return {
      x: rotado.x,
      y: rotado.y,
      z: rotado.z,
      visibility: p.visibility,
    };
  });

  return {
    landmarks: pose.landmarks,
    worldLandmarks: worldLandmarksTransformados,
  };
}

