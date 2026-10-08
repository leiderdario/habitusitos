/**
 * Agregacion anonima de varias personas para el panel de oficina.
 *
 * REGLA DE ARQUITECTURA QUE NO SE PUEDE ROMPER: esta interfaz nunca lleva un
 * campo que identifique a una persona (nombre, idSeguimiento, foto, ni nada de
 * lo que se pueda reconstruir hacia una identidad). Cualquier cambio a esta
 * lista de campos exige revision de codigo explicita, no un agregado
 * silencioso -- por eso el test de forma cerrada en agregacion-oficina.test.ts.
 *
 * "Semaforo de jornada, no de frame": quien llama a `agregarOficina` debe
 * pasar una VENTANA de los ultimos minutos (ver
 * config.VENTANA_AGREGADO_OFICINA_SEGUNDOS), nunca solo el frame actual — si
 * no, la alerta grupal parpadearia por un movimiento de 2 segundos de una
 * sola persona. Esta funcion no sabe ni le importa de donde salio la ventana:
 * solo agrega lo que se le pasa.
 */

import type { EstadoPostural } from "./tipos";
import { PRESENTACION } from "./maquina-estado";

export interface DatosAgregadosOficina {
  timestampUTC: string;
  personasActivas: number;
  puntajeAgregado: { promedio: number; minimo: number; maximo: number };
  conteoPorEstado: Record<EstadoPostural, number>;
  tendenciaUltimaHora: ReadonlyArray<{ t: number; promedio: number }>;
}

/** Lista cerrada de campos permitidos — usada por el test de forma. */
export const CAMPOS_AGREGADO_OFICINA = [
  "timestampUTC",
  "personasActivas",
  "puntajeAgregado",
  "conteoPorEstado",
  "tendenciaUltimaHora",
] as const;

const ESTADOS_POSTURALES = Object.keys(PRESENTACION) as EstadoPostural[];

function conteoVacio(): Record<EstadoPostural, number> {
  const conteo = {} as Record<EstadoPostural, number>;
  for (const estado of ESTADOS_POSTURALES) conteo[estado] = 0;
  return conteo;
}

export function agregarOficina(
  muestras: ReadonlyArray<{ estado: EstadoPostural; puntaje: number }>,
  personasActivasAhora: number,
  tendenciaUltimaHora: ReadonlyArray<{ t: number; promedio: number }>,
  ahoraUTC: string,
): DatosAgregadosOficina {
  const conteoPorEstado = conteoVacio();
  let suma = 0;
  let minimo = Infinity;
  let maximo = -Infinity;

  for (const m of muestras) {
    conteoPorEstado[m.estado] += 1;
    suma += m.puntaje;
    if (m.puntaje < minimo) minimo = m.puntaje;
    if (m.puntaje > maximo) maximo = m.puntaje;
  }

  const hayMuestras = muestras.length > 0;

  return {
    timestampUTC: ahoraUTC,
    personasActivas: personasActivasAhora,
    puntajeAgregado: {
      promedio: hayMuestras ? suma / muestras.length : 0,
      minimo: hayMuestras ? minimo : 0,
      maximo: hayMuestras ? maximo : 0,
    },
    conteoPorEstado,
    tendenciaUltimaHora,
  };
}

/**
 * Fraccion [0,1] de la ventana en estado "alerta" o "vigilando". El panel
 * dispara la alerta grupal cuando esto pasa de 0.5 (mas de la mitad del
 * equipo, sostenido en la ventana, no en un instante).
 */
export function proporcionMalaPostura(conteoPorEstado: Record<EstadoPostural, number>): number {
  const total = ESTADOS_POSTURALES.reduce((acc, estado) => acc + conteoPorEstado[estado], 0);
  if (total === 0) return 0;
  return (conteoPorEstado.alerta + conteoPorEstado.vigilando) / total;
}
