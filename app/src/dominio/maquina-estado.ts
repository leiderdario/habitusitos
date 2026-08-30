/**
 * Maquina de estados de la postura y las alertas.
 *
 * Existe para cumplir el RF-3 del prompt maestro: "la notificacion no se dispara
 * en el primer frame de mala postura; requiere que la mala postura persista por
 * un umbral de tiempo configurable". Sin este estado intermedio, agacharse a
 * recoger un lapiz dispararia una alerta.
 *
 *   buena/excelente ──(puntaje < umbral)──▶ vigilando
 *   vigilando ──(sostenido N seg)──▶ alerta ──(puntaje recupera)──▶ buena
 *   vigilando ──(puntaje recupera)──▶ buena          [falso positivo evitado]
 *   cualquiera ──(sin persona 2 seg)──▶ pausa        [no rompe rachas]
 *
 * El estado `alerta` tambien congela el baseline adaptativo (salvaguarda 2 de
 * dominio/baseline-adaptativo.ts): mientras el sistema esta avisando, no
 * aprende.
 *
 * Se usa tiempo MONOTONICO en segundos, no reloj de pared. Si el usuario
 * suspende el portatil durante una sesion, el reloj de pared salta horas y la
 * sesion reportaria datos corruptos (prompt maestro seccion 10).
 *
 * Este archivo no importa NADA fuera del dominio.
 */

import type { EstadoPostural, PresentacionEstado } from "./tipos";

export interface ConfigAlertas {
  umbralMalaPostura: number;
  umbralBuenaPostura: number;
  umbralExcelente: number;
  segundosSostenidos: number;
  segundosParaPausa: number;
  minutosEnfriamiento: number;
  /** Silencia las notificaciones sin detener el seguimiento. */
  modoEnfoque: boolean;
}

export interface EstadoMaquina {
  estado: EstadoPostural;
  /** Instante monotonico en que entro a `vigilando`. null si no esta vigilando. */
  vigilandoDesde: number | null;
  /** Instante monotonico sin deteccion. null si hay persona. */
  sinDeteccionDesde: number | null;
  /** Instante de la ultima notificacion emitida. Gobierna el enfriamiento. */
  ultimaNotificacion: number | null;
}

export interface TransicionResultado {
  estado: EstadoMaquina;
  /** true solo en el frame exacto en que hay que emitir la notificacion. */
  emitirNotificacion: boolean;
}

export function crearMaquina(): EstadoMaquina {
  return {
    estado: "buena",
    vigilandoDesde: null,
    sinDeteccionDesde: null,
    ultimaNotificacion: null,
  };
}

/**
 * Avanza la maquina un paso.
 *
 * @param maquina  Estado actual.
 * @param puntaje  Puntaje 0-100 del frame, o null si no se detecto persona.
 * @param ahora    Tiempo monotonico en segundos.
 */
export function avanzar(
  maquina: EstadoMaquina,
  puntaje: number | null,
  ahora: number,
  cfg: ConfigAlertas,
): TransicionResultado {
  // --- Sin persona en el frame ---
  if (puntaje === null) {
    const desde = maquina.sinDeteccionDesde ?? ahora;
    const pausado = ahora - desde >= cfg.segundosParaPausa;
    return {
      estado: {
        ...maquina,
        // La pausa NO rompe la racha ni ensucia estadisticas: contar el tiempo
        // fuera del escritorio como mala postura seria injusto y falsearia los
        // datos de la tesis.
        estado: pausado ? "pausa" : maquina.estado,
        sinDeteccionDesde: desde,
        vigilandoDesde: pausado ? null : maquina.vigilandoDesde,
      },
      emitirNotificacion: false,
    };
  }

  const base: EstadoMaquina = { ...maquina, sinDeteccionDesde: null };

  // --- Postura aceptable: se sale de vigilancia o de alerta ---
  if (puntaje >= cfg.umbralMalaPostura) {
    return {
      estado: {
        ...base,
        estado: puntaje >= cfg.umbralExcelente ? "excelente" : "buena",
        vigilandoDesde: null,
      },
      emitirNotificacion: false,
    };
  }

  // --- Postura por debajo del umbral ---
  const vigilandoDesde = base.vigilandoDesde ?? ahora;
  const sostenido = ahora - vigilandoDesde >= cfg.segundosSostenidos;

  if (!sostenido) {
    return {
      estado: { ...base, estado: "vigilando", vigilandoDesde },
      emitirNotificacion: false,
    };
  }

  // Sostenida el tiempo suficiente: es una alerta genuina.
  const enfriamientoSeg = cfg.minutosEnfriamiento * 60;
  const yaAvisoReciente =
    base.ultimaNotificacion !== null &&
    ahora - base.ultimaNotificacion < enfriamientoSeg;

  // El modo enfoque silencia el aviso pero NO oculta el estado: el icono de
  // bandeja sigue reflejando la realidad. Silenciar no es mentir.
  const emitir = !yaAvisoReciente && !cfg.modoEnfoque;

  return {
    estado: {
      ...base,
      estado: "alerta",
      vigilandoDesde,
      ultimaNotificacion: emitir ? ahora : base.ultimaNotificacion,
    },
    emitirNotificacion: emitir,
  };
}

/**
 * Presentacion de cada estado en los TRES canales redundantes que exige
 * WCAG 2.2 (criterio 1.4.1, "Use of Color"): color, forma y texto.
 *
 * La forma no es decorativa. El icono de bandeja de Windows mide 16x16 px: ahi
 * no cabe texto, asi que la forma es el unico canal disponible ademas del color
 * — y ~8% de los hombres no distingue rojo de verde.
 */
export const PRESENTACION: Record<EstadoPostural, PresentacionEstado> = {
  excelente: {
    estado: "excelente",
    etiqueta: "Excelente",
    descripcion: "Tu postura esta muy bien. Sigue asi.",
    forma: "circulo",
    tokenColor: "estado-buena",
  },
  buena: {
    estado: "buena",
    etiqueta: "Buena",
    descripcion: "Vas bien. No hay nada que corregir.",
    forma: "circulo",
    tokenColor: "estado-buena",
  },
  vigilando: {
    estado: "vigilando",
    etiqueta: "Atento",
    descripcion: "Tu postura bajo hace un momento. Si se mantiene, te aviso.",
    forma: "triangulo",
    tokenColor: "estado-regular",
  },
  alerta: {
    estado: "alerta",
    etiqueta: "Corrige",
    descripcion: "Llevas un rato en una postura que te puede cansar.",
    forma: "octagono",
    tokenColor: "estado-corrige",
  },
  pausa: {
    estado: "pausa",
    etiqueta: "En pausa",
    descripcion: "No te veo en camara. La sesion se reanuda sola cuando vuelvas.",
    forma: "pausa",
    tokenColor: "estado-pausa",
  },
  "sin-camara": {
    estado: "sin-camara",
    etiqueta: "Sin camara",
    descripcion: "No hay una camara disponible para hacer seguimiento.",
    forma: "interrogacion",
    tokenColor: "estado-pausa",
  },
};

/** Mapea un puntaje suelto a estado, sin historia. Para datos ya archivados. */
export function estadoDesdePuntaje(
  puntaje: number,
  cfg: Pick<ConfigAlertas, "umbralMalaPostura" | "umbralExcelente">,
): EstadoPostural {
  if (puntaje >= cfg.umbralExcelente) return "excelente";
  if (puntaje >= cfg.umbralMalaPostura) return "buena";
  return "alerta";
}
