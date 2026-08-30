/**
 * Configuracion unica de la aplicacion.
 *
 * FUENTE UNICA DE VERDAD de umbrales, limites, banderas y textos legales. Si un
 * numero aparece en dos sitios, uno de los dos esta mal. Ningun componente
 * define su propio umbral.
 *
 * Los valores marcados con "PENDIENTE" son decisiones que el prompt maestro deja
 * abiertas a proposito (seccion 8.2: "el valor exacto se fija con datos reales
 * del benchmark de la Fase 4, no se inventa a priori"). El mock usa un valor
 * defendible por defecto y lo declara como provisional, en vez de fingir que ya
 * esta decidido.
 */

export const config = {
  // --- Puntuacion de postura (prompt maestro seccion 4.8) ---
  /** Score por debajo del cual puede dispararse una alerta. */
  UMBRAL_MALA_POSTURA: 60,
  /** Score minimo para que cuente como racha de buena postura. */
  UMBRAL_BUENA_POSTURA: 65,
  /** Score minimo para considerar el estado "excelente" en la UI. */
  UMBRAL_EXCELENTE: 82,

  // --- Notificaciones (seccion 7, RF-3) ---
  /** Segundos de mala postura sostenida antes de notificar. Evita el falso
   *  positivo por agacharse a recoger algo. */
  SEGUNDOS_MALA_POSTURA_SOSTENIDA: 20,
  /** Minutos de silencio forzado tras una notificacion. */
  MINUTOS_ENFRIAMIENTO: 10,
  /** Minutos de sesion continua antes del recordatorio de pausa. */
  MINUTOS_RECORDATORIO_PAUSA: 50,

  // --- Sesion y deteccion ---
  /** Segundos sin detectar persona antes de pausar la sesion automaticamente. */
  SEGUNDOS_PARA_PAUSA_AUTOMATICA: 2,
  /** Duracion de la calibracion inicial. Constante nombrada en el fork. */
  SEGUNDOS_CALIBRACION: 6,
  /** Muestras por segundo del pipeline. NO es el FPS nativo de la camara:
   *  el muestreo de frames es la optimizacion principal (seccion 8.2). */
  MUESTRAS_POR_SEGUNDO: 5,
  /** Visibilidad minima para que un punto se dibuje o se use en clasificacion.
   *  Antes vivia hardcodeado en vista-camara.tsx; una sola fuente ahora. */
  UMBRAL_VISIBILIDAD_LANDMARK: 0.4,
  /** Segundos que un patron candidato debe sostenerse antes de reemplazar el
   *  patron mostrado. Evita parpadeo por ruido de landmarks. */
  SEGUNDOS_SOSTENIDOS_PATRON: 3,

  // --- Baseline adaptativo (aporte 1 de tesis, seccion 11.1) ---
  /** Constante de tiempo del EMA, en SEGUNDOS. alpha se deriva de aqui y del
   *  intervalo real de muestreo — nunca al reves. Si alpha se fija por frame, el
   *  baseline se adapta 2.5x mas lento en un portatil a 12 FPS que en uno a 30. */
  BASELINE_TAU_SEGUNDOS: 480,
  /** Score minimo para que una muestra entre al EMA (salvaguarda 1). */
  BASELINE_PISO_CALIDAD: 65,
  /** Desviacion maxima permitida respecto al optimo ergonomico (salvaguarda 3),
   *  en unidades normalizadas de metrica [0,1]. */
  BASELINE_DERIVA_MAXIMA: 0.18,

  // --- Benchmark de recursos (aporte 2, seccion 11.2) ---
  /** Segundos de calentamiento que se descartan de cada corrida. Sin esto, las
   *  primeras muestras incluyen el import de numpy/OpenCV y la carga del modelo. */
  BENCHMARK_CALENTAMIENTO_SEGUNDOS: 15,
  /** Intervalo de muestreo del benchmark. */
  BENCHMARK_INTERVALO_SEGUNDOS: 1,

  // --- Comportamiento del mock ---
  /** Latencia artificial de la capa de datos. Sin ella la demostracion se siente
   *  falsa: nada tarda nunca. */
  LATENCIA_MOCK_MS: { min: 180, max: 460 },
  /** Semilla del generador pseudoaleatorio. Fija a proposito: dos demostraciones
   *  consecutivas tienen que verse identicas. */
  SEMILLA: 20260731,
  /** Fecha ancla del historial simulado. Todo se genera hacia atras desde aqui,
   *  en UTC. Nunca se usa la fecha del sistema para generar datos. */
  ANCLA_UTC: Date.UTC(2026, 6, 31, 21, 0, 0),
  /** Dias de historial simulado que alimentan el mapa de calor. */
  DIAS_HISTORIAL: 98,
  /** Clave de persistencia en localStorage. Subir la version invalida el estado. */
  CLAVE_ALMACENAMIENTO: "habitusitos_demo_v1",

  // --- Presentacion ---
  LOCALE: "es-CO",
  TZ_PRESENTACION: "America/Bogota",
  PAIS_FESTIVOS: "CO",
} as const;

/**
 * Pesos por defecto de las seis metricas geometricas.
 * El orden importa y coincide con `ORDEN_METRICAS` en dominio/puntaje.ts.
 */
export const PESOS_POR_DEFECTO = [0.25, 0.25, 0.15, 0.15, 0.15, 0.05] as const;

/**
 * Umbrales de sensibilidad de cada metrica: el valor de desviacion en el que la
 * metrica cae a 0.
 *
 * PENDIENTE — estos numeros son un punto de partida razonado, no un resultado
 * medido. El prompt maestro (seccion 8.2) exige fijarlos con datos reales. El
 * software real debe recalibrarlos con la muestra de 15-70 participantes y
 * documentar el procedimiento.
 */
export const UMBRALES_POR_DEFECTO = {
  inclinacionCabeza: 2.5,
  cuelloVertical: 35,
  nivelHombros: 0.06,
  rotacionHombros: 0.12,
  alineacionColumna: 30,
  inclinacionLateralCabeza: 0.05,
} as const;

/**
 * Umbrales de los patrones posturales para clasificacion 3D.
 *
 * PENDIENTE — punto de partida razonado, no medido. Deben recalibrarse con la
 * muestra de participantes del estudio.
 */
export const UMBRALES_PATRON = {
  cuelloAdelantadoGrados: 25,
  encorvamientoGrados: 20,
  reclinacionGrados: 15,
  torsionGrados: 20,
  ladeoGrados: 15,
  distanciaCodoCabezaMetros: 0.15,
} as const;

/** Modo de datos. `http` no existe todavia y falla ruidosamente a proposito. */
export const MODO_DATOS: "mock" | "http" =
  import.meta.env.VITE_MODO_DATOS === "http" ? "http" : "mock";

export const APP = {
  nombre: "Habitusitos",
  nombreLargo: "Habitusitos · Monitor de postura",
  version: "0.1.0-mock",
  licencia: "AGPL-3.0-only",
  proyectoOriginal: "BatesPosture (wtbates99/batesposture)",
  urlProyectoOriginal: "https://github.com/wtbates99/batesposture",
  autor: "Leider Dario Bolano Agamez",
  institucion: "Universidad de Cartagena · Ingenieria de Software",
} as const;

/**
 * Aviso que acompana a toda la aplicacion. No se retira ni se atenua: es lo que
 * separa una demostracion honesta de una que se puede confundir con producto.
 */
export const AVISO_DEMO =
  "DEMOSTRACION · Prototipo visual con datos simulados. No es el software final.";

export const AVISO_PRIVACIDAD =
  "El video de la camara nunca se guarda ni se envia a ningun servidor. Solo se calculan angulos y puntajes, y se quedan en este equipo.";
