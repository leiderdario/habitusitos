/**
 * Consentimientos: catalogo de textos versionados y calculo del estado vigente.
 *
 * Aporte propio de Espinker (Fase 8). Puro, sin imports externos.
 *
 * Los TEXTOS SON UN BORRADOR de ingenieria: no los redacto un abogado ni los reviso
 * el comite de etica. Mientras no pasen esa revision no valen como consentimiento
 * informado para pruebas con personas (ver docs/PREGUNTAS_Y_MEJORAS.md).
 *
 * Cambiar un texto exige cambiar `VERSION_CONSENTIMIENTOS`: asi cada aceptacion
 * queda atada al texto exacto que la persona leyo, y quien acepto una version
 * anterior vuelve a ver el aviso.
 */

export type TipoConsentimiento = "camara" | "salud" | "reloj";

export const VERSION_CONSENTIMIENTOS = "2026-10-borrador-1";

export interface TextoConsentimiento {
  tipo: TipoConsentimiento;
  titulo: string;
  /** Parrafos mostrados tal cual. Lenguaje llano, sin jerga (CLAUDE.md §2). */
  cuerpo: readonly string[];
  /** Sin este consentimiento no se puede usar la camara. */
  obligatorio: boolean;
  /** `false` hasta que exista el reloj: no se pide un consentimiento para algo que no existe. */
  activo: boolean;
}

export const CATALOGO_CONSENTIMIENTOS: readonly TextoConsentimiento[] = [
  {
    tipo: "camara",
    titulo: "Uso de la camara",
    cuerpo: [
      "Espinker usa la camara para ver tu postura mientras trabajas.",
      "No se guarda video ni imagenes: cada cuadro se analiza y se descarta en el momento.",
      "Lo que se guarda es un resumen por dia: minutos monitoreados, puntaje promedio y porcentaje de mala postura.",
      "Puedes apagar la camara cuando quieras y retirar este consentimiento desde Ajustes.",
    ],
    obligatorio: true,
    activo: true,
  },
  {
    tipo: "salud",
    titulo: "Datos de salud",
    cuerpo: [
      "Tus antecedentes de salud sirven para no sugerirte pausas que no te convienen.",
      "Son datos sensibles: solo los ves tu. Ni tu jefe ni el area de talento humano pueden verlos, ni siquiera sumados con otros.",
      "Espinker no diagnostica ni reemplaza a un profesional de la salud.",
      "Es opcional. Sin este consentimiento puedes usar la aplicacion, pero no se guardaran tus antecedentes.",
    ],
    obligatorio: false,
    activo: true,
  },
  {
    tipo: "reloj",
    titulo: "Reloj de pulsera",
    cuerpo: [
      "El reloj envia su orientacion y tu frecuencia cardiaca, que es un dato de salud.",
      "Se usa para estimar cuanto te mueves y complementar la camara.",
    ],
    obligatorio: false,
    activo: false,
  },
];

export interface FilaConsentimiento {
  tipo: TipoConsentimiento;
  version: string;
  aceptado: boolean;
  /** Orden cronologico; la fila mas reciente de cada tipo manda. */
  creado_en: string;
}

/** Estado vigente: la ultima fila de cada tipo, y solo si es de la version actual. */
export function consentimientosVigentes(
  filas: readonly FilaConsentimiento[],
  version: string = VERSION_CONSENTIMIENTOS,
): Record<TipoConsentimiento, boolean> {
  const vigente: Record<TipoConsentimiento, boolean> = { camara: false, salud: false, reloj: false };
  const ultima = new Map<TipoConsentimiento, FilaConsentimiento>();
  for (const f of filas) {
    const previa = ultima.get(f.tipo);
    if (!previa || f.creado_en >= previa.creado_en) ultima.set(f.tipo, f);
  }
  for (const [tipo, fila] of ultima) vigente[tipo] = fila.aceptado && fila.version === version;
  return vigente;
}

/** Consentimientos obligatorios y activos que todavia no estan aceptados. */
export function consentimientosFaltantes(
  vigentes: Record<TipoConsentimiento, boolean>,
): TextoConsentimiento[] {
  return CATALOGO_CONSENTIMIENTOS.filter((c) => c.activo && c.obligatorio && !vigentes[c.tipo]);
}
