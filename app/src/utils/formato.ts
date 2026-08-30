/**
 * Formato de fechas, numeros y duraciones.
 *
 * REGLA DE TIEMPO (no negociable, seccion 8 de las directrices del proyecto):
 * los datos se persisten SIEMPRE en UTC. La zona horaria es exclusivamente
 * presentacion y pasa por este archivo. Si aparece un `toLocaleString()` suelto
 * en un componente, es un bug: se rompe la coherencia entre lo que se muestra y
 * lo que se guarda, y en un sistema del que se extraen conclusiones para una
 * tesis eso invalida los datos.
 */

import { config } from "@/config/app.config";

const LOCALE = config.LOCALE;
const TZ = config.TZ_PRESENTACION;

const fmtFecha = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fmtFechaLarga = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const fmtHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const aFecha = (valor: string | number | Date): Date =>
  valor instanceof Date ? valor : new Date(valor);

export const formatearFecha = (v: string | number | Date) => fmtFecha.format(aFecha(v));
export const formatearFechaLarga = (v: string | number | Date) =>
  fmtFechaLarga.format(aFecha(v));
export const formatearHora = (v: string | number | Date) => fmtHora.format(aFecha(v));

/** `YYYY-MM-DD` a texto legible, sin corrimiento por zona horaria. */
export const formatearDia = (dia: string) => formatearFecha(`${dia}T12:00:00Z`);
export const formatearDiaLargo = (dia: string) => formatearFechaLarga(`${dia}T12:00:00Z`);

export function formatearNumero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function formatearPorcentaje(valor: number, decimales = 0): string {
  return `${formatearNumero(valor, decimales)}%`;
}

/**
 * Duracion en segundos a texto humano: "2 h 40 min", "18 min", "45 s".
 *
 * Se omite la unidad mayor cuando vale cero: "0 h 18 min" se lee como un error
 * de formato, no como dieciocho minutos.
 */
export function formatearDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;

  const horas = Math.floor(s / 3600);
  const minutos = Math.round((s % 3600) / 60);

  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} min`;
}

/** Duracion compacta para tablas y etiquetas de eje: "2:40". */
export function formatearDuracionCorta(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  if (horas === 0) return `${minutos}:${String(s % 60).padStart(2, "0")}`;
  return `${horas}:${String(minutos).padStart(2, "0")}`;
}

export function formatearMegabytes(mb: number): string {
  return `${formatearNumero(mb, 0)} MB`;
}

/**
 * Cambio porcentual con signo explicito.
 *
 * El signo siempre visible evita la ambiguedad de "12%": no se sabe si subio o
 * bajo, y en una tabla de benchmark eso invierte la conclusion.
 */
export function formatearCambio(porcentaje: number): string {
  const signo = porcentaje > 0 ? "+" : "";
  return `${signo}${formatearNumero(porcentaje, 1)}%`;
}

/** Descarga un texto como archivo. Es lo mas parecido a un guardado real que
 *  puede hacer un prototipo en navegador. */
export function descargarTexto(nombre: string, contenido: string, tipo = "text/csv"): void {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
