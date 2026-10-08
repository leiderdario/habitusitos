/**
 * Pausas activas: que avisar, cuando, y que ejercicio proponer segun la zona que
 * falla y los antecedentes de salud.
 *
 * Aporte propio de Espinker (Fase 7, ver docs/DISENO_PAUSAS_Y_SEDENTARISMO.md).
 * Puro: no muestra nada ni toca el reloj; decide. Quien lo usa (estado/ y la
 * interfaz) ejecuta la decision.
 *
 * AVISO CLINICO: la tabla de contraindicaciones es una propuesta de ingenieria,
 * conservadora, NO revisada por un fisioterapeuta. Esta marcada PENDIENTE de
 * validacion clinica antes de usarla con personas. Ante la duda se excluye.
 */

import type { AntecedentesSalud } from "./tipos";

export type ZonaPausa = "cuello" | "espalda" | "muneca" | "general";

export type IdPausa =
  | "caminar"
  | "hidratacion"
  | "regla_20_20_20"
  | "estiramiento_cuello_suave"
  | "movilidad_espalda_de_pie"
  | "estiramiento_muneca";

export interface PausaActiva {
  id: IdPausa;
  zona: ZonaPausa;
  titulo: string;
  duracionSegundos: number;
  /** Antecedentes que la excluyen. Si cualquiera es `true`, no se propone. */
  contraindicadaPor: ReadonlyArray<keyof AntecedentesSalud>;
}

export const CATALOGO_PAUSAS: readonly PausaActiva[] = [
  { id: "caminar", zona: "general", titulo: "Camina un par de minutos", duracionSegundos: 120, contraindicadaPor: [] },
  { id: "hidratacion", zona: "general", titulo: "Toma agua", duracionSegundos: 60, contraindicadaPor: [] },
  { id: "regla_20_20_20", zona: "general", titulo: "Mira algo lejano por 20 segundos", duracionSegundos: 20, contraindicadaPor: [] },
  {
    id: "estiramiento_cuello_suave",
    zona: "cuello",
    titulo: "Estiramiento suave de cuello",
    duracionSegundos: 60,
    contraindicadaPor: ["cirugia_columna_cuello_hombro", "hernia_protrusion", "cervicalgia"],
  },
  {
    id: "movilidad_espalda_de_pie",
    zona: "espalda",
    titulo: "Movilidad de espalda de pie",
    duracionSegundos: 90,
    contraindicadaPor: ["hernia_protrusion", "cirugia_columna_cuello_hombro", "escoliosis", "embarazo"],
  },
  {
    id: "estiramiento_muneca",
    zona: "muneca",
    titulo: "Estiramiento de muneca y antebrazo",
    duracionSegundos: 60,
    contraindicadaPor: ["tunel_carpiano", "tendinitis_de_quervain", "cirugia_mano_muneca", "usa_ferulas"],
  },
];

/** Una pausa es apta si ninguno de sus antecedentes contraindicados esta marcado. */
export function pausaApta(pausa: PausaActiva, antecedentes: AntecedentesSalud | null): boolean {
  if (!antecedentes) return true;
  return pausa.contraindicadaPor.every((campo) => antecedentes[campo] !== true);
}

/**
 * Elige la pausa de la zona que fallo; si ninguna es apta cae a una general
 * (caminar nunca esta contraindicada en el catalogo), asi siempre hay propuesta.
 */
export function elegirPausa(zona: ZonaPausa, antecedentes: AntecedentesSalud | null): PausaActiva {
  const apta = CATALOGO_PAUSAS.find((p) => p.zona === zona && pausaApta(p, antecedentes));
  return apta ?? CATALOGO_PAUSAS.find((p) => p.id === "caminar")!;
}

export type RespuestaPausa = "tomada" | "pospuesta" | "ignorada";
export type CanalAviso = "reloj" | "pantalla";

export interface ConfigAvisoPausa {
  /** Bout continuo a partir del cual se avisa (segundos). PENDIENTE: valor de arranque. */
  boutAvisoSegundos: number;
  /** Cuanto se pospone con "mas tarde" (segundos). */
  posposicionSegundos: number;
  /** Cuanto se espera tras el aviso en el reloj antes de pasar a la pantalla. */
  esperaPantallaSegundos: number;
}

export const CONFIG_AVISO_PAUSA_POR_DEFECTO: ConfigAvisoPausa = {
  boutAvisoSegundos: 45 * 60,
  posposicionSegundos: 10 * 60,
  esperaPantallaSegundos: 30,
};

export interface EstadoAvisoPausa {
  /** Bout (segundos) desde el que se vuelve a avisar. */
  proximoAvisoEnBout: number;
  /** Instante en que se dio el aviso en el reloj, si esta esperando respuesta. */
  avisoRelojT: number | null;
  /** Instante del aviso en pantalla, si ya se mostro y sigue sin respuesta. */
  avisoPantallaT: number | null;
}

export function estadoAvisoInicial(config: ConfigAvisoPausa = CONFIG_AVISO_PAUSA_POR_DEFECTO): EstadoAvisoPausa {
  return { proximoAvisoEnBout: config.boutAvisoSegundos, avisoRelojT: null, avisoPantallaT: null };
}

export interface DecisionAviso {
  estado: EstadoAvisoPausa;
  /** Canal por el que avisar AHORA, o null si no hay que avisar. */
  avisar: CanalAviso | null;
}

/**
 * Dos pasos sobre una sola maquina (no dos sistemas paralelos): al llegar al bout
 * se avisa primero en el reloj; si no hay respuesta tras `esperaPantallaSegundos`
 * se avisa en pantalla. Sin reloj conectado se salta directo a la pantalla.
 */
export function evaluarAviso(
  estado: EstadoAvisoPausa,
  boutSegundos: number,
  t: number,
  hayReloj: boolean,
  config: ConfigAvisoPausa = CONFIG_AVISO_PAUSA_POR_DEFECTO,
): DecisionAviso {
  if (estado.avisoPantallaT !== null) return { estado, avisar: null };

  if (estado.avisoRelojT !== null) {
    if (t - estado.avisoRelojT >= config.esperaPantallaSegundos) {
      return { estado: { ...estado, avisoPantallaT: t }, avisar: "pantalla" };
    }
    return { estado, avisar: null };
  }

  if (boutSegundos < estado.proximoAvisoEnBout) return { estado, avisar: null };

  if (hayReloj) return { estado: { ...estado, avisoRelojT: t }, avisar: "reloj" };
  return { estado: { ...estado, avisoPantallaT: t }, avisar: "pantalla" };
}

/**
 * Registra como respondio la persona y reinicia el ciclo.
 *  - tomada: el bout lo reinicia quien llama (se levanto); aqui solo se rearma el aviso.
 *  - pospuesta: vuelve a avisar tras la posposicion.
 *  - ignorada: igual que pospuesta, pero queda registrada como "ignorada" para la
 *    tesis (no se castiga ni se insiste mas rapido: eso seria vigilancia, no ayuda).
 */
export function responderAviso(
  respuesta: RespuestaPausa,
  boutSegundos: number,
  config: ConfigAvisoPausa = CONFIG_AVISO_PAUSA_POR_DEFECTO,
): EstadoAvisoPausa {
  const siguiente =
    respuesta === "tomada" ? config.boutAvisoSegundos : boutSegundos + config.posposicionSegundos;
  return { proximoAvisoEnBout: siguiente, avisoRelojT: null, avisoPantallaT: null };
}
