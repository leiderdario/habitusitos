import { describe, expect, it } from "vitest";
import {
  CONFIG_AVISO_PAUSA_POR_DEFECTO as CFG,
  elegirPausa,
  estadoAvisoInicial,
  evaluarAviso,
  responderAviso,
} from "./pausas-activas";
import { ANTECEDENTES_VACIOS } from "./tipos";
import type { AntecedentesSalud } from "./tipos";

const ant = (parcial: Partial<AntecedentesSalud>): AntecedentesSalud => ({
  usuario_id: "u",
  actualizado_en: null,
  ...ANTECEDENTES_VACIOS,
  ...parcial,
});

describe("elegirPausa", () => {
  it("propone estiramiento de muneca sin antecedentes", () => {
    expect(elegirPausa("muneca", ant({})).id).toBe("estiramiento_muneca");
  });
  it("no propone ejercicio de muneca con tunel carpiano: cae a caminar", () => {
    expect(elegirPausa("muneca", ant({ tunel_carpiano: true })).id).toBe("caminar");
  });
  it("excluye por ferula o cirugia de mano", () => {
    expect(elegirPausa("muneca", ant({ usa_ferulas: true })).id).toBe("caminar");
    expect(elegirPausa("muneca", ant({ cirugia_mano_muneca: true })).id).toBe("caminar");
  });
  it("excluye movilidad de espalda con embarazo", () => {
    expect(elegirPausa("espalda", ant({ embarazo: true })).id).toBe("caminar");
  });
  it("sin antecedentes cargados (null) propone la de la zona", () => {
    expect(elegirPausa("cuello", null).id).toBe("estiramiento_cuello_suave");
  });
});

describe("evaluarAviso", () => {
  it("no avisa antes del bout configurado", () => {
    expect(evaluarAviso(estadoAvisoInicial(), 60, 60, true).avisar).toBeNull();
  });
  it("con reloj avisa primero en el reloj", () => {
    expect(evaluarAviso(estadoAvisoInicial(), CFG.boutAvisoSegundos, 100, true).avisar).toBe("reloj");
  });
  it("sin reloj salta directo a pantalla", () => {
    expect(evaluarAviso(estadoAvisoInicial(), CFG.boutAvisoSegundos, 100, false).avisar).toBe("pantalla");
  });
  it("tras el reloj espera y luego avisa en pantalla, una sola vez", () => {
    const a = evaluarAviso(estadoAvisoInicial(), CFG.boutAvisoSegundos, 100, true);
    const espera = evaluarAviso(a.estado, CFG.boutAvisoSegundos, 110, true);
    expect(espera.avisar).toBeNull();
    const b = evaluarAviso(espera.estado, CFG.boutAvisoSegundos, 100 + CFG.esperaPantallaSegundos, true);
    expect(b.avisar).toBe("pantalla");
    expect(evaluarAviso(b.estado, CFG.boutAvisoSegundos, 400, true).avisar).toBeNull();
  });
});

describe("responderAviso", () => {
  it("posponer vuelve a avisar tras la posposicion", () => {
    const e = responderAviso("pospuesta", 3000);
    expect(e.proximoAvisoEnBout).toBe(3000 + CFG.posposicionSegundos);
    expect(evaluarAviso(e, 3000, 1, true).avisar).toBeNull();
    expect(evaluarAviso(e, 3000 + CFG.posposicionSegundos, 1, true).avisar).toBe("reloj");
  });
  it("tomar la pausa rearma desde el bout inicial", () => {
    expect(responderAviso("tomada", 3000).proximoAvisoEnBout).toBe(CFG.boutAvisoSegundos);
  });
  it("ignorar no insiste mas rapido que posponer", () => {
    expect(responderAviso("ignorada", 3000).proximoAvisoEnBout).toBe(
      responderAviso("pospuesta", 3000).proximoAvisoEnBout,
    );
  });
});
