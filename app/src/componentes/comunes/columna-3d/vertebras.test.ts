import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODIGOS_VERTEBRAS, nombreVertebra } from "./vertebras";

/** Lee el bloque JSON de un .glb (cabecera de 12 bytes + bloque JSON). */
function jsonDelGlb(ruta: string): { nodes: { name?: string; mesh?: number }[] } {
  const datos = readFileSync(ruta);
  if (datos.toString("ascii", 0, 4) !== "glTF") throw new Error("No es un .glb");
  const largo = datos.readUInt32LE(12);
  return JSON.parse(datos.toString("utf8", 20, 20 + largo));
}

describe("contrato con public/3d/columna.glb", () => {
  const glb = jsonDelGlb(join(import.meta.dirname, "..", "..", "..", "..", "public", "3d", "columna.glb"));

  it("tiene exactamente una malla por codigo esperado", () => {
    const mallas = glb.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name);
    expect([...mallas].sort()).toEqual([...CODIGOS_VERTEBRAS].sort());
  });
});

describe("nombreVertebra", () => {
  it("da un nombre legible con el codigo al final", () => {
    expect(nombreVertebra("T7")).toBe("Vértebra torácica 7 · T7");
    expect(nombreVertebra("C1")).toBe("Atlas · C1");
    expect(nombreVertebra("L5")).toBe("Vértebra lumbar 5 · L5");
    expect(nombreVertebra("Sacro")).toBe("Sacro");
  });
});
