/**
 * Tipos de dominio — FUENTE UNICA DE VERDAD de las formas de datos.
 *
 * Los tipos que representan filas persistidas son el espejo LITERAL del esquema
 * SQLite del proyecto original (prompt maestro seccion 4.7) y de las tablas
 * propuestas en la seccion 12. Sus campos se dejan en `snake_case` ingles a
 * PROPOSITO: son nombres de columna que ya existen en `data/database.py`.
 * Traducirlos aqui crearia una capa de conversion que mantener y un sitio donde
 * el mock y la base de datos real podrian divergir en silencio.
 *
 * Todo lo demas — conceptos de dominio, funciones, variables — va en espanol.
 *
 * REGLA: si un campo cambia aqui, cambia en la migracion SQL. Y al reves.
 */

/** Instante en ISO 8601 UTC. Los datos SIEMPRE se persisten en UTC; la zona
 *  horaria es exclusivamente presentacion y pasa por utils/formato.ts. */
export type FechaISO = string;

// ---------------------------------------------------------------------------
// Geometria y deteccion
// ---------------------------------------------------------------------------

/** Punto normalizado que devuelve MediaPipe Pose. x/y en [0,1] respecto al
 *  frame; z es profundidad relativa a las caderas (negativo = mas cerca). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** Confianza del punto en [0,1]. MediaPipe la llama `visibility`. */
  visibility: number;
}

/** Punto en espacio metrico 3D (metros, origen en la pelvis). Misma forma que
 *  Landmark; se usa un alias para dejar claro en las firmas cual espacio es. */
export type Landmark3D = Landmark;

/** Salida completa de un frame de deteccion: landmarks proyectivos (2D + z
 *  relativo) y, si el modelo los devolvio, los landmarks metricos 3D. */
export interface FramePose {
  landmarks: Landmark[];
  /** null cuando el modelo no los produjo en este frame. Nunca se sintetizan:
   *  si no hay dato metrico real, la calibracion 3D y el clasificador de
   *  patrones se degradan con gracia en vez de inventar un valor. */
  worldLandmarks: Landmark3D[] | null;
}

/**
 * Indices de los landmarks de MediaPipe Pose que usa el calculo de postura y clasificacion.
 * Son los mismos en la API legacy (Solutions) y en la moderna (Tasks /
 * PoseLandmarker), porque ambas exponen el modelo BlazePose de 33 puntos.
 */
export const PUNTO = {
  NARIZ: 0,
  OJO_INT_IZQ: 1,
  OJO_IZQ: 2,
  OJO_EXT_IZQ: 3,
  OJO_INT_DER: 4,
  OJO_DER: 5,
  OJO_EXT_DER: 6,
  OREJA_IZQ: 7,
  OREJA_DER: 8,
  BOCA_IZQ: 9,
  BOCA_DER: 10,
  HOMBRO_IZQ: 11,
  HOMBRO_DER: 12,
  CODO_IZQ: 13,
  CODO_DER: 14,
  MUNECA_IZQ: 15,
  MUNECA_DER: 16,
  CADERA_IZQ: 23,
  CADERA_DER: 24,
} as const;

/** Las seis metricas geometricas, en el orden en que se ponderan. */
export interface MetricasPostura {
  /** 1 · Cabeza adelantada ("text neck"): profundidad nariz vs. orejas. */
  inclinacionCabeza: number;
  /** 2 · Angulo del cuello respecto a la vertical ideal. */
  cuelloVertical: number;
  /** 3 · Diferencia de altura entre hombros. */
  nivelHombros: number;
  /** 4 · Rotacion del torso: diferencia de profundidad entre hombros. */
  rotacionHombros: number;
  /** 5 · Angulo de la columna respecto a la vertical ideal. */
  alineacionColumna: number;
  /** 6 · Cabeza ladeada: diferencia de altura entre orejas. */
  inclinacionLateralCabeza: number;
}

export type NombreMetrica = keyof MetricasPostura;

export type MetricasDisponibilidad = Record<NombreMetrica, boolean>;

/** Calibracion de la postura neutra del usuario, capturada en un solo instante
 *  (el mismo click de "Marca tu postura normal" en vista-camara.tsx).
 *
 *  APORTE PROPIO — capa 3D. offsetZ ya existia (metrica 1, cabeza adelantada).
 *  vectorArriba es nuevo: reemplaza el vector vertical fijo [0,-1,0] de las
 *  metricas 2 y 5 por la orientacion real del torso de ESTE usuario frente a
 *  ESTA camara, sin necesidad de clasificar donde esta la camara. */
export interface CalibracionPostural {
  offsetZ: number;
  /** null = sin calibrar (o worldLandmarks no disponibles al calibrar): las
   *  metricas 2 y 5 usan el vector vertical fijo heredado, comportamiento
   *  identico al actual. */
  vectorArriba: [number, number, number] | null;
}

export type PatronPostural =
  | "optima"
  | "cuello_adelantado"
  | "encorvamiento_toracico"
  | "reclinacion_excesiva"
  | "apoyo_asimetrico_codo"
  | "torsion_lateral"
  | "cabeza_ladeada"
  | "postura_desconocida" // camara activa, confianza insuficiente
  | "sin_datos"; // modo simulado: no hay landmarks reales que clasificar

export interface ResultadoClasificacion {
  patronPrincipal: PatronPostural;
  patronesSecundarios: PatronPostural[];
  diagnosticoPrincipal: string;
  /** [0,1]. Baja cuando faltan puntos por poca visibilidad. */
  confianza: number;
  anguloCervical3D: number | null;
  anguloEspalda3D: number | null;
  rotacionCabeza3D: { pitch: number; yaw: number; roll: number } | null;
}

/** Resultado completo de evaluar un frame. */
export interface ResultadoPostura {
  /** Puntaje final en [0,100]. */
  puntaje: number;
  /** Cada metrica normalizada a [0,1]. 1 = perfecto. */
  metricas: MetricasPostura;
  /** Aporte de cada metrica al puntaje final, en puntos sobre 100. Existe para
   *  que el panel pueda explicar POR QUE bajo el puntaje, no solo que bajo. */
  aportes: MetricasPostura;
  /** Disponibilidad de cada metrica segun la visibilidad de los landmarks. */
  disponibilidad?: MetricasDisponibilidad;
}

// ---------------------------------------------------------------------------
// Estado de la sesion
// ---------------------------------------------------------------------------

/**
 * Estados de la maquina que gobierna las alertas.
 * `vigilando` es el estado que impide el falso positivo del RF-3: la postura ya
 * esta por debajo del umbral, pero todavia no ha durado lo suficiente.
 */
export type EstadoPostural =
  | "excelente"
  | "buena"
  | "vigilando"
  | "alerta"
  | "pausa"
  | "sin-camara";

/** Los tres canales redundantes con los que se comunica el estado (WCAG 1.4.1):
 *  color, forma de icono y texto. Nunca solo color. */
export interface PresentacionEstado {
  estado: EstadoPostural;
  etiqueta: string;
  descripcion: string;
  /** Nombre de la forma, no del color. La bandeja de Windows mide 16x16 px y no
   *  cabe texto: ahi la forma es el unico canal ademas del color. */
  forma: "circulo" | "triangulo" | "octagono" | "pausa" | "interrogacion";
  tokenColor: string;
}

export interface MuestraPuntaje {
  /** Segundos monotonicos desde el inicio de la sesion. Se usa tiempo monotonico
   *  y no reloj de pared para que suspender el equipo no corrompa la sesion
   *  (prompt maestro seccion 10). */
  t: number;
  score: number;
  /** false cuando no se detecto persona en el frame. */
  detectado: boolean;
}

export interface EstadisticasSesion {
  muestras: number;
  promedio: number;
  minimo: number;
  maximo: number;
  /** Segundos de sesion activa, EXCLUYENDO las pausas por no deteccion. */
  duracionActivaSegundos: number;
  /** Segundos continuos actuales con puntaje sobre el umbral. */
  rachaActualSegundos: number;
  /** La mejor racha de la sesion. */
  mejorRachaSegundos: number;
  /** Proporcion [0,1] del tiempo activo con buena postura. */
  proporcionBuenaPostura: number;
}

// ---------------------------------------------------------------------------
// Persistencia — espejo del esquema SQLite
// ---------------------------------------------------------------------------

/** Tabla `posture_scores` (seccion 4.7). */
export interface FilaPuntaje {
  timestamp: FechaISO;
  score: number;
}

/** Tabla `dashboard_history` (seccion 4.7). Tabla ligera separada, pensada para
 *  repoblar el sparkline al reabrir el panel sin recalcular sobre posture_scores. */
export interface FilaHistorialPanel {
  ts: number;
  score: number;
}

/** Tabla `adaptive_baseline_history` (seccion 12) — evidencia del aporte 1. */
export interface FilaBaseline {
  timestamp: FechaISO;
  metric_name: NombreMetrica;
  baseline_value: number;
  sample_value: number;
  /** Si la muestra paso las salvaguardas y se incorporo al EMA. Este campo ES
   *  la evidencia de que el mecanismo anti-deriva funciona. */
  accepted: boolean;
  /** Aporte propio de Habitusitos: por que se rechazo. No esta en la seccion 12,
   *  pero sin esto una grafica de rechazos no explica nada. */
  motivo: MotivoRechazo | null;
}

export type MotivoRechazo =
  | "calidad-insuficiente"
  | "estado-de-alerta"
  | "limite-de-deriva";

/** Tabla `benchmark_runs` (seccion 12). */
export interface CorridaBenchmark {
  run_id: string;
  started_at: FechaISO;
  label: string;
  config: ConfigBenchmark;
  resumen: ResumenBenchmark;
}

export interface ConfigBenchmark {
  resolucion: "1280x720" | "640x480";
  muestrasPorSegundo: number;
  /** 0 = lite, 1 = full, 2 = heavy. Nomenclatura de MediaPipe. */
  complejidadModelo: 0 | 1 | 2;
  resolucionAdaptativa: boolean;
}

/** Tabla `benchmark_samples` (seccion 12). */
export interface MuestraBenchmark {
  run_id: string;
  timestamp: FechaISO;
  cpu_percent: number;
  rss_mb: number;
  effective_fps: number;
  detection_rate: number;
}

export interface ResumenBenchmark {
  cpuPromedio: number;
  cpuMaximo: number;
  rssPromedioMb: number;
  fpsEfectivo: number;
  tasaDeteccion: number;
  duracionSegundos: number;
}

// ---------------------------------------------------------------------------
// Analitica
// ---------------------------------------------------------------------------

export interface DiaHistorial {
  /** Fecha en `YYYY-MM-DD`, ya en zona de presentacion. */
  fecha: string;
  /** Promedio del dia, o null si no hubo uso. */
  promedio: number | null;
  minutosActivos: number;
  /** Marcado desde la API publica de festivos, con respaldo local. Explica los
   *  huecos del mapa de calor para que no parezcan abandono. */
  esFestivo: boolean;
  nombreFestivo?: string;
}

export interface ComparacionDiaSemana {
  /** 1 = lunes ... 7 = domingo (ISO-8601). */
  dia: number;
  etiqueta: string;
  promedio: number;
  minutosPromedio: number;
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export type CodigoError =
  | "camara-no-encontrada"
  | "camara-ocupada"
  | "camara-desconectada"
  | "servidor-desconectado"
  | "permiso-denegado"
  | "hardware-lento"
  | "iluminacion-deficiente"
  | "fallo-base-datos"
  | "fallo-exportacion"
  | "sin-deteccion"
  | "no-implementado";

/**
 * Error de la capa de datos. Existe para que el mock falle como fallaria el
 * backend real, con un codigo que la interfaz pueda mapear a un mensaje
 * accionable en espanol. Nunca se muestra un mensaje tecnico crudo al usuario.
 */
export class ErrorApp extends Error {
  codigo: CodigoError;
  accionSugerida?: string;

  constructor(codigo: CodigoError, mensaje: string, accionSugerida?: string) {
    super(mensaje);
    this.name = "ErrorApp";
    this.codigo = codigo;
    this.accionSugerida = accionSugerida;
  }
}
