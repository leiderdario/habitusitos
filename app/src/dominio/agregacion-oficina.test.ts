import { describe, expect, it } from "vitest";
import { agregarOficina, CAMPOS_AGREGADO_OFICINA, proporcionMalaPostura } from "./agregacion-oficina";
import type { EstadoPostural } from "./tipos";

function muestra(estado: EstadoPostural, puntaje: number) {
  return { estado, puntaje };
}

describe("agregarOficina", () => {
  it("nunca produce un campo fuera de la lista permitida", () => {
    const resultado = agregarOficina(
      [muestra("buena", 80), muestra("alerta", 40)],
      2,
      [],
      "2026-01-01T00:00:00.000Z",
    );
    expect(Object.keys(resultado).sort()).toEqual([...CAMPOS_AGREGADO_OFICINA].sort());
  });

  it("no incluye ningun campo de identidad, ni siquiera por accidente", () => {
    const resultado = agregarOficina([muestra("buena", 90)], 1, [], "2026-01-01T00:00:00.000Z");
    const json = JSON.stringify(resultado).toLowerCase();
    for (const prohibido of ["idseguimiento", "track_id", "nombre", "usuario_id"]) {
      expect(json).not.toContain(prohibido);
    }
  });

  it("promedia, encuentra minimo y maximo sobre la ventana recibida", () => {
    const resultado = agregarOficina(
      [muestra("buena", 90), muestra("alerta", 50), muestra("excelente", 100)],
      3,
      [],
      "2026-01-01T00:00:00.000Z",
    );
    expect(resultado.puntajeAgregado.promedio).toBeCloseTo(80, 5);
    expect(resultado.puntajeAgregado.minimo).toBe(50);
    expect(resultado.puntajeAgregado.maximo).toBe(100);
  });

  it("conteoPorEstado cubre los 6 estados aunque la ventana este vacia", () => {
    const resultado = agregarOficina([], 0, [], "2026-01-01T00:00:00.000Z");
    expect(Object.keys(resultado.conteoPorEstado).sort()).toEqual(
      ["alerta", "buena", "excelente", "pausa", "sin-camara", "vigilando"].sort(),
    );
    expect(resultado.puntajeAgregado).toEqual({ promedio: 0, minimo: 0, maximo: 0 });
  });

  it("personasActivas es independiente del tamano de la ventana de muestras", () => {
    // Una ventana de 5 minutos a varios Hz acumula muchas mas muestras que
    // personas hay en el encuadre AHORA MISMO -- no deben confundirse.
    const resultado = agregarOficina(
      [muestra("buena", 90), muestra("buena", 88), muestra("buena", 91)],
      1,
      [],
      "2026-01-01T00:00:00.000Z",
    );
    expect(resultado.personasActivas).toBe(1);
  });
});

describe("proporcionMalaPostura", () => {
  it("dispara la alerta grupal cuando mas de la mitad esta en alerta o vigilando", () => {
    const resultado = agregarOficina(
      [muestra("alerta", 30), muestra("vigilando", 55), muestra("buena", 85)],
      3,
      [],
      "2026-01-01T00:00:00.000Z",
    );
    expect(proporcionMalaPostura(resultado.conteoPorEstado)).toBeCloseTo(2 / 3, 5);
  });

  it("no divide por cero con una ventana vacia", () => {
    const resultado = agregarOficina([], 0, [], "2026-01-01T00:00:00.000Z");
    expect(proporcionMalaPostura(resultado.conteoPorEstado)).toBe(0);
  });
});
