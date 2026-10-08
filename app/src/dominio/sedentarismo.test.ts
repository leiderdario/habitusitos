import { describe, expect, it } from "vitest";
import {
  BOUT_INICIAL,
  BOUT_LARGO_SEGUNDOS,
  avanzarBout,
  calcularMet,
  estimarFcReposo,
} from "./sedentarismo";
import type { EstadoBout, MuestraPulso } from "./sedentarismo";

describe("calcularMet (Wicks)", () => {
  it("da 1 MET en reposo", () => expect(calcularMet(60, 60)).toBe(1));
  it("da 3 MET con pulso 1,33x el de reposo", () => expect(calcularMet(80, 60)).toBeCloseTo(3, 5));
  it("se acota a 1 si el pulso baja del de referencia", () => expect(calcularMet(50, 60)).toBe(1));
  it("devuelve null, no un numero inventado, si falta un dato", () => {
    expect(calcularMet(null, 60)).toBeNull();
    expect(calcularMet(70, null)).toBeNull();
    expect(calcularMet(70, 0)).toBeNull();
  });
});

describe("estimarFcReposo", () => {
  const quieta = (desde: number, hasta: number, fc: number): MuestraPulso[] => {
    const m: MuestraPulso[] = [];
    for (let t = desde; t <= hasta; t += 10) m.push({ t, fcBpm: fc, quieto: true });
    return m;
  };

  it("null si no hay una ventana quieta de al menos 4 min", () => {
    expect(estimarFcReposo(quieta(0, 200, 62))).toBeNull();
  });
  it("usa la mediana de la ventana quieta", () => {
    expect(estimarFcReposo(quieta(0, 250, 62))).toBe(62);
  });
  it("el movimiento reinicia la ventana", () => {
    const m = [...quieta(0, 200, 62), { t: 210, fcBpm: 110, quieto: false }, ...quieta(220, 400, 62)];
    expect(estimarFcReposo(m)).toBeNull();
  });
  it("una muestra sin pulso valido reinicia la ventana", () => {
    const m = [...quieta(0, 200, 62), { t: 210, fcBpm: null, quieto: true }, ...quieta(220, 400, 62)];
    expect(estimarFcReposo(m)).toBeNull();
  });
  it("la mediana ignora un pico suelto", () => {
    const m = quieta(0, 250, 60);
    m[5] = { ...m[5], fcBpm: 140 };
    expect(estimarFcReposo(m)).toBe(60);
  });
});

describe("avanzarBout", () => {
  const correr = (pasos: Array<[number, boolean, number | null]>, ini: EstadoBout = BOUT_INICIAL) =>
    pasos.reduce(
      (e, [t, sentado, met]) => avanzarBout(e, { t, sentado, met }),
      ini,
    );

  it("acumula tiempo sentado", () => {
    expect(correr([[0, true, null], [60, true, null], [120, true, null]]).segundos).toBe(120);
  });
  it("una interrupcion corta no rompe el bout y su tiempo se suma", () => {
    const e = correr([[0, true, null], [100, true, null], [130, false, null], [160, true, null]]);
    expect(e.segundos).toBe(160);
  });
  it("una interrupcion larga cierra el bout", () => {
    const e = correr([[0, true, null], [100, true, null], [130, false, null], [200, false, null]]);
    expect(e.segundos).toBe(0);
  });
  it("cuenta como largo solo el bout cerrado de 60 min o mas", () => {
    const larga = correr([[0, true, null], [BOUT_LARGO_SEGUNDOS, true, null], [BOUT_LARGO_SEGUNDOS + 100, false, null]]);
    expect(larga.boutsLargos).toBe(1);
    const corta = correr([[0, true, null], [600, true, null], [700, false, null]]);
    expect(corta.boutsLargos).toBe(0);
  });
  it("sentado pero con MET alto no es sedentario", () => {
    const e = correr([[0, true, 3], [100, true, 3]]);
    expect(e.segundos).toBe(0);
  });
  it("sentado con MET bajo si lo es", () => {
    expect(correr([[0, true, 1.2], [100, true, 1.2]]).segundos).toBe(100);
  });
});
