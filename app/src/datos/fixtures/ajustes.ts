/**
 * Ajustes de la aplicacion.
 *
 * Es el espejo del esquema tipado de `services/settings_service.py`: dataclasses
 * versionadas, persistidas con QSettings y sobreescribibles por variables de
 * entorno `POSTURE_<SECCION>_<CAMPO>`. Aqui se conserva la MISMA division en
 * secciones para que la migracion sea mecanica y para que el dialogo de ajustes
 * del producto real pueda tener exactamente estas pestanas.
 */

import { PESOS_POR_DEFECTO, UMBRALES_POR_DEFECTO, config } from "@/config/app.config";

export interface AjustesGeneral {
  iniciarConWindows: boolean;
  minimizarABandeja: boolean;
  modoEnfoque: boolean;
  tema: "sistema" | "claro" | "oscuro";
}

export interface AjustesCamara {
  dispositivoId: number;
  resolucion: "1280x720" | "640x480";
  muestrasPorSegundo: number;
  resolucionAdaptativa: boolean;
  /** Ecualizacion adaptativa de contraste. En la interfaz NUNCA se llama CLAHE:
   *  la seccion 5 prohibe la jerga tecnica en la cara del usuario final. */
  mejorarContrasteConPocaLuz: boolean;
}

export interface AjustesDeteccion {
  pesos: number[];
  umbrales: typeof UMBRALES_POR_DEFECTO;
  complejidadModelo: 0 | 1 | 2;
  confianzaMinima: number;
  clasificacionPatronesActiva: boolean;
}

export interface AjustesNotificaciones {
  umbralMalaPostura: number;
  segundosSostenidos: number;
  minutosEnfriamiento: number;
  recordatorioPausa: boolean;
  minutosRecordatorioPausa: number;
}

export interface AjustesDatos {
  /** Registro en base de datos. Desactivado por defecto por privacidad: es
   *  opt-in en el proyecto original y aqui se conserva esa decision. */
  guardarHistorial: boolean;
  guardarMetricasDetalladas: boolean;
  rutaBaseDatos: string;
}

export interface AjustesBaseline {
  activo: boolean;
  tauSegundos: number;
  pisoCalidad: number;
  derivaMaxima: number;
}

export interface Ajustes {
  general: AjustesGeneral;
  camara: AjustesCamara;
  deteccion: AjustesDeteccion;
  notificaciones: AjustesNotificaciones;
  datos: AjustesDatos;
  baseline: AjustesBaseline;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  general: {
    iniciarConWindows: true,
    minimizarABandeja: true,
    modoEnfoque: false,
    tema: "sistema",
  },
  camara: {
    dispositivoId: 0,
    resolucion: "1280x720",
    muestrasPorSegundo: config.MUESTRAS_POR_SEGUNDO,
    resolucionAdaptativa: true,
    mejorarContrasteConPocaLuz: true,
  },
  deteccion: {
    pesos: [...PESOS_POR_DEFECTO],
    umbrales: { ...UMBRALES_POR_DEFECTO },
    complejidadModelo: 0,
    confianzaMinima: 0.5,
    clasificacionPatronesActiva: true,
  },
  notificaciones: {
    umbralMalaPostura: config.UMBRAL_MALA_POSTURA,
    segundosSostenidos: config.SEGUNDOS_MALA_POSTURA_SOSTENIDA,
    minutosEnfriamiento: config.MINUTOS_ENFRIAMIENTO,
    recordatorioPausa: true,
    minutosRecordatorioPausa: config.MINUTOS_RECORDATORIO_PAUSA,
  },
  datos: {
    guardarHistorial: true,
    guardarMetricasDetalladas: false,
    rutaBaseDatos: "C:\\Users\\<usuario>\\AppData\\Local\\Habitusitos\\habitusitos.db",
  },
  baseline: {
    activo: true,
    tauSegundos: config.BASELINE_TAU_SEGUNDOS,
    pisoCalidad: config.BASELINE_PISO_CALIDAD,
    derivaMaxima: config.BASELINE_DERIVA_MAXIMA,
  },
};

/**
 * Presets de sensibilidad de las siete metricas.
 *
 * Se ofrecen presets etiquetados en vez de siete campos numericos sueltos
 * porque nadie que no haya escrito el algoritmo sabe que significa subir el peso
 * de `rotacionHombros` a 0.22. Los numeros siguen disponibles para quien quiera
 * afinarlos; el preset es la puerta de entrada.
 */
export const PRESETS_PESOS: {
  id: string;
  nombre: string;
  descripcion: string;
  pesos: number[];
}[] = [
  {
    id: "equilibrado",
    nombre: "Equilibrado",
    descripcion: "El reparto por defecto, heredado del proyecto original.",
    pesos: [...PESOS_POR_DEFECTO],
  },
  {
    id: "cuello",
    nombre: "Enfocado en el cuello",
    descripcion:
      "Prioriza cabeza adelantada y angulo de cuello. Util si trabajas con portatil sin soporte.",
    pesos: [0.3, 0.3, 0.1, 0.1, 0.1, 0.07, 0.03],
  },
  {
    id: "espalda",
    nombre: "Enfocado en la espalda",
    descripcion: "Prioriza la alineacion de columna y los hombros.",
    pesos: [0.12, 0.15, 0.2, 0.18, 0.25, 0.06, 0.04],
  },
  {
    id: "simetria",
    nombre: "Enfocado en la simetria",
    descripcion:
      "Prioriza estar de frente y sin ladear. Util si te recuestas sobre un codo.",
    pesos: [0.1, 0.12, 0.22, 0.2, 0.11, 0.15, 0.1],
  },
];
