import { describe, expect, it } from "vitest";
import {
  CATALOGO_CONSENTIMIENTOS,
  VERSION_CONSENTIMIENTOS as V,
  consentimientosFaltantes,
  consentimientosVigentes,
} from "./consentimientos";

describe("consentimientos", () => {
  it("sin filas, falta la camara (obligatoria) y solo esa", () => {
    const faltan = consentimientosFaltantes(consentimientosVigentes([]));
    expect(faltan.map((c) => c.tipo)).toEqual(["camara"]);
  });
  it("aceptar la version actual la deja vigente", () => {
    const v = consentimientosVigentes([{ tipo: "camara", version: V, aceptado: true, creado_en: "2026-10-01" }]);
    expect(v.camara).toBe(true);
    expect(consentimientosFaltantes(v)).toEqual([]);
  });
  it("una aceptacion de version anterior no vale", () => {
    const v = consentimientosVigentes([{ tipo: "camara", version: "vieja", aceptado: true, creado_en: "2026-10-01" }]);
    expect(v.camara).toBe(false);
  });
  it("retirar el consentimiento (fila mas reciente) lo anula", () => {
    const v = consentimientosVigentes([
      { tipo: "camara", version: V, aceptado: true, creado_en: "2026-10-01" },
      { tipo: "camara", version: V, aceptado: false, creado_en: "2026-10-02" },
    ]);
    expect(v.camara).toBe(false);
  });
  it("manda la fila mas reciente aunque llegue desordenada", () => {
    const v = consentimientosVigentes([
      { tipo: "camara", version: V, aceptado: false, creado_en: "2026-10-02" },
      { tipo: "camara", version: V, aceptado: true, creado_en: "2026-10-01" },
    ]);
    expect(v.camara).toBe(false);
  });
  it("no se pide el consentimiento del reloj mientras no exista el reloj", () => {
    expect(CATALOGO_CONSENTIMIENTOS.find((c) => c.tipo === "reloj")?.activo).toBe(false);
  });
});
