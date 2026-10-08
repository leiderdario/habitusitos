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
  /** Aporte propio de Espinker: por que se rechazo. No esta en la seccion 12,
   *  pero sin esto una grafica de rechazos no explica nada. */
  motivo: MotivoRechazo | null;
}

export type MotivoRechazo =
  | "calidad-insuficiente"
  | "estado-de-alerta"
  | "limite-de-deriva";

// ---------------------------------------------------------------------------
// Analitica
// ---------------------------------------------------------------------------

export interface DiaHistorial {
  /** Fecha en `YYYY-MM-DD`, ya en zona de presentacion. */
  fecha: string;
  /** Promedio del dia, o null si no hubo uso. */
  promedio: number | null;
  minutosActivos: number;
  /** Porcentaje del tiempo monitoreado con puntaje bajo el umbral, o null si no hubo uso. */
  porcentajeMalaPostura: number | null;
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
// Cuentas y registro — espejo de las tablas reales en Supabase (Postgres)
// ---------------------------------------------------------------------------

/**
 * A diferencia de las tablas de la seccion anterior (que espejan un SQLite
 * HIPOTETICO del producto final), estas espejan columnas de Postgres que YA
 * EXISTEN desde la Fase 1 — ver supabase/migrations/0001_fase1_cuentas.sql.
 * Snake_case ingles por la misma razon: son nombres de columna reales.
 */

/** Como va a usar la aplicacion esta cuenta. No es un flag estetico: gobierna
 *  que pantallas y layout se montan (ver funcionalidades/panel-personal/ vs
 *  funcionalidades/panel-oficina/). */
export type ModoUso = "personal" | "oficina";

export type RolUsuario = "trabajador" | "rrhh_jefe";

/** Perfil de la cuenta. El id coincide con el id de auth.users de Supabase. */
export interface Usuario {
  id: string;
  correo: string | null;
  nombre: string;
  modo_uso: ModoUso;
  rol: RolUsuario;
  organizacion_id: string | null;
  creado_en: FechaISO;
}

export interface Organizacion {
  id: string;
  nombre: string;
  /** Codigo corto para el segundo metodo de login (equipos compartidos de
   *  oficina). Se rota desde la vista RRHH, nunca se expone en una consulta
   *  publica sin pasar por la funcion de union (ver migracion SQL). */
  codigo_acceso: string;
  creado_en: FechaISO;
}

export type TipoEventoRegistro =
  | "login_exitoso"
  | "login_fallido"
  | "logout"
  | "camara_iniciada"
  | "camara_detenida"
  | "exportacion"
  | "cambio_perfil";

/** Fila de `eventos_log`. Nunca se borra ni se edita: es el registro de
 *  auditoria pedido en el feedback original. */
export interface EventoRegistro {
  id?: string;
  usuario_id: string | null;
  tipo: TipoEventoRegistro;
  detalle?: string;
  creado_en: FechaISO;
}

// ---------------------------------------------------------------------------
// Antecedentes de salud — Fase 2. NO diagnostica: solo contextualiza alertas y
// evita sugerir pausas contraindicadas (ver funcionalidades/antecedentes/).
// ---------------------------------------------------------------------------

export type ManoDominante = "izquierda" | "derecha" | "ambidiestro";

/** Fila de `antecedentes_salud`, una por usuario (upsert, no historico en si
 *  misma). El historico de cambios vive aparte, en `CambioAntecedente`. */
export interface AntecedentesSalud {
  usuario_id: string;

  // Columna
  cervicalgia: boolean;
  lumbalgia: boolean;
  cifosis_hipercifosis: boolean;
  lordosis: boolean;
  hernia_protrusion: boolean;
  escoliosis: boolean;
  cirugia_columna_cuello_hombro: boolean;

  // Miembro superior
  tunel_carpiano: boolean;
  tendinitis_de_quervain: boolean;
  epicondilitis: boolean;
  manguito_rotador: boolean;
  cirugia_mano_muneca: boolean;

  // Otros
  usa_ferulas: boolean;
  /** Dato sensible. RLS restringe esta tabla entera al propio usuario, pero
   *  este campo en particular nunca debe terminar en ninguna vista agregada
   *  (Fase 8) ni en ningun export, ni siquiera anonimizado. */
  embarazo: boolean;
  dolor_cronico: boolean;
  enfermedad_laboral_biomecanica_previa: boolean;

  // Habitos
  horas_sentado_dia: number;
  mano_dominante: ManoDominante;
  /** "no_usa" cuando la persona no usa reloj en ninguna muneca -- relevante
   *  para la Fase 6/7 (el wearable se asocia a una muneca concreta). */
  muneca_reloj: ManoDominante | "no_usa";
  ya_hace_pausas: boolean;

  /** null = nunca se ha guardado (todavia no existe la fila). */
  actualizado_en: FechaISO | null;
}

/** Valores iniciales de un registro sin antecedentes capturados aun. Todo en
 *  falso/cero: la ausencia de un dato nunca se trata como una respuesta. */
export const ANTECEDENTES_VACIOS: Omit<AntecedentesSalud, "usuario_id" | "actualizado_en"> = {
  cervicalgia: false,
  lumbalgia: false,
  cifosis_hipercifosis: false,
  lordosis: false,
  hernia_protrusion: false,
  escoliosis: false,
  cirugia_columna_cuello_hombro: false,
  tunel_carpiano: false,
  tendinitis_de_quervain: false,
  epicondilitis: false,
  manguito_rotador: false,
  cirugia_mano_muneca: false,
  usa_ferulas: false,
  embarazo: false,
  dolor_cronico: false,
  enfermedad_laboral_biomecanica_previa: false,
  horas_sentado_dia: 8,
  mano_dominante: "derecha",
  muneca_reloj: "no_usa",
  ya_hace_pausas: false,
};

/** Fila de `antecedentes_cambios`. Insert-only, igual que `EventoRegistro`:
 *  el rastro de "que cambio y cuando" pedido en el feedback no se puede
 *  reconstruir si se permite editar o borrar una fila despues de escrita. */
export interface CambioAntecedente {
  id?: string;
  usuario_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string;
  cambiado_en: FechaISO;
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
  | "no-implementado"
  | "credenciales-invalidas"
  | "correo-ya-registrado"
  | "codigo-organizacion-invalido"
  | "sesion-requerida"
  | "consentimiento-requerido"
  | "acceso-denegado";

// ---------------------------------------------------------------------------
// Reloj wearable — contrato de datos (Fase 6; ver docs/PROTOCOLO_RELOJ.md)
// ---------------------------------------------------------------------------

/** Que fuentes respaldan una lectura de postura. `discordantes` = ambas
 *  responden pero no coinciden: se declara, no se promedia en silencio. */
export type FuenteDato = "solo_vision" | "solo_imu" | "ambas" | "discordantes";

/** Lectura del reloj. JSON liviano: orientacion y pulso, nunca video ni audio. */
export interface LecturaReloj {
  /** Version del protocolo, para que firmware y app evolucionen por separado. */
  version: 1;
  /** Milisegundos desde que arranco el reloj (monotonico). El reloj no conoce la
   *  hora real, y asi no hace falta sincronizar relojes para ordenar lecturas. */
  t_ms: number;
  /** Cuaternion de orientacion de la muneca (w, x, y, z), normalizado. */
  orientacion: { w: number; x: number; y: number; z: number };
  /** Pulsaciones por minuto, o null si el sensor no tiene lectura valida. */
  fc_bpm: number | null;
  /** Porcentaje de bateria 0-100, o null si no se puede medir. */
  bateria_pct: number | null;
  /** Si el reloj detecta que esta puesto en la muneca (contacto con la piel). */
  en_muneca: boolean;
}

/** Estado de conexion del reloj. Mismo patron que `EstadoConexionVisionNode`. */
export type EstadoConexionReloj =
  | { tipo: "inactivo" }
  | { tipo: "conectando" }
  | { tipo: "conectado" }
  | { tipo: "sin_senal"; segundos: number }
  | { tipo: "desconectado"; motivo?: string };

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
