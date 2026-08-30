/**
 * La regla de arquitectura, verificada automaticamente.
 *
 * Una regla de dependencias que solo vive en un README se rompe en la tercera
 * semana y nadie se entera. Esto la convierte en un test: si alguien importa
 * React dentro de `dominio/`, o mete `datos/almacen.ts` en un componente, la
 * suite se pone roja con el archivo y la linea.
 *
 * Se implementa aqui, y no con ESLint + eslint-plugin-import, a proposito:
 * son ~80 lineas sin dependencias nuevas, corre con el resto de los tests, y el
 * mensaje de error explica POR QUE existe la regla en vez de escupir un codigo.
 *
 * La justificacion de cada capa esta en ../docs/ARQUITECTURA.md.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname);

/** Capas en orden. Una capa solo puede importar de capas ANTERIORES o de si misma. */
const CAPAS = [
  "config",
  "dominio",
  "datos",
  "camara",
  "componentes",
  "funcionalidades",
] as const;

type Capa = (typeof CAPAS)[number];

/** Modulos transversales que cualquier capa puede usar. */
const TRANSVERSALES = ["utils", "lib", "estado"];

/**
 * Excepciones justificadas al orden estricto de capas.
 * Cada una lleva su razon: sin razon escrita, no se anade la excepcion.
 */
const EXCEPCIONES: Record<string, string[]> = {
  // El estado de UI necesita los tipos del dominio para tipar lo que guarda.
  // Es dependencia de tipos, no de logica.
  estado: ["dominio", "config", "datos"],
  utils: ["config", "dominio"],
};

function listarArchivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...listarArchivos(ruta));
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      salida.push(ruta);
    }
  }
  return salida;
}

/** Extrae las rutas de todos los `import ... from "..."` y `export ... from "..."`. */
function importsDe(contenido: string): string[] {
  const salida: string[] = [];
  const re = /(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contenido)) !== null) salida.push(m[1]);
  return salida;
}

function capaDe(rutaRelativa: string): string | null {
  return rutaRelativa.split(sep)[0] ?? null;
}

/** Convierte `@/dominio/puntaje` en `dominio`. */
function capaImportada(especificador: string): string | null {
  if (!especificador.startsWith("@/")) return null;
  return especificador.slice(2).split("/")[0] ?? null;
}

const ARCHIVOS = listarArchivos(RAIZ).map((ruta) => ({
  ruta,
  relativa: relative(RAIZ, ruta),
  contenido: readFileSync(ruta, "utf8"),
}));

describe("regla de dependencias entre capas", () => {
  it("encuentra archivos que analizar (si no, el test seria un falso verde)", () => {
    expect(ARCHIVOS.length).toBeGreaterThan(10);
  });

  it("ninguna capa importa de una capa posterior", () => {
    const violaciones: string[] = [];

    for (const archivo of ARCHIVOS) {
      const origen = capaDe(archivo.relativa);
      if (!origen) continue;

      const permitidas = EXCEPCIONES[origen];
      const indiceOrigen = CAPAS.indexOf(origen as Capa);

      for (const especificador of importsDe(archivo.contenido)) {
        const destino = capaImportada(especificador);
        if (!destino || destino === origen) continue;
        if (TRANSVERSALES.includes(destino)) continue;
        if (permitidas?.includes(destino)) continue;

        const indiceDestino = CAPAS.indexOf(destino as Capa);
        if (indiceOrigen === -1 || indiceDestino === -1) continue;

        if (indiceDestino > indiceOrigen) {
          violaciones.push(
            `${archivo.relativa} (capa "${origen}") importa "${especificador}" (capa "${destino}"). ` +
              `El flujo permitido es ${CAPAS.join(" -> ")}.`,
          );
        }
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });

  it("`dominio/` no importa nada externo: debe poder traducirse a Python tal cual", () => {
    const violaciones: string[] = [];

    for (const archivo of ARCHIVOS) {
      if (capaDe(archivo.relativa) !== "dominio") continue;

      for (const especificador of importsDe(archivo.contenido)) {
        const esInternoDelDominio =
          especificador.startsWith("./") || especificador.startsWith("@/dominio/");
        if (esInternoDelDominio) continue;

        violaciones.push(
          `${archivo.relativa} importa "${especificador}". La capa dominio/ es logica pura: ` +
            `sin React, sin librerias, sin config. Es lo unico que el desarrollador real ` +
            `puede portar a Python linea por linea.`,
        );
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });

  it("ninguna funcionalidad importa de otra funcionalidad", () => {
    const violaciones: string[] = [];

    for (const archivo of ARCHIVOS) {
      const partes = archivo.relativa.split(sep);
      if (partes[0] !== "funcionalidades") continue;
      const propia = partes[1];

      for (const especificador of importsDe(archivo.contenido)) {
        if (!especificador.startsWith("@/funcionalidades/")) continue;
        const ajena = especificador.split("/")[2];
        if (ajena && ajena !== propia) {
          violaciones.push(
            `${archivo.relativa} importa de la funcionalidad "${ajena}". ` +
              `Si algo se comparte entre pantallas, sube a componentes/comunes/.`,
          );
        }
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });

  it("la interfaz nunca toca los datos simulados directamente", () => {
    // Todo pasa por datos/api/*, que es lo que manana sera una llamada HTTP o
    // una consulta a SQLite. Si una pantalla lee la fixture directo, migrar al
    // backend real obliga a reescribir esa pantalla.
    const violaciones: string[] = [];

    for (const archivo of ARCHIVOS) {
      const capa = capaDe(archivo.relativa);
      if (capa !== "componentes" && capa !== "funcionalidades") continue;

      for (const especificador of importsDe(archivo.contenido)) {
        const prohibido =
          especificador.startsWith("@/datos/fixtures") ||
          especificador === "@/datos/almacen" ||
          especificador === "@/datos/semilla";
        if (prohibido) {
          violaciones.push(
            `${archivo.relativa} importa "${especificador}". Las pantallas piden datos a ` +
              `@/datos/api/*, igual que se los pedirian a un servidor.`,
          );
        }
      }
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});

describe("reglas de estilo verificables", () => {
  it("ningun componente escribe un color en crudo", () => {
    // Regla dura declarada en index.css. Todo color sale de un token semantico:
    // sin esto el modo oscuro y el contraste AA se rompen a pedazos.
    const violaciones: string[] = [];
    const reColor = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

    for (const archivo of ARCHIVOS) {
      const capa = capaDe(archivo.relativa);
      if (capa !== "componentes" && capa !== "funcionalidades") continue;
      // Las primitivas de shadcn/ui son codigo de terceros vendorizado.
      if (archivo.relativa.includes(`components${sep}ui`)) continue;

      archivo.contenido.split("\n").forEach((linea, i) => {
        if (linea.trimStart().startsWith("//")) return;
        if (reColor.test(linea)) {
          violaciones.push(`${archivo.relativa}:${i + 1} → ${linea.trim()}`);
        }
      });
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });

  it("nada usa Math.random ni new Date() sin argumentos", () => {
    // Dos demostraciones consecutivas tienen que verse identicas. Si el cliente
    // pide "muestrame otra vez lo del baseline" y salen numeros distintos, la
    // demo pierde el hilo. El azar sale de datos/semilla.ts y el tiempo de
    // config.ANCLA_UTC.
    const violaciones: string[] = [];

    for (const archivo of ARCHIVOS) {
      if (archivo.relativa.includes(`components${sep}ui`)) continue;
      // semilla.ts es la unica fuente de azar autorizada; utils/formato.ts es la
      // unica que puede leer el reloj real, para el sello de "generado el ...".
      if (/^datos.semilla\.ts$/.test(archivo.relativa)) continue;

      archivo.contenido.split("\n").forEach((linea, i) => {
        if (linea.trimStart().startsWith("//") || linea.trimStart().startsWith("*")) return;
        if (/Math\.random\(\)/.test(linea) || /new Date\(\s*\)/.test(linea)) {
          violaciones.push(`${archivo.relativa}:${i + 1} → ${linea.trim()}`);
        }
      });
    }

    expect(violaciones, violaciones.join("\n")).toEqual([]);
  });
});
