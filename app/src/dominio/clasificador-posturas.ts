/**
 * Clasificador de patrones posturales en 3D con histeresis temporal.
 *
 * UNICA FUENTE DE CLASIFICACION POSTURAL.
 * CERO dependencias externas: logica pura sobre vectores y metricas.
 *
 * Sigue el patron de maquina-estado.ts:
 *  - clasificarPatron: pura, un frame, sin memoria.
 *  - avanzarClasificacion: con histeresis temporal basada en tiempo monotonico.
 */

import type {
  FramePose,
  MetricasPostura,
  PatronPostural,
  ResultadoClasificacion,
} from "./tipos";
import { PUNTO } from "./tipos";
import {
  anguloConVertical,
  distanciaMetros,
  puntoMedioVec,
  rotacionCabeza3D,
  visiblePara,
} from "./geometria-3d";

export interface UmbralesClasificacion {
  cuelloAdelantadoGrados: number;
  encorvamientoGrados: number;
  reclinacionGrados: number;
  torsionGrados: number;
  ladeoGrados: number;
  distanciaCodoCabezaMetros: number;
}

export interface ConfigClasificacion {
  segundosSostenidos: number;
  umbralVisibilidad: number;
  umbrales: UmbralesClasificacion;
}

export interface EstadoClasificacion {
  patronMostrado: PatronPostural;
  candidato: PatronPostural | null;
  candidatoDesde: number | null;
}

export const ESTADO_CLASIFICACION_INICIAL: EstadoClasificacion = {
  patronMostrado: "sin_datos",
  candidato: null,
  candidatoDesde: null,
};

const PUNTOS_BASE = [
  PUNTO.NARIZ,
  PUNTO.OREJA_IZQ,
  PUNTO.OREJA_DER,
  PUNTO.HOMBRO_IZQ,
  PUNTO.HOMBRO_DER,
] as const;

/**
 * Textos en lenguaje llano, sin jerga tecnica (cumple CLAUDE.md y la regla de no jerga).
 */
export const DIAGNOSTICO_PATRON: Record<PatronPostural, string> = {
  optima: "Tu postura esta bien alineada.",
  cuello_adelantado: "Tienes la cabeza inclinada hacia adelante.",
  encorvamiento_toracico: "Tu espalda esta encorvada hacia la pantalla.",
  reclinacion_excesiva: "Estas demasiado reclinado hacia atras.",
  apoyo_asimetrico_codo: "Estas recostando el peso sobre un brazo o codo.",
  torsion_lateral: "Tienes el torso o la cabeza girados hacia un lado.",
  cabeza_ladeada: "Tienes la cabeza ladeada hacia un hombro.",
  postura_desconocida: "No se pudo ver bien tu postura en este momento.",
  sin_datos: "Sin medicion activa de camara.",
};

export const ETIQUETA_PATRON: Record<PatronPostural, string> = {
  optima: "Postura alineada",
  cuello_adelantado: "Cabeza adelantada",
  encorvamiento_toracico: "Espalda encorvada",
  reclinacion_excesiva: "Reclinacion excesiva",
  apoyo_asimetrico_codo: "Apoyo en codo o brazo",
  torsion_lateral: "Torso o cabeza girada",
  cabeza_ladeada: "Cabeza ladeada",
  postura_desconocida: "Postura no identificada",
  sin_datos: "Sin datos",
};

/**
 * Evalua un unico frame de forma pura e instantanea.
 */
export function clasificarPatron(
  pose: FramePose | null,
  metricas: MetricasPostura,
  vectorArriba: [number, number, number] | null,
  cfg: ConfigClasificacion,
): ResultadoClasificacion {
  if (!pose || !pose.landmarks || pose.landmarks.length < 25) {
    return {
      patronPrincipal: "postura_desconocida",
      patronesSecundarios: [],
      diagnosticoPrincipal: DIAGNOSTICO_PATRON.postura_desconocida,
      confianza: 0,
      anguloCervical3D: null,
      anguloEspalda3D: null,
      rotacionCabeza3D: null,
    };
  }

  // Sin worldLandmarks reales no inventamos datos metricos 3D
  if (!pose.worldLandmarks || pose.worldLandmarks.length < 25) {
    return {
      patronPrincipal: "postura_desconocida",
      patronesSecundarios: [],
      diagnosticoPrincipal: DIAGNOSTICO_PATRON.postura_desconocida,
      confianza: 0.3,
      anguloCervical3D: null,
      anguloEspalda3D: null,
      rotacionCabeza3D: null,
    };
  }

  const wl = pose.worldLandmarks;
  if (!visiblePara(wl, PUNTOS_BASE, cfg.umbralVisibilidad)) {
    return {
      patronPrincipal: "postura_desconocida",
      patronesSecundarios: [],
      diagnosticoPrincipal: DIAGNOSTICO_PATRON.postura_desconocida,
      confianza: 0.2,
      anguloCervical3D: null,
      anguloEspalda3D: null,
      rotacionCabeza3D: null,
    };
  }

  const orejaIzq = wl[PUNTO.OREJA_IZQ];
  const orejaDer = wl[PUNTO.OREJA_DER];
  const hombroIzq = wl[PUNTO.HOMBRO_IZQ];
  const hombroDer = wl[PUNTO.HOMBRO_DER];
  const caderaIzq = wl[PUNTO.CADERA_IZQ];
  const caderaDer = wl[PUNTO.CADERA_DER];
  const codoIzq = wl[PUNTO.CODO_IZQ];
  const codoDer = wl[PUNTO.CODO_DER];
  const munecaIzq = wl[PUNTO.MUNECA_IZQ];
  const munecaDer = wl[PUNTO.MUNECA_DER];

  const centroCuello = puntoMedioVec(hombroIzq, hombroDer);
  const centroCabeza = puntoMedioVec(orejaIzq, orejaDer);
  const medioCaderas = puntoMedioVec(caderaIzq, caderaDer);

  const verticalRef = vectorArriba ?? [0, -1, 0];

  const anguloCervical3D = anguloConVertical(centroCuello, centroCabeza, verticalRef);
  const anguloEspalda3D = anguloConVertical(medioCaderas, centroCuello, verticalRef);
  const rotacion = rotacionCabeza3D(wl, vectorArriba);

  const patronesDetectados: { patron: PatronPostural; severidad: number }[] = [];

  // 1. Cuello adelantado (text-neck): evaluado biomecanicamente en 3D
  const esCabezaAdelantada =
    anguloCervical3D > cfg.umbrales.cuelloAdelantadoGrados ||
    (rotacion !== null && rotacion.pitch > cfg.umbrales.cuelloAdelantadoGrados * 0.7) ||
    metricas.inclinacionCabeza < 0.6;
  if (esCabezaAdelantada) {
    const severidad = Math.max(
      anguloCervical3D / cfg.umbrales.cuelloAdelantadoGrados,
      rotacion ? rotacion.pitch / (cfg.umbrales.cuelloAdelantadoGrados * 0.7) : 1,
      1 - metricas.inclinacionCabeza,
    );
    patronesDetectados.push({ patron: "cuello_adelantado", severidad });
  }

  // 2. Encorvamiento toracico vs Reclinacion excesiva
  // En MediaPipe Z negativo = mas cerca de camara. Si hombros se van adelante respecto a caderas
  const dzEspalda = centroCuello.z - medioCaderas.z;
  if (anguloEspalda3D > cfg.umbrales.encorvamientoGrados && dzEspalda < 0) {
    patronesDetectados.push({
      patron: "encorvamiento_toracico",
      severidad: anguloEspalda3D / cfg.umbrales.encorvamientoGrados,
    });
  } else if (anguloEspalda3D > cfg.umbrales.reclinacionGrados && dzEspalda > 0) {
    patronesDetectados.push({
      patron: "reclinacion_excesiva",
      severidad: anguloEspalda3D / cfg.umbrales.reclinacionGrados,
    });
  }

  // 3. Apoyo asimetrico en brazo o codo
  if (codoIzq && codoDer && munecaIzq && munecaDer) {
    const distManoIzqCabeza = distanciaMetros(munecaIzq, centroCabeza);
    const distManoDerCabeza = distanciaMetros(munecaDer, centroCabeza);
    const desnivelHombros = Math.abs(hombroIzq.y - hombroDer.y);

    const apoyoIzq =
      distManoIzqCabeza < cfg.umbrales.distanciaCodoCabezaMetros &&
      distManoDerCabeza > cfg.umbrales.distanciaCodoCabezaMetros * 1.5;
    const apoyoDer =
      distManoDerCabeza < cfg.umbrales.distanciaCodoCabezaMetros &&
      distManoIzqCabeza > cfg.umbrales.distanciaCodoCabezaMetros * 1.5;

    if ((apoyoIzq || apoyoDer) && desnivelHombros > 0.03) {
      patronesDetectados.push({
        patron: "apoyo_asimetrico_codo",
        severidad: 1.5,
      });
    }
  }

  // 4. Torsion lateral (cabeza o torso girado)
  const rotacionYaw = rotacion ? Math.abs(rotacion.yaw) : 0;
  if (rotacionYaw > cfg.umbrales.torsionGrados || metricas.rotacionHombros < 0.6) {
    patronesDetectados.push({
      patron: "torsion_lateral",
      severidad: Math.max(rotacionYaw / cfg.umbrales.torsionGrados, 1 - metricas.rotacionHombros),
    });
  }

  // 5. Cabeza ladeada hacia un hombro
  const rotacionRoll = rotacion ? Math.abs(rotacion.roll) : 0;
  if (rotacionRoll > cfg.umbrales.ladeoGrados || metricas.inclinacionLateralCabeza < 0.65) {
    patronesDetectados.push({
      patron: "cabeza_ladeada",
      severidad: Math.max(
        rotacionRoll / cfg.umbrales.ladeoGrados,
        1 - metricas.inclinacionLateralCabeza,
      ),
    });
  }

  // Ordenar por severidad descendente
  patronesDetectados.sort((a, b) => b.severidad - a.severidad);

  const patronPrincipal: PatronPostural =
    patronesDetectados.length > 0 ? patronesDetectados[0].patron : "optima";

  const patronesSecundarios: PatronPostural[] = patronesDetectados
    .slice(1)
    .map((p) => p.patron);

  return {
    patronPrincipal,
    patronesSecundarios,
    diagnosticoPrincipal: DIAGNOSTICO_PATRON[patronPrincipal],
    confianza: 0.9,
    anguloCervical3D: Number.isFinite(anguloCervical3D) ? anguloCervical3D : null,
    anguloEspalda3D: Number.isFinite(anguloEspalda3D) ? anguloEspalda3D : null,
    rotacionCabeza3D: rotacion,
  };
}

/**
 * Avanza la clasificacion aplicando histeresis temporal.
 * Evita saltos y parpadeos en pantalla ante ruido frame a frame.
 */
export function avanzarClasificacion(
  estado: EstadoClasificacion,
  candidato: ResultadoClasificacion,
  ahora: number,
  cfg: ConfigClasificacion,
): EstadoClasificacion {
  const nuevoPatron = candidato.patronPrincipal;

  // Si el candidato es sin_datos o postura_desconocida inmediata
  if (nuevoPatron === "sin_datos") {
    return {
      patronMostrado: "sin_datos",
      candidato: null,
      candidatoDesde: null,
    };
  }

  // Si el candidato es exactamente el que ya se esta mostrando
  if (nuevoPatron === estado.patronMostrado) {
    return {
      patronMostrado: estado.patronMostrado,
      candidato: null,
      candidatoDesde: null,
    };
  }

  // Si el candidato actual cambia respecto al candidato en espera
  if (nuevoPatron !== estado.candidato) {
    return {
      patronMostrado: estado.patronMostrado,
      candidato: nuevoPatron,
      candidatoDesde: ahora,
    };
  }

  // El candidato sigue siendo el mismo y esta en espera: verificamos duracion
  const tiempoSostenido = estado.candidatoDesde !== null ? ahora - estado.candidatoDesde : 0;
  if (tiempoSostenido >= cfg.segundosSostenidos) {
    return {
      patronMostrado: nuevoPatron,
      candidato: null,
      candidatoDesde: null,
    };
  }

  return estado;
}
