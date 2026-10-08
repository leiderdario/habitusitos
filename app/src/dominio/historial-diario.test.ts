import { describe, expect, it } from "vitest";
import { construirDias, filasExportacion, restarDias } from "./historial-diario";

const fila = (fecha: string, seg: number, ponderado: number, mala: number) => ({
  fecha,
  segundos_monitoreados: seg,
  puntaje_ponderado: ponderado,
  segundos_mala_postura: mala,
});

describe("historial-diario", () => {
  it("resta dias cruzando fin de mes", () => {
    expect(restarDias("2026-03-01", 1)).toBe("2026-02-28");
  });

  it("devuelve una ventana continua terminando hoy, con huecos en null", () => {
    const dias = construirDias([], "2026-10-02", [], 3);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(dias.every((d) => d.promedio === null && d.minutosActivos === 0)).toBe(true);
  });

  it("promedia ponderando por segundos y calcula % de mala postura", () => {
    // 600 s a 80 puntos + 200 s a 40 puntos = 56000 ponderado / 800 s = 70
    const [dia] = construirDias([fila("2026-10-02", 800, 56000, 200)], "2026-10-02", [], 1);
    expect(dia.promedio).toBe(70);
    expect(dia.minutosActivos).toBe(13);
    expect(dia.porcentajeMalaPostura).toBe(25);
  });

  it("marca el festivo sin borrar el uso real de ese dia", () => {
    const [dia] = construirDias(
      [fila("2026-10-02", 600, 48000, 0)],
      "2026-10-02",
      [{ fecha: "2026-10-02", nombre: "Festivo X" }],
      1,
    );
    expect(dia.esFestivo).toBe(true);
    expect(dia.promedio).toBe(80);
  });

  it("la exportacion omite dias sin uso y conserva festivos", () => {
    const dias = construirDias(
      [fila("2026-10-02", 600, 48000, 0)],
      "2026-10-02",
      [{ fecha: "2026-10-01", nombre: "F" }],
      3,
    );
    const filas = filasExportacion(dias);
    expect(filas.map((f) => f.fecha)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(Object.keys(filas[0])).toEqual([
      "fecha",
      "minutos_monitoreados",
      "puntaje_promedio",
      "porcentaje_mala_postura",
      "es_festivo",
    ]);
  });
});
