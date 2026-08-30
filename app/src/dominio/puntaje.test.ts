import { describe, expect, it } from "vitest";
import { PESOS_POR_DEFECTO, UMBRALES_POR_DEFECTO } from "@/config/app.config";
import {
  ORDEN_METRICAS,
  calcularMetricas,
  calcularMetricasConDisponibilidad,
  calcularPuntaje,
  evaluarFrame,
  normalizarPesos,
} from "./puntaje";
import { PUNTO } from "./tipos";
import {
  POSTURA_ENCORVADA,
  POSTURA_LADEADA,
  POSTURA_PERFECTA,
  SIN_DESVIACION,
  construirEsqueleto,
} from "./postura-de-prueba";

const U = UMBRALES_POR_DEFECTO;
const P = PESOS_POR_DEFECTO;

describe("calcularMetricas", () => {
  it("da 1.0 en las siete metricas con la postura ideal", () => {
    const m = calcularMetricas(POSTURA_PERFECTA, U);
    for (const nombre of ORDEN_METRICAS) {
      expect(m[nombre], `metrica ${nombre}`).toBeCloseTo(1, 5);
    }
  });

  it("mantiene toda metrica dentro de [0,1] ante desviaciones extremas", () => {
    // Verifica el `clip`: una desviacion absurda no puede producir un valor
    // negativo que luego reste puntos a las demas metricas en el producto punto.
    const m = calcularMetricas(
      construirEsqueleto({
        cabezaAdelante: 3,
        cuelloGrados: 80,
        desnivelHombros: 0.5,
        giroTorso: 0.9,
        columnaGrados: 75,
        giroCabeza: 0.95,
        ladeoCabeza: 0.6,
      }),
      U,
    );
    for (const nombre of ORDEN_METRICAS) {
      expect(m[nombre], `metrica ${nombre}`).toBeGreaterThanOrEqual(0);
      expect(m[nombre], `metrica ${nombre}`).toBeLessThanOrEqual(1);
    }
  });

  it("aisla cada desviacion en su propia metrica", () => {
    // Si una desviacion contamina metricas que no le corresponden, el desglose
    // del panel mentiria sobre POR QUE bajo el puntaje.
    const casos = [
      { campo: "cabezaAdelante", valor: 0.2, metrica: "inclinacionCabeza" },
      { campo: "desnivelHombros", valor: 0.03, metrica: "nivelHombros" },
      { campo: "giroTorso", valor: 0.06, metrica: "rotacionHombros" },
      { campo: "giroCabeza", valor: 0.25, metrica: "rotacionCabeza" },
      { campo: "ladeoCabeza", valor: 0.03, metrica: "inclinacionLateralCabeza" },
    ] as const;

    for (const caso of casos) {
      const m = calcularMetricas(
        construirEsqueleto({ ...SIN_DESVIACION, [caso.campo]: caso.valor }),
        U,
      );
      expect(m[caso.metrica], `${caso.campo} deberia bajar ${caso.metrica}`).toBeLessThan(
        0.95,
      );
      for (const otra of ORDEN_METRICAS) {
        if (otra === caso.metrica) continue;
        expect(
          m[otra],
          `${caso.campo} no deberia afectar a ${otra}`,
        ).toBeCloseTo(1, 3);
      }
    }
  });

  it("detecta el encorvamiento en cuello y columna", () => {
    const m = calcularMetricas(POSTURA_ENCORVADA, U);
    expect(m.cuelloVertical).toBeLessThan(0.6);
    expect(m.alineacionColumna).toBeLessThan(0.6);
    expect(m.inclinacionCabeza).toBeLessThan(0.7);
  });

  it("es mas sensible cuando el umbral es mas estricto", () => {
    const esqueleto = construirEsqueleto({ ...SIN_DESVIACION, cuelloGrados: 15 });
    const laxo = calcularMetricas(esqueleto, { ...U, cuelloVertical: 60 });
    const estricto = calcularMetricas(esqueleto, { ...U, cuelloVertical: 20 });
    expect(estricto.cuelloVertical).toBeLessThan(laxo.cuelloVertical);
  });

  it("el offset de la postura neutra cancela la cabeza adelantada natural", () => {
    // Una persona cuyo rostro esta, por su posicion frente a la camara, mas
    // cerca que sus orejas. Sin calibracion la metrica 1 cae; con el offset
    // igual a esa distancia, la metrica vuelve a ~1.
    const esqueleto = construirEsqueleto({ ...SIN_DESVIACION, cabezaAdelante: 0.2 });
    const sinOffset = calcularMetricas(esqueleto, U);
    expect(sinOffset.inclinacionCabeza).toBeLessThan(0.95);

    const offset = Math.abs(
      esqueleto[PUNTO.NARIZ].z - (esqueleto[PUNTO.OREJA_IZQ].z + esqueleto[PUNTO.OREJA_DER].z) / 2,
    );
    const conOffset = calcularMetricas(esqueleto, U, offset);
    expect(conOffset.inclinacionCabeza).toBeCloseTo(1, 5);
    // Solo cambia la metrica 1; el resto queda intacto.
    for (const otra of ORDEN_METRICAS) {
      if (otra === "inclinacionCabeza") continue;
      expect(conOffset[otra]).toBeCloseTo(sinOffset[otra], 6);
    }
  });

  it("un offset mayor que la desviacion no dispara la metrica por encima de 1", () => {
    // Si la cabeza esta mas cerca que en la calibracion, dz se acota a 0 y la
    // metrica queda en 1, nunca por encima (gracias al acotar).
    const esqueleto = construirEsqueleto({ ...SIN_DESVIACION, cabezaAdelante: 0.1 });
    const m = calcularMetricas(esqueleto, U, 0.3);
    expect(m.inclinacionCabeza).toBeCloseTo(1, 5);
  });

  it("preserva retrocompatibilidad exacta si no se especifica verticalIdeal", () => {
    const esqueleto = construirEsqueleto({ ...SIN_DESVIACION, cuelloGrados: 20 });
    const defaultCall = calcularMetricas(esqueleto, U, 0);
    const explicitCall = calcularMetricas(esqueleto, U, 0, [0, -1, 0]);
    expect(defaultCall).toEqual(explicitCall);
  });

  it("ajusta el angulo del cuello y columna al usar un vectorArriba calibrado", () => {
    // Si el usuario esta inclinado 20 grados pero calibro su vectorArriba en esa misma inclinacion
    const esqueleto = construirEsqueleto({ ...SIN_DESVIACION, cuelloGrados: 20, columnaGrados: 20 });
    const sinCalibrar = calcularMetricas(esqueleto, U, 0);
    expect(sinCalibrar.cuelloVertical).toBeLessThan(0.8);

    // Con vector vertical alineado al usuario inclinado
    const rad = (20 * Math.PI) / 180;
    const vectorInclinado: [number, number, number] = [0, -Math.cos(rad), -Math.sin(rad)];
    const calibrado = calcularMetricas(esqueleto, U, 0, vectorInclinado);
    expect(calibrado.cuelloVertical).toBeGreaterThan(sinCalibrar.cuelloVertical);
  });
});

describe("normalizarPesos", () => {
  it("normaliza a suma 1 conservando las proporciones", () => {
    const n = normalizarPesos([2, 2, 1.5, 1.5, 1.5, 1, 0.5]);
    expect(n.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(n).toEqual(normalizarPesos(P));
  });

  it("rechaza vectores invalidos en vez de producir puntajes silenciosamente malos", () => {
    expect(() => normalizarPesos([1, 2, 3])).toThrow();
    expect(() => normalizarPesos([1, 1, 1, 1, 1, 1, -1])).toThrow();
    expect(() => normalizarPesos([0, 0, 0, 0, 0, 0, 0])).toThrow();
    expect(() => normalizarPesos([1, 1, 1, 1, 1, 1, NaN])).toThrow();
  });
});

describe("calcularPuntaje", () => {
  it("da 100 con la postura ideal", () => {
    const r = calcularPuntaje(calcularMetricas(POSTURA_PERFECTA, U), P);
    expect(r.puntaje).toBeCloseTo(100, 3);
  });

  it("los aportes suman el puntaje", () => {
    const r = calcularPuntaje(calcularMetricas(POSTURA_ENCORVADA, U), P);
    const suma = ORDEN_METRICAS.reduce((a, n) => a + r.aportes[n], 0);
    expect(suma).toBeCloseTo(r.puntaje, 6);
  });

  it("respeta el peso relativo de cada metrica", () => {
    // El cuello pesa 0.20 y el ladeo de cabeza 0.05: la misma caida relativa en
    // el cuello debe costar cuatro veces mas puntos.
    const metricas = calcularMetricas(POSTURA_PERFECTA, U);
    const conCuelloMalo = calcularPuntaje({ ...metricas, cuelloVertical: 0 }, P);
    const conLadeoMalo = calcularPuntaje(
      { ...metricas, inclinacionLateralCabeza: 0 },
      P,
    );
    expect(100 - conCuelloMalo.puntaje).toBeCloseTo(20, 5);
    expect(100 - conLadeoMalo.puntaje).toBeCloseTo(5, 5);
  });

  it("ordena las posturas de mejor a peor como espera un humano", () => {
    const p = (puntos: typeof POSTURA_PERFECTA) =>
      calcularPuntaje(calcularMetricas(puntos, U), P).puntaje;
    expect(p(POSTURA_PERFECTA)).toBeGreaterThan(p(POSTURA_LADEADA));
    expect(p(POSTURA_LADEADA)).toBeGreaterThan(p(POSTURA_ENCORVADA));
  });
});

describe("evaluarFrame", () => {
  it("devuelve null en vez de lanzar cuando no hay deteccion util", () => {
    // Contrato heredado del proyecto original: un frame problematico nunca puede
    // detener el bucle de camara.
    expect(evaluarFrame(null, U, P)).toBeNull();
    expect(evaluarFrame([], U, P)).toBeNull();
    expect(evaluarFrame(POSTURA_PERFECTA.slice(0, 10), U, P)).toBeNull();
  });

  it("devuelve null si los pesos son invalidos, sin propagar la excepcion", () => {
    expect(evaluarFrame(POSTURA_PERFECTA, U, [0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});


describe("compuerta de visibilidad y disponibilidad", () => {
  it("marca alineacionColumna como no disponible si las caderas no son visibles", () => {
    const esqueleto = POSTURA_PERFECTA.map((p, idx) => {
      if (idx === PUNTO.CADERA_IZQ || idx === PUNTO.CADERA_DER) {
        return { ...p, visibility: 0.1 };
      }
      return p;
    });

    const res = calcularMetricasConDisponibilidad(esqueleto, U, 0, undefined, 0.4);
    expect(res.disponibilidad.alineacionColumna).toBe(false);
    expect(res.disponibilidad.inclinacionCabeza).toBe(true);
    expect(res.disponibilidad.cuelloVertical).toBe(true);
    expect(res.disponibilidad.nivelHombros).toBe(true);
    expect(res.disponibilidad.rotacionHombros).toBe(true);
    expect(res.disponibilidad.rotacionCabeza).toBe(true);
    expect(res.disponibilidad.inclinacionLateralCabeza).toBe(true);
  });

  it("renormaliza pesos entre las metricas disponibles sin penalizar al usuario", () => {
    const metricas = calcularMetricas(POSTURA_PERFECTA, U);
    // Sin columna disponible (las otras 6 en perfecto 1.0)
    const res = calcularPuntaje(metricas, P, {
      alineacionColumna: false,
    });

    expect(res.puntaje).toBeCloseTo(100, 3);
    expect(res.aportes.alineacionColumna).toBe(0);
    const sumaAportes = ORDEN_METRICAS.reduce((a, n) => a + res.aportes[n], 0);
    expect(sumaAportes).toBeCloseTo(100, 3);
  });
});

describe("calcularMetricas con worldLandmarks metricos 3D", () => {
  it("evalua cuelloVertical e inclinacionCabeza con alta precision en 3D", () => {
    // Postura 3D ideal en metros
    const wl3D = POSTURA_PERFECTA.map((p) => ({ ...p, z: 0 }));
    const m = calcularMetricas(POSTURA_PERFECTA, U, 0, undefined, wl3D);
    expect(m.cuelloVertical).toBeGreaterThan(0.9);
    expect(m.inclinacionCabeza).toBeGreaterThan(0.9);
  });

  it("detecta cabeza adelantada por profundidad Z metrica sin falsos positivos en reposo", () => {
    // Cabeza adelantada 10 cm en espacio 3D real
    const wl3D = POSTURA_PERFECTA.map((p, idx) => {
      if (idx === PUNTO.OREJA_IZQ || idx === PUNTO.OREJA_DER || idx === PUNTO.NARIZ) {
        return { ...p, z: -0.1 };
      }
      return { ...p, z: 0 };
    });
    const m = calcularMetricas(POSTURA_PERFECTA, U, 0, undefined, wl3D);
    expect(m.inclinacionCabeza).toBeLessThan(0.7);
  });
});
