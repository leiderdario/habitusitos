/**
 * Motor central de simulacion y maquina de estados de la sesion.
 *
 * UNICA FUENTE DE VERDAD del estado reactivo de la postura:
 * - Corre un bucle a MUESTRAS_POR_SEGUNDO ticks (5 por defecto) derivando un
 *   puntaje que varia con realismo.
 * - Suaviza las metricas para que la UI no parpadee a 5 Hz.
 * - Alimenta la maquina de estados de alertas (RF-3: 20 s mala postura, 10 min
 *   enfriamiento, 50 min recordatorio de pausa).
 * - Actualiza el baseline adaptativo (aporte 1 de tesis).
 * - Expone el modo camara real: cuando esta activo, los landmarks entran por el
 *   mismo camino de calculo y sustituyen la muestra sintetica.
 * - Clasifica patrones posturales 3D con histeresis temporal (aporte 3).
 */

import { create } from "zustand";
import { config, UMBRALES_PATRON } from "@/config/app.config";
import type {
  ConfigAlertas,
  EstadoMaquina,
} from "@/dominio/maquina-estado";
import {
  avanzar,
  crearMaquina,
  PRESENTACION,
} from "@/dominio/maquina-estado";
import type {
  ConfigBaseline,
  EstadoBaseline,
} from "@/dominio/baseline-adaptativo";
import {
  actualizarBaseline,
  aplicarBaseline,
  crearBaseline,
} from "@/dominio/baseline-adaptativo";
import {
  aplicarPerspectivaAPose,
  calibrarVectorArriba,
  type PerspectivaCamara,
} from "@/dominio/perspectivas";
import type {
  ConfigClasificacion,
  EstadoClasificacion,
} from "@/dominio/clasificador-posturas";
import {
  avanzarClasificacion,
  clasificarPatron,
  DIAGNOSTICO_PATRON,
  ESTADO_CLASIFICACION_INICIAL,
} from "@/dominio/clasificador-posturas";
import { PUNTO } from "@/dominio/tipos";
import type {
  CalibracionPostural,
  FilaBaseline,
  FramePose,
  Landmark,
  MetricasDisponibilidad,
  MetricasPostura,
  MuestraPuntaje,
  PresentacionEstado,
} from "@/dominio/tipos";
import {
  ORDEN_METRICAS,
  calcularMetricasConDisponibilidad,
  calcularPuntaje,
} from "@/dominio/puntaje";
import type { Ajustes } from "@/datos/fixtures/ajustes";
import { AJUSTES_POR_DEFECTO } from "@/datos/fixtures/ajustes";
import { CALIBRACION_INICIAL } from "@/datos/fixtures/sesion";
import { obtenerSesionInicial } from "@/datos/api/sesion.api";
import {
  obtenerEstadoBaseline,
  obtenerHistorialBaseline,
} from "@/datos/api/baseline.api";
import { crearAleatorio, gaussiano } from "@/datos/semilla";

export interface Notificacion {
  id: number;
  titulo: string;
  cuerpo: string;
  /** Segundo de sesion en que se emitio. */
  t: number;
  tipo: "postura" | "pausa" | "sistema";
}

/** Un tramo del guion de un escenario de demostracion. */
interface TramoGuion {
  puntajeObjetivo: number;
  segundos: number;
}

export interface EstadoPersona {
  id: string; // "local" para el modo personal, o el desk_id/track_id en modo oficina
  pose: FramePose | null;
  puntaje: number;
  puntajeSuavizado: number;
  metricas: MetricasPostura;
  metricasAjustadas: MetricasPostura;
  aportes: MetricasPostura;
  disponibilidadMetricas?: MetricasDisponibilidad;
  maquina: EstadoMaquina;
  presentacion: PresentacionEstado;
  clasificacion: EstadoClasificacion;
}

export interface CamaraOficinaLocal {
  id: number | string;
  nombre: string;
  tipo?: string;
}

export type EstadoConexionVisionNode =
  | { tipo: "inactivo" }
  | { tipo: "conectando" }
  | { tipo: "conectado_sin_personas" }
  | { tipo: "conectado_con_personas"; cantidad: number }
  | { tipo: "desconectado"; motivo?: string };

interface EstadoSimulacion {
  listo: boolean;
  corriendo: boolean;
  modoCamara: boolean;

  /** Segundos monotonicos desde el inicio de la sesion. */
  t: number;
  muestras: MuestraPuntaje[];
  /** Puntaje crudo del ultimo frame. Alimenta el sparkline y el historial. */
  puntaje: number;
  /**
   * Puntaje filtrado con media movil exponencial. Es el que gobierna las
   * transiciones de la maquina y el medidor de aguja para que la interfaz no
   * parpadee en cada frame.
   */
  puntajeSuavizado: number;
  /** Metricas crudas del frame, antes de ajustar por baseline. */
  metricas: MetricasPostura;
  /** Metricas ya ajustadas contra el baseline personal. */
  metricasAjustadas: MetricasPostura;
  aportes: MetricasPostura;
  disponibilidadMetricas?: MetricasDisponibilidad;

  maquina: EstadoMaquina;
  presentacion: PresentacionEstado;
  baseline: EstadoBaseline;
  historialBaseline: FilaBaseline[];
  notificaciones: Notificacion[];

  /** Mapa de personas evaluadas simultaneamente (Paso 1 mejora.md: "local" o track_id). */
  personas: Map<string, EstadoPersona>;

  /** Estado de conexion con el servidor Vision Node (Paso 1 mejora.md feedback). */
  estadoConexionVisionNode: EstadoConexionVisionNode;
  actualizarConexionVisionNode(estado: EstadoConexionVisionNode): void;

  /** Fuentes de cámara detectadas en el servidor de oficina. */
  camarasOficinaDisponibles: CamaraOficinaLocal[];
  fuenteOficinaActual: number | string;
  actualizarFuentesOficina(fuenteActual: number | string, camarasDisponibles: CamaraOficinaLocal[]): void;

  ajustes: Ajustes;

  /** Perspectiva de camara activa (frente, lado, diagonal). */
  perspectiva: PerspectivaCamara;
  cambiarPerspectiva(perspectiva: PerspectivaCamara): void;

  /** Calibracion de la postura neutra del usuario (offsetZ + vectorArriba 3D). */
  calibracionPostural: CalibracionPostural;
  /** Estado del clasificador de patrones posturales con histeresis temporal. */
  clasificacion: EstadoClasificacion;

  /** Guion activo del escenario de demostracion, si hay uno. */
  guion: TramoGuion[] | null;
  guionIndice: number;
  guionRestante: number;
  escenarioActivo: string | null;

  cargar(): Promise<void>;
  iniciar(): void;
  detener(): void;
  alternar(): void;
  activarModoCamara(activo: boolean): void;
  /** Entrada del modo camara para persona especifica (aditivo para N personas). */
  empujarLandmarksDePersona(id: string, pose: FramePose | null): void;
  /** Entrada en lote atomica para N personas en modo oficina (evita re-renders en rafaga). */
  empujarLotePersonasOficina(personas: Array<{ track_id: number; keypoints: Landmark[] }>): void;
  /** Entrada del modo camara. Delega en empujarLandmarksDePersona("local", pose). */
  empujarLandmarks(pose: FramePose | null): void;
  aplicarAjustes(ajustes: Ajustes): void;
  ejecutarEscenario(id: string, tramos: TramoGuion[]): void;
  detenerEscenario(): void;
  descartarNotificacion(id: number): void;
  reiniciarSesion(): void;
  /** Marca la postura neutra actual: offsetZ y vector vertical 3D. */
  marcarPosturaNeutra(pose: FramePose | null): void;
  /** Borra la calibracion de la postura neutra. */
  limpiarCalibracionPostural(): void;
}


const DT = () => 1 / Math.max(1, config.MUESTRAS_POR_SEGUNDO);

const rnd = crearAleatorio(config.SEMILLA + 40);

/** Nivel objetivo de la simulacion, en [0,1]. Es el "hacia donde" del paseo. */
let objetivo = 0.86;
/** Nivel actual, que persigue al objetivo con inercia. */
let nivel = 0.86;
let temporizador: number | null = null;
let siguienteIdNotificacion = 1;

function configAlertas(ajustes: Ajustes): ConfigAlertas {
  return {
    umbralMalaPostura: ajustes.notificaciones.umbralMalaPostura,
    umbralBuenaPostura: config.UMBRAL_BUENA_POSTURA,
    umbralExcelente: config.UMBRAL_EXCELENTE,
    segundosSostenidos: ajustes.notificaciones.segundosSostenidos,
    segundosParaPausa: config.SEGUNDOS_PARA_PAUSA_AUTOMATICA,
    minutosEnfriamiento: ajustes.notificaciones.minutosEnfriamiento,
    modoEnfoque: ajustes.general.modoEnfoque,
  };
}

function configBaseline(ajustes: Ajustes): ConfigBaseline {
  return {
    activo: ajustes.baseline.activo,
    tauSegundos: ajustes.baseline.tauSegundos,
    pisoCalidad: ajustes.baseline.pisoCalidad,
    derivaMaxima: ajustes.baseline.derivaMaxima,
  };
}

/**
 * Deriva la postura simulada.
 */
function metricasDesdeNivel(n: number): MetricasPostura {
  const g = (desv: number) => gaussiano(0, desv, rnd);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const cabeza = clamp(n * 0.95 + 0.05 + g(0.02));
  const cuello = clamp(n * 0.9 + 0.1 + g(0.025));
  const hombrosNivel = clamp(0.9 + n * 0.08 + g(0.015));
  const hombrosRot = clamp(0.88 + n * 0.1 + g(0.02));
  const columna = clamp(n * 0.85 + 0.15 + g(0.03));
  const ladeo = clamp(0.94 + n * 0.05 + g(0.01));

  return {
    inclinacionCabeza: cabeza,
    cuelloVertical: cuello,
    nivelHombros: hombrosNivel,
    rotacionHombros: hombrosRot,
    alineacionColumna: columna,
    inclinacionLateralCabeza: ladeo,
  };
}

/**
 * Paseo aleatorio suave que simula la deriva de postura a lo largo del tiempo.
 */
function siguienteNivel(dt: number): number {
  if (rnd() < 0.03) {
    objetivo = 0.5 + rnd() * 0.45;
  }
  const factor = 1 - Math.exp(-dt / 6);
  nivel += (objetivo - nivel) * factor;
  return Math.min(1, Math.max(0, nivel));
}

const TEXTOS_ALERTA = [
  "Tu postura se esta encorvando. Intenta llevar los hombros suavemente hacia atras.",
  "La cabeza se esta adelantando respecto al torso. Acerca la pantalla o endereza el cuello.",
  "Llevas unos minutos con la espalda inclinada. Un buen momento para reajustar tu postura.",
];

/** Numero maximo de muestras que se conservan en memoria para el sparkline. */
const MAX_MUESTRAS = 3600;

export const useSimulacion = create<EstadoSimulacion>((set, get) => ({
  listo: false,
  corriendo: false,
  modoCamara: false,
  t: 0,
  muestras: [],
  puntaje: 0,
  puntajeSuavizado: 0,
  metricas: metricasDesdeNivel(0.86),
  metricasAjustadas: metricasDesdeNivel(0.86),
  aportes: metricasDesdeNivel(0.86),
  maquina: crearMaquina(),
  presentacion: PRESENTACION.buena,
  baseline: crearBaseline(CALIBRACION_INICIAL),
  historialBaseline: [],
  notificaciones: [],
  personas: new Map<string, EstadoPersona>(),
  estadoConexionVisionNode: { tipo: "inactivo" },
  actualizarConexionVisionNode(estado) {
    set({ estadoConexionVisionNode: estado });
  },
  camarasOficinaDisponibles: [],
  fuenteOficinaActual: 0,
  actualizarFuentesOficina(fuenteActual, camarasDisponibles) {
    set({ fuenteOficinaActual: fuenteActual, camarasOficinaDisponibles: camarasDisponibles });
  },
  ajustes: AJUSTES_POR_DEFECTO,
  perspectiva: "frente",
  cambiarPerspectiva(perspectiva) {
    set({ perspectiva });
  },
  calibracionPostural: { offsetZ: 0, vectorArriba: null },
  clasificacion: ESTADO_CLASIFICACION_INICIAL,
  guion: null,
  guionIndice: 0,
  guionRestante: 0,
  escenarioActivo: null,

  async cargar() {
    if (get().listo) return;
    const [sesion, baselineResumen, historial] = await Promise.all([
      obtenerSesionInicial(),
      obtenerEstadoBaseline(),
      obtenerHistorialBaseline(),
    ]);

    const metricasIniciales = metricasDesdeNivel(0.86);
    const resultado = calcularPuntaje(metricasIniciales, AJUSTES_POR_DEFECTO.deteccion.pesos);

    const personaLocalInicial: EstadoPersona = {
      id: "local",
      pose: null,
      puntaje: resultado.puntaje,
      puntajeSuavizado: resultado.puntaje,
      metricas: metricasIniciales,
      metricasAjustadas: metricasIniciales,
      aportes: resultado.aportes,
      maquina: crearMaquina(),
      presentacion: PRESENTACION.buena,
      clasificacion: ESTADO_CLASIFICACION_INICIAL,
    };

    set({
      listo: true,
      t: sesion.segundosTranscurridos,
      muestras: sesion.muestras,
      puntaje: resultado.puntaje,
      puntajeSuavizado: resultado.puntaje,
      metricas: metricasIniciales,
      metricasAjustadas: metricasIniciales,
      aportes: resultado.aportes,
      baseline: baselineResumen.estado,
      historialBaseline: historial,
      personas: new Map([["local", personaLocalInicial]]),
    });

    get().iniciar();
  },

  iniciar() {
    if (get().corriendo) return;
    set({ corriendo: true });

    const tick = () => {
      const s = get();
      if (!s.corriendo) return;

      if (s.modoCamara) {
        return;
      }

      const dt = DT();

      if (s.guion && s.guion.length > 0) {
        let guionRestante = s.guionRestante;
        let guionIndice = s.guionIndice;
        if (guionRestante <= 0) {
          guionIndice += 1;
          if (guionIndice >= s.guion.length) {
            set({ guion: null, guionIndice: 0, guionRestante: 0, escenarioActivo: null });
          } else {
            guionRestante = s.guion[guionIndice].segundos;
            objetivo = s.guion[guionIndice].puntajeObjetivo / 100;
          }
        }
        guionRestante -= dt;
        set({ guionIndice, guionRestante });
      }

      const metricas = metricasDesdeNivel(siguienteNivel(dt));
      procesarMuestra(metricas, dt, set, get);
    };

    temporizador = window.setInterval(tick, (1000 / config.MUESTRAS_POR_SEGUNDO));
  },

  detener() {
    if (temporizador !== null) {
      clearInterval(temporizador);
      temporizador = null;
    }
    set({ corriendo: false });
  },

  alternar() {
    if (get().corriendo) get().detener();
    else get().iniciar();
  },

  activarModoCamara(activo) {
    set({ modoCamara: activo });
  },

  empujarLandmarks(pose) {
    get().empujarLandmarksDePersona("local", pose);
  },

  empujarLandmarksDePersona(id, pose) {
    const s = get();
    if (!s.corriendo) return;
    const dt = DT();

    if (id === "local") {
      if (!pose || !pose.landmarks || pose.landmarks.length < 25) {
        const t = s.t + dt;
        const maquina = avanzar(s.maquina, null, t, configAlertas(s.ajustes));
        const pers = new Map(s.personas);
        pers.set("local", {
          id: "local",
          pose: null,
          puntaje: 0,
          puntajeSuavizado: 0,
          metricas: s.metricas,
          metricasAjustadas: s.metricasAjustadas,
          aportes: s.aportes,
          maquina: maquina.estado,
          presentacion: PRESENTACION[maquina.estado.estado],
          clasificacion: s.clasificacion,
        });
        set({
          t,
          muestras: [...s.muestras, { t, score: 0, detectado: false }].slice(-MAX_MUESTRAS),
          maquina: maquina.estado,
          presentacion: PRESENTACION[maquina.estado.estado],
          personas: pers,
        });
        return;
      }

      const poseTransformada = aplicarPerspectivaAPose(pose, s.perspectiva);

      const res = calcularMetricasConDisponibilidad(
        poseTransformada.landmarks,
        s.ajustes.deteccion.umbrales,
        s.calibracionPostural.offsetZ,
        s.calibracionPostural.vectorArriba ?? undefined,
        config.UMBRAL_VISIBILIDAD_LANDMARK,
        poseTransformada.worldLandmarks,
      );

      procesarMuestra(
        res.metricas,
        dt,
        set,
        get,
        poseTransformada,
        res.disponibilidad,
      );
    } else {
      // Entrada para personas en modo oficina (N personas)
      const pers = new Map(s.personas);
      if (!pose || !pose.landmarks || pose.landmarks.length < 25) {
        pers.delete(id);
        set({ personas: pers });
        return;
      }

      const res = calcularMetricasConDisponibilidad(
        pose.landmarks,
        s.ajustes.deteccion.umbrales,
        0,
        undefined,
        config.UMBRAL_VISIBILIDAD_LANDMARK,
        pose.worldLandmarks,
      );

      const resultado = calcularPuntaje(res.metricas, s.ajustes.deteccion.pesos, res.disponibilidad);
      const prev = s.personas.get(id);
      const maquinaPrev = prev ? prev.maquina : crearMaquina();
      const transicion = avanzar(maquinaPrev, resultado.puntaje, s.t, configAlertas(s.ajustes));
      const alpha = 0.2;
      const puntajeSuavizado = prev ? Math.round(prev.puntajeSuavizado * (1 - alpha) + resultado.puntaje * alpha) : resultado.puntaje;

      pers.set(id, {
        id,
        pose,
        puntaje: resultado.puntaje,
        puntajeSuavizado,
        metricas: res.metricas,
        metricasAjustadas: res.metricas,
        aportes: resultado.aportes,
        disponibilidadMetricas: res.disponibilidad,
        maquina: transicion.estado,
        presentacion: PRESENTACION[transicion.estado.estado],
        clasificacion: ESTADO_CLASIFICACION_INICIAL,
      });

      set({ personas: pers });
    }
  },

  empujarLotePersonasOficina(listaPersonas) {
    const s = get();
    if (!s.corriendo) return;

    const pers = new Map(s.personas);
    const activeIds = new Set(listaPersonas.map((p) => `persona_${p.track_id}`));

    // Descartar personas que ya no aparecen en el encuadre
    for (const [id] of pers) {
      if (id !== "local" && !activeIds.has(id)) {
        pers.delete(id);
      }
    }

    const umbralVis = config.UMBRAL_VISIBILIDAD_LANDMARK;
    const pesos = s.ajustes.deteccion.pesos;
    const umbrales = s.ajustes.deteccion.umbrales;
    const cfgAlertas = configAlertas(s.ajustes);

    for (const p of listaPersonas) {
      const id = `persona_${p.track_id}`;
      const kpts = p.keypoints;
      if (!kpts || kpts.length < 25) {
        pers.delete(id);
        continue;
      }

      const pose: FramePose = {
        landmarks: kpts,
        worldLandmarks: kpts,
      };

      const res = calcularMetricasConDisponibilidad(
        kpts,
        umbrales,
        0,
        undefined,
        umbralVis,
        kpts,
      );

      const resultado = calcularPuntaje(res.metricas, pesos, res.disponibilidad);
      const prev = s.personas.get(id);
      const maquinaPrev = prev ? prev.maquina : crearMaquina();
      const transicion = avanzar(maquinaPrev, resultado.puntaje, s.t, cfgAlertas);
      const alpha = 0.25;
      const puntajeSuavizado = prev
        ? Math.round(prev.puntajeSuavizado * (1 - alpha) + resultado.puntaje * alpha)
        : resultado.puntaje;

      pers.set(id, {
        id,
        pose,
        puntaje: resultado.puntaje,
        puntajeSuavizado,
        metricas: res.metricas,
        metricasAjustadas: res.metricas,
        aportes: resultado.aportes,
        disponibilidadMetricas: res.disponibilidad,
        maquina: transicion.estado,
        presentacion: PRESENTACION[transicion.estado.estado],
        clasificacion: ESTADO_CLASIFICACION_INICIAL,
      });
    }

    set({ personas: pers });
  },


  marcarPosturaNeutra(pose) {
    if (!pose || !pose.landmarks) return;
    const s = get();
    const poseTransformada = aplicarPerspectivaAPose(pose, s.perspectiva);
    const nariz = poseTransformada.landmarks[PUNTO.NARIZ];
    const orejaIzq = poseTransformada.landmarks[PUNTO.OREJA_IZQ];
    const orejaDer = poseTransformada.landmarks[PUNTO.OREJA_DER];
    if (!nariz || !orejaIzq || !orejaDer) return;
    const medioOrejasZ = (orejaIzq.z + orejaDer.z) / 2;
    const offsetZ = Math.abs(nariz.z - medioOrejasZ);

    const vectorArriba = poseTransformada.worldLandmarks
      ? calibrarVectorArriba(poseTransformada.worldLandmarks, config.UMBRAL_VISIBILIDAD_LANDMARK)
      : null;

    set({ calibracionPostural: { offsetZ, vectorArriba } });
  },

  limpiarCalibracionPostural() {
    set({ calibracionPostural: { offsetZ: 0, vectorArriba: null } });
  },

  aplicarAjustes(ajustes) {
    set({ ajustes });
  },

  ejecutarEscenario(id, tramos) {
    if (tramos.length === 0) return;
    objetivo = tramos[0].puntajeObjetivo / 100;
    set({
      guion: tramos,
      guionIndice: 0,
      guionRestante: tramos[0].segundos,
      escenarioActivo: id,
      modoCamara: false,
    });
    get().iniciar();
  },

  detenerEscenario() {
    set({ guion: null, guionIndice: 0, guionRestante: 0, escenarioActivo: null });
  },

  descartarNotificacion(id) {
    set({ notificaciones: get().notificaciones.filter((n) => n.id !== id) });
  },

  reiniciarSesion() {
    get().detener();
    nivel = 0.86;
    objetivo = 0.86;
    set({
      t: 0,
      muestras: [],
      notificaciones: [],
      maquina: crearMaquina(),
      presentacion: PRESENTACION.buena,
      historialBaseline: [],
      guion: null,
      escenarioActivo: null,
      calibracionPostural: { offsetZ: 0, vectorArriba: null },
      clasificacion: ESTADO_CLASIFICACION_INICIAL,
    });
    get().iniciar();
  },
}));

function procesarMuestra(
  metricas: MetricasPostura,
  dt: number,
  set: (parcial: Partial<EstadoSimulacion>) => void,
  get: () => EstadoSimulacion,
  pose?: FramePose,
  disponibilidad?: MetricasDisponibilidad,
) {
  const s = get();
  const t = s.t + dt;
  const cfgAlertas = configAlertas(s.ajustes);
  const cfgBaseline = configBaseline(s.ajustes);

  const metricasAjustadas = cfgBaseline.activo
    ? aplicarBaseline(metricas, s.baseline.valores)
    : metricas;

  const resultado = calcularPuntaje(metricasAjustadas, s.ajustes.deteccion.pesos, disponibilidad);

  const alphaVista = 1 - Math.exp(-dt / 4);
  const arranque = s.puntajeSuavizado === 0;
  const metricasVista = {} as MetricasPostura;
  for (const nombre of ORDEN_METRICAS) {
    metricasVista[nombre] = arranque
      ? metricasAjustadas[nombre]
      : s.metricasAjustadas[nombre] +
        alphaVista * (metricasAjustadas[nombre] - s.metricasAjustadas[nombre]);
  }
  const resultadoVista = calcularPuntaje(metricasVista, s.ajustes.deteccion.pesos, disponibilidad);

  const transicion = avanzar(s.maquina, resultadoVista.puntaje, t, cfgAlertas);

  const actualizacion = cfgBaseline.activo
    ? actualizarBaseline(
        s.baseline,
        metricas,
        resultado.puntaje,
        transicion.estado.estado,
        dt,
        cfgBaseline,
      )
    : null;

  let nuevaClasificacion = s.clasificacion;
  if (pose && s.ajustes.deteccion.clasificacionPatronesActiva) {
    const cfgClasificacion: ConfigClasificacion = {
      segundosSostenidos: config.SEGUNDOS_SOSTENIDOS_PATRON,
      umbralVisibilidad: config.UMBRAL_VISIBILIDAD_LANDMARK,
      umbrales: { ...UMBRALES_PATRON },
    };
    const candidato = clasificarPatron(
      pose,
      metricas,
      s.calibracionPostural.vectorArriba,
      cfgClasificacion,
    );
    nuevaClasificacion = avanzarClasificacion(
      s.clasificacion,
      candidato,
      t,
      cfgClasificacion,
    );
  }

  const notificaciones = [...s.notificaciones];
  if (transicion.emitirNotificacion) {
    let cuerpoMensaje = TEXTOS_ALERTA[siguienteIdNotificacion % TEXTOS_ALERTA.length];
    if (
      nuevaClasificacion.patronMostrado !== "sin_datos" &&
      nuevaClasificacion.patronMostrado !== "postura_desconocida" &&
      nuevaClasificacion.patronMostrado !== "optima"
    ) {
      cuerpoMensaje = DIAGNOSTICO_PATRON[nuevaClasificacion.patronMostrado];
    }

    notificaciones.push({
      id: siguienteIdNotificacion++,
      titulo: "Habitusitos",
      cuerpo: cuerpoMensaje,
      t,
      tipo: "postura",
    });
  }

  const historialBaseline = s.historialBaseline;
  const nuevaFila =
    actualizacion && Math.floor(t) % 10 === 0 && Math.floor(t) !== Math.floor(s.t)
      ? [
          ...historialBaseline,
          {
            timestamp: new Date(config.ANCLA_UTC + t * 1000).toISOString(),
            metric_name: "cuelloVertical" as const,
            baseline_value: actualizacion.estado.valores.cuelloVertical,
            sample_value: metricas.cuelloVertical,
            accepted: actualizacion.aceptada,
            motivo: actualizacion.motivo,
          },
        ].slice(-600)
      : historialBaseline;

  const pers = new Map(s.personas);
  pers.set("local", {
    id: "local",
    pose: pose ?? null,
    puntaje: resultado.puntaje,
    puntajeSuavizado: resultadoVista.puntaje,
    metricas,
    metricasAjustadas: metricasVista,
    aportes: resultadoVista.aportes,
    disponibilidadMetricas: disponibilidad,
    maquina: transicion.estado,
    presentacion: PRESENTACION[transicion.estado.estado],
    clasificacion: nuevaClasificacion,
  });

  set({
    t,
    puntaje: resultado.puntaje,
    puntajeSuavizado: resultadoVista.puntaje,
    metricas,
    metricasAjustadas: metricasVista,
    aportes: resultadoVista.aportes,
    disponibilidadMetricas: disponibilidad,
    muestras: [
      ...s.muestras,
      { t, score: resultado.puntaje, detectado: true },
    ].slice(-MAX_MUESTRAS),
    maquina: transicion.estado,
    presentacion: PRESENTACION[transicion.estado.estado],
    baseline: actualizacion ? actualizacion.estado : s.baseline,
    historialBaseline: nuevaFila,
    clasificacion: nuevaClasificacion,
    notificaciones: notificaciones.slice(-4),
    personas: pers,
  });
}

