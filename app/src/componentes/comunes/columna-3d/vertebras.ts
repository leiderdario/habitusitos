/**
 * Codigos de las mallas de public/3d/columna.glb y su nombre legible.
 *
 * Aporte propio de Espinker. Es el contrato entre el modelo (generado por
 * herramientas/3d/exportar_columna.py) y la interaccion del login: cada malla se
 * llama exactamente como su codigo. vertebras.test.ts lee el .glb y falla si un
 * reexporte cambia un nombre.
 *
 * En pantalla se muestra el nombre en espanol, no solo el codigo: "T7" no le
 * dice nada a quien no estudio anatomia.
 */

const CERVICALES = Array.from({ length: 7 }, (_, i) => `C${i + 1}`);
const TORACICAS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
const LUMBARES = Array.from({ length: 5 }, (_, i) => `L${i + 1}`);

export const CODIGOS_VERTEBRAS: readonly string[] = [
  ...CERVICALES,
  ...TORACICAS,
  ...LUMBARES,
  "Sacro",
];

const REGION: Record<string, string> = { C: "cervical", T: "torácica", L: "lumbar" };

/** "T7" -> "Vértebra torácica 7 · T7"; "C1" -> "Atlas · C1"; "Sacro" -> "Sacro". */
export function nombreVertebra(codigo: string): string {
  if (codigo === "Sacro") return "Sacro";
  if (codigo === "C1") return "Atlas · C1";
  if (codigo === "C2") return "Axis · C2";
  const region = REGION[codigo[0]];
  return region ? `Vértebra ${region} ${codigo.slice(1)} · ${codigo}` : codigo;
}
