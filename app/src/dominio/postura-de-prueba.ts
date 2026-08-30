/**
 * Fabricas de esqueletos para pruebas y para el modo simulado.
 *
 * Construye conjuntos de 33 landmarks con geometria controlada, de forma que
 * tanto los tests como el generador de datos simulados partan de la MISMA
 * definicion de "postura perfecta". Si esto viviera duplicado, el test podria
 * pasar contra una geometria que la simulacion nunca produce.
 *
 * Vive en `dominio/` y no en `datos/` porque es geometria pura: no depende de la
 * semilla, del almacen ni de nada de React.
 */

import type { Landmark, MetricasPostura } from "./tipos";
import { PUNTO } from "./tipos";

/** Cuanto se desvia una postura de la ideal, por eje. Todo en 0 = perfecta. */
export interface DesviacionPostural {
  /** Cabeza adelantada: nariz mas cerca de la camara que las orejas. */
  cabezaAdelante: number;
  /** Cuello inclinado hacia adelante, en grados. */
  cuelloGrados: number;
  /** Un hombro mas alto que el otro. */
  desnivelHombros: number;
  /** Torso girado: diferencia de profundidad entre hombros. */
  giroTorso: number;
  /** Espalda encorvada hacia adelante, en grados. */
  columnaGrados: number;
  /** Cabeza girada a un lado, como fraccion de la distancia ideal entre orejas. */
  giroCabeza: number;
  /** Cabeza ladeada hacia un hombro. */
  ladeoCabeza: number;
}

export const SIN_DESVIACION: DesviacionPostural = {
  cabezaAdelante: 0,
  cuelloGrados: 0,
  desnivelHombros: 0,
  giroTorso: 0,
  columnaGrados: 0,
  giroCabeza: 0,
  ladeoCabeza: 0,
};

const gradosARadianes = (g: number) => (g * Math.PI) / 180;

const punto = (x: number, y: number, z: number): Landmark => ({
  x,
  y,
  z,
  visibility: 0.98,
});

/**
 * Semi-separacion (dx, dy) de un par de puntos separados por `distancia` y
 * ladeados `desnivel` en vertical, CONSERVANDO la distancia entre ellos.
 *
 * Es una rotacion, no una cizalla: `hypot(2*dx, 2*dy) === distancia`.
 */
function separacionRotada(distancia: number, desnivel: number): [number, number] {
  const dy = desnivel / 2;
  const mitad = distancia / 2;
  // Un desnivel mayor que la propia separacion no es una postura, es un error
  // de deteccion. Se satura en vertical en vez de producir un dx imaginario.
  const dx = Math.sqrt(Math.max(0, mitad * mitad - dy * dy));
  return [dx, dy];
}

/** Ancho de hombros de referencia, en coordenadas normalizadas del frame. */
const ANCHO_HOMBROS = 0.18;
/** Debe coincidir con PROPORCION_OREJAS_HOMBROS de puntaje.ts. */
const DISTANCIA_OREJAS_IDEAL = ANCHO_HOMBROS * 0.7;
const LARGO_CUELLO = 0.18;
const LARGO_TORSO = 0.3;

/**
 * Construye los 33 landmarks de una persona sentada con la desviacion indicada.
 *
 * Solo se rellenan con geometria real los siete puntos que usa el calculo de
 * postura; el resto se deja en el centro del frame porque nada los lee. Es
 * deliberado: rellenarlos con valores inventados sugeriria una precision
 * anatomica que este generador no tiene.
 */
export function construirEsqueleto(d: DesviacionPostural): Landmark[] {
  const puntos: Landmark[] = Array.from({ length: 33 }, () => punto(0.5, 0.5, 0));

  // Caderas: origen del torso.
  const caderaY = 0.78;
  puntos[PUNTO.CADERA_IZQ] = punto(0.5 - ANCHO_HOMBROS / 2, caderaY, 0);
  puntos[PUNTO.CADERA_DER] = punto(0.5 + ANCHO_HOMBROS / 2, caderaY, 0);

  // Hombros: el torso se inclina `columnaGrados` hacia adelante (eje Z).
  const incColumna = gradosARadianes(d.columnaGrados);
  const hombroCentroY = caderaY - LARGO_TORSO * Math.cos(incColumna);
  const hombroCentroZ = -LARGO_TORSO * Math.sin(incColumna);
  // El desnivel se modela como ROTACION del eje de los hombros, no como una
  // cizalla vertical: al ladear los hombros la distancia entre ellos no cambia,
  // solo su orientacion. Un generador que los desplazara en Y dejando la X fija
  // estaria alargando el cuerpo, y contaminaria la metrica 6 con un artefacto
  // del generador en vez de con un hecho anatomico.
  const [hombroDx, hombroDy] = separacionRotada(ANCHO_HOMBROS, d.desnivelHombros);
  puntos[PUNTO.HOMBRO_IZQ] = punto(
    0.5 - hombroDx,
    hombroCentroY - hombroDy,
    hombroCentroZ - d.giroTorso / 2,
  );
  puntos[PUNTO.HOMBRO_DER] = punto(
    0.5 + hombroDx,
    hombroCentroY + hombroDy,
    hombroCentroZ + d.giroTorso / 2,
  );

  // Orejas: el cuello se inclina `cuelloGrados` hacia adelante desde los hombros.
  const incCuello = gradosARadianes(d.cuelloGrados);
  const orejaCentroY = hombroCentroY - LARGO_CUELLO * Math.cos(incCuello);
  const orejaCentroZ = hombroCentroZ - LARGO_CUELLO * Math.sin(incCuello);
  // El giro de la cabeza SI acorta la distancia entre orejas (se proyectan mas
  // juntas); el ladeo NO la cambia, solo la rota. Se modelan por separado.
  const distanciaOrejas = DISTANCIA_OREJAS_IDEAL * (1 - d.giroCabeza);
  const [orejaDx, orejaDy] = separacionRotada(distanciaOrejas, d.ladeoCabeza);
  puntos[PUNTO.OREJA_IZQ] = punto(0.5 - orejaDx, orejaCentroY - orejaDy, orejaCentroZ);
  puntos[PUNTO.OREJA_DER] = punto(0.5 + orejaDx, orejaCentroY + orejaDy, orejaCentroZ);

  // Nariz: por delante del punto medio de las orejas segun `cabezaAdelante`.
  puntos[PUNTO.NARIZ] = punto(0.5, orejaCentroY + 0.02, orejaCentroZ - d.cabezaAdelante);

  return puntos;
}

/** Postura ideal de laboratorio: todas las metricas en 1.0. */
export const POSTURA_PERFECTA = construirEsqueleto(SIN_DESVIACION);

/** Encorvado tipico frente al computador: cabeza adelantada y espalda curva. */
export const POSTURA_ENCORVADA = construirEsqueleto({
  ...SIN_DESVIACION,
  cabezaAdelante: 0.16,
  cuelloGrados: 26,
  columnaGrados: 16,
});

/** Ladeado sobre un codo: hombros desnivelados y cabeza inclinada. */
export const POSTURA_LADEADA = construirEsqueleto({
  ...SIN_DESVIACION,
  desnivelHombros: 0.045,
  ladeoCabeza: 0.035,
  giroTorso: 0.07,
});

/** Todas las metricas en el valor dado. Util para tests de baseline. */
export function metricasUniformes(valor: number): MetricasPostura {
  return {
    inclinacionCabeza: valor,
    cuelloVertical: valor,
    nivelHombros: valor,
    rotacionHombros: valor,
    alineacionColumna: valor,
    rotacionCabeza: valor,
    inclinacionLateralCabeza: valor,
  };
}
