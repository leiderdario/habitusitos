/**
 * Sedentarismo: MET estimado desde la frecuencia cardiaca, calibracion del pulso
 * en reposo y seguimiento de "bouts" (tiempo continuo sentado).
 *
 * Aporte propio de Habitusitos (Fase 7, ver docs/DISENO_PAUSAS_Y_SEDENTARISMO.md).
 * Funciones puras y deterministas: no dependen de si la postura viene de la camara
 * o del reloj, ni de que exista un reloj fisico — se prueban con datos de prueba.
 *
 * Los umbrales de `CONFIG_SEDENTARISMO_POR_DEFECTO` son valores de arranque
 * razonables, NO resultados medidos: estan marcados como PENDIENTES de validar.
 */

export interface ConfigSedentarismo {
  /** SBRN: sentado y por debajo de este MET se considera conducta sedentaria. */
  metMaximoSedentario: number;
  /** Quietud minima para tomar el pulso en reposo (segundos). */
  reposoMinimoSegundos: number;
  /** Cuanto tiempo de pie/caminando se tolera sin romper el bout (segundos).
   *  PENDIENTE: valor de arranque, sin respaldo en datos propios. */
  toleranciaInterrupcionSegundos: number;
}

export const CONFIG_SEDENTARISMO_POR_DEFECTO: ConfigSedentarismo = {
  metMaximoSedentario: 1.5,
  reposoMinimoSegundos: 240,
  toleranciaInterrupcionSegundos: 60,
};

/**
 * MET estimado con la ecuacion de Wicks: MET ~ 6 * FC / FC_reposo - 5.
 * Se acota a 1: por definicion 1 MET es el reposo, y un pulso algo bajo el de
 * referencia no significa "menos que reposo". Devuelve null si falta cualquiera
 * de los dos pulsos: nunca se inventa un MET.
 */
export function calcularMet(fcBpm: number | null, fcReposoBpm: number | null): number | null {
  if (fcBpm === null || fcReposoBpm === null || fcReposoBpm <= 0 || fcBpm <= 0) return null;
  return Math.max(1, (6 * fcBpm) / fcReposoBpm - 5);
}

export interface MuestraPulso {
  /** Segundos monotonicos. */
  t: number;
  fcBpm: number | null;
  /** Sin movimiento apreciable en el momento de la muestra. */
  quieto: boolean;
}

/**
 * Pulso en reposo: mediana de la ultima ventana continua y quieta, con pulso valido,
 * de al menos `reposoMinimoSegundos`. Devuelve null si todavia no hay una (la
 * calibracion es explicita, no asumida — mismo criterio que el baseline postural).
 * La mediana resiste picos sueltos que el promedio arrastraria.
 */
export function estimarFcReposo(
  muestras: readonly MuestraPulso[],
  config: ConfigSedentarismo = CONFIG_SEDENTARISMO_POR_DEFECTO,
): number | null {
  let ventana: number[] = [];
  let inicio = 0;
  let ultima: { fcs: number[]; duracion: number } | null = null;

  for (const m of muestras) {
    if (m.quieto && m.fcBpm !== null) {
      if (ventana.length === 0) inicio = m.t;
      ventana.push(m.fcBpm);
      if (m.t - inicio >= config.reposoMinimoSegundos) {
        ultima = { fcs: [...ventana], duracion: m.t - inicio };
      }
    } else {
      ventana = [];
    }
  }
  if (!ultima) return null;
  const orden = ultima.fcs.sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}

export interface EstadoBout {
  /** Segundos continuos sedentarios acumulados en el bout actual. */
  segundos: number;
  /** Segundos seguidos sin estar sedentario (para tolerar interrupciones breves). */
  segundosInterrumpido: number;
  /** Instante de la ultima muestra, para calcular dt. */
  ultimoT: number | null;
  /** Bouts ya cerrados que superaron los 60 min (cuenta para el export SST). */
  boutsLargos: number;
}

export const BOUT_INICIAL: EstadoBout = {
  segundos: 0,
  segundosInterrumpido: 0,
  ultimoT: null,
  boutsLargos: 0,
};

/** Umbral de "bout largo" del export SST (plan, Fase 5). */
export const BOUT_LARGO_SEGUNDOS = 3600;

export interface EntradaBout {
  t: number;
  sentado: boolean;
  /** null si no hay reloj: entonces basta con estar sentado. */
  met: number | null;
}

/**
 * Avanza el seguimiento un paso. Es sedentario si esta sentado y, cuando hay MET,
 * no supera el maximo. Una interrupcion mas corta que la tolerancia no rompe el
 * bout (agacharse a recoger algo no es una pausa activa); una mas larga lo cierra.
 */
export function avanzarBout(
  estado: EstadoBout,
  entrada: EntradaBout,
  config: ConfigSedentarismo = CONFIG_SEDENTARISMO_POR_DEFECTO,
): EstadoBout {
  const dt = estado.ultimoT === null ? 0 : Math.max(0, entrada.t - estado.ultimoT);
  const sedentario =
    entrada.sentado && (entrada.met === null || entrada.met <= config.metMaximoSedentario);

  if (sedentario) {
    // El tiempo interrumpido breve tambien cuenta como parte del bout continuo.
    return {
      ...estado,
      segundos: estado.segundos + dt + estado.segundosInterrumpido,
      segundosInterrumpido: 0,
      ultimoT: entrada.t,
    };
  }

  const interrumpido = estado.segundosInterrumpido + dt;
  if (interrumpido <= config.toleranciaInterrupcionSegundos) {
    return { ...estado, segundosInterrumpido: interrumpido, ultimoT: entrada.t };
  }
  return {
    segundos: 0,
    segundosInterrumpido: 0,
    ultimoT: entrada.t,
    boutsLargos: estado.boutsLargos + (estado.segundos >= BOUT_LARGO_SEGUNDOS ? 1 : 0),
  };
}
