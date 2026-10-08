/**
 * Contraste WCAG 2.2 AA de la paleta, verificado automaticamente.
 *
 * Aporte propio de Espinker. Lee los tokens de index.css (la unica fuente de
 * color) y calcula el contraste de cada par que la interfaz usa de verdad, en
 * los dos temas. Asi cambiar un valor en index.css sin revisar el contraste
 * pone la suite en rojo, en vez de depender de que alguien lo mire a mano.
 *
 * Minimos: 4,5:1 para texto (WCAG 1.4.3) y 3:1 para bordes de controles,
 * iconos y marcas de graficas (WCAG 1.4.11).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Oklch = [number, number, number];

const CSS = readFileSync(join(import.meta.dirname, "index.css"), "utf8");

function tokensDelBloque(selector: string): Record<string, Oklch> {
  const inicio = CSS.indexOf(`\n${selector} {`);
  if (inicio === -1) throw new Error(`No se encontro el bloque ${selector} en index.css`);
  const cuerpo = CSS.slice(inicio, CSS.indexOf("\n}", inicio));
  const tokens: Record<string, Oklch> = {};
  for (const m of cuerpo.matchAll(/--([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g)) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tokens;
}

/** OKLCH -> sRGB lineal (recortado al gamut) -> luminancia relativa. */
function luminancia([L, C, h]: Oklch): number {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const recorta = (x: number) => Math.min(1, Math.max(0, x));
  const r = recorta(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = recorta(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = recorta(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contraste(a: Oklch, b: Oklch): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const TEXTO = 4.5;
const GRAFICO = 3;

/** [primer plano, fondo, minimo]. Solo pares que la interfaz pinta de verdad. */
const PARES: [string, string, number][] = [
  ["foreground", "background", TEXTO],
  ["card-foreground", "card", TEXTO],
  ["muted-foreground", "background", TEXTO],
  ["muted-foreground", "card", TEXTO],
  ["muted-foreground", "muted", TEXTO],
  ["primary-foreground", "primary", TEXTO],
  ["secondary-foreground", "secondary", TEXTO],
  ["accent-foreground", "accent", TEXTO],
  ["destructive", "card", TEXTO],
  ["destructive-foreground", "destructive", TEXTO],
  ["estado-buena", "card", TEXTO],
  ["estado-regular", "card", TEXTO],
  ["estado-corrige", "card", TEXTO],
  ["estado-pausa", "card", TEXTO],
  ["estado-buena", "estado-buena-suave", TEXTO],
  ["estado-regular", "estado-regular-suave", TEXTO],
  ["estado-corrige", "estado-corrige-suave", TEXTO],
  ["estado-pausa", "estado-pausa-suave", TEXTO],
  ["nota", "nota-suave", TEXTO],
  ["sobre-panel", "panel", TEXTO],
  ["panel-suave", "panel", TEXTO],
  ["primary", "card", GRAFICO],
  ["input", "card", GRAFICO],
  ["input", "background", GRAFICO],
  ["ring", "background", GRAFICO],
  ["madera", "background", GRAFICO],
  ["madera", "card", GRAFICO],
  ["chart-1", "card", GRAFICO],
  ["chart-2", "card", GRAFICO],
  ["chart-3", "card", GRAFICO],
  ["chart-4", "card", GRAFICO],
  ["chart-5", "card", GRAFICO],
  ["baseline-linea", "card", GRAFICO],
];

describe.each([
  ["claro", ":root"],
  ["oscuro", ".dark"],
])("contraste AA en modo %s", (_tema, selector) => {
  const tokens = tokensDelBloque(selector);

  it.each(PARES)("%s sobre %s", (frente, fondo, minimo) => {
    expect(tokens[frente], `falta --${frente} en ${selector}`).toBeDefined();
    expect(tokens[fondo], `falta --${fondo} en ${selector}`).toBeDefined();
    expect(contraste(tokens[frente], tokens[fondo])).toBeGreaterThanOrEqual(minimo);
  });
});
