/**
 * Generador pseudoaleatorio con semilla fija.
 *
 * Existe por una razon practica de demostracion: dos ejecuciones seguidas tienen
 * que verse identicas. Si el cliente pide "muestrame otra vez lo del baseline" y
 * salen numeros distintos, la demostracion pierde el hilo y la confianza.
 *
 * Es `mulberry32`: cuatro lineas, distribucion mas que suficiente para datos de
 * ejemplo. No sirve para criptografia y no pretende servir.
 *
 * ESTE ES EL UNICO ARCHIVO DEL PROYECTO AUTORIZADO A USAR `Math.random`, y solo
 * como semilla de emergencia. La regla se verifica en src/arquitectura.test.ts.
 */

import { config } from "@/config/app.config";

export type Aleatorio = () => number;

export function crearAleatorio(semilla: number = config.SEMILLA): Aleatorio {
  let a = semilla >>> 0;
  return function aleatorio(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generador compartido para las fixtures. */
const rnd = crearAleatorio();

export const entero = (min: number, max: number, r: Aleatorio = rnd): number =>
  Math.floor(r() * (max - min + 1)) + min;

export const decimal = (min: number, max: number, r: Aleatorio = rnd): number =>
  min + r() * (max - min);

export const elegir = <T,>(opciones: readonly T[], r: Aleatorio = rnd): T =>
  opciones[Math.floor(r() * opciones.length)];

export const quiza = (probabilidad: number, r: Aleatorio = rnd): boolean =>
  r() < probabilidad;

/**
 * Ruido gaussiano por Box-Muller.
 *
 * La postura real no salta como ruido uniforme: oscila alrededor de un valor con
 * colas suaves. Con ruido uniforme el sparkline se ve como una sierra y delata
 * al instante que los datos son inventados.
 */
export function gaussiano(media = 0, desviacion = 1, r: Aleatorio = rnd): number {
  const u = Math.max(r(), Number.EPSILON);
  const v = r();
  return media + desviacion * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Fecha desplazada N dias (y horas) hacia atras desde el ancla, en UTC. */
export function fechaHace(dias: number, horas = 0): Date {
  return new Date(config.ANCLA_UTC - dias * 86_400_000 - horas * 3_600_000);
}

/** `YYYY-MM-DD` de la fecha a N dias del ancla. */
export function diaHace(dias: number): string {
  return fechaHace(dias).toISOString().slice(0, 10);
}

/** Identificadores estables: nada de UUID aleatorio que cambie entre recargas. */
let contador = 0;
export function id(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${String(contador).padStart(4, "0")}`;
}
