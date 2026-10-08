import { describe, expect, it } from "vitest";
import { CAMPOS_RESUMEN_EQUIPO, normalizarResumenEquipo, totalesEquipo } from "./resumen-equipo";

describe("resumen-equipo", () => {
  it("descarta cualquier campo fuera de la lista cerrada (forma cerrada)", () => {
    const [fila] = normalizarResumenEquipo([
      {
        fecha: "2026-10-01", fuentes_activas: "6", minutos_monitoreados: "300.5",
        puntaje_promedio: "70.1", porcentaje_mala_postura: "12.3",
        usuario_id: "x", nombre: "Ana", correo: "a@b.c",
      },
    ]);
    expect(Object.keys(fila).sort()).toEqual([...CAMPOS_RESUMEN_EQUIPO].sort());
    expect(JSON.stringify(fila)).not.toMatch(/Ana|a@b\.c|usuario_id/);
  });
  it("convierte los numeric de Postgres (texto) a numero", () => {
    const [f] = normalizarResumenEquipo([
      { fecha: "d", fuentes_activas: "6", minutos_monitoreados: "300.5", puntaje_promedio: null, porcentaje_mala_postura: "12.3" },
    ]);
    expect(f.minutos_monitoreados).toBe(300.5);
    expect(f.puntaje_promedio).toBeNull();
  });
  it("los totales ponderan por tiempo, no por dia", () => {
    const t = totalesEquipo([
      { fecha: "a", fuentes_activas: 5, minutos_monitoreados: 100, puntaje_promedio: 80, porcentaje_mala_postura: 10 },
      { fecha: "b", fuentes_activas: 5, minutos_monitoreados: 300, puntaje_promedio: 60, porcentaje_mala_postura: 30 },
    ]);
    expect(t.puntajePromedio).toBe(65);
    expect(t.porcentajeMalaPostura).toBe(25);
  });
  it("sin datos devuelve null, no cero", () => {
    expect(totalesEquipo([]).puntajePromedio).toBeNull();
  });
});
