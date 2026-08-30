/**
 * Contrato del aporte 1 de la tesis.
 *
 * El test central es "no deriva hacia la mala postura": si alguien quita la
 * compuerta de calidad o el congelado en alerta, ESTE archivo se pone rojo. Un
 * test que no falla al revertir el arreglo que cubre no ha probado nada.
 */

import { describe, expect, it } from "vitest";
import type { ConfigBaseline } from "./baseline-adaptativo";
import {
  OPTIMO_ERGONOMICO,
  actualizarBaseline,
  alphaDesdeTau,
  aplicarBaseline,
  crearBaseline,
  derivaActual,
  tauDesdeAlpha,
} from "./baseline-adaptativo";
import { metricasUniformes } from "./postura-de-prueba";
import { ORDEN_METRICAS } from "./puntaje";

const CFG: ConfigBaseline = {
  tauSegundos: 60,
  pisoCalidad: 65,
  derivaMaxima: 0.18,
  activo: true,
};

const DT = 0.2; // 5 muestras por segundo

describe("alphaDesdeTau", () => {
  it("recorre el 63% del camino en un tau", () => {
    expect(alphaDesdeTau(60, 60)).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  it("es la inversa de tauDesdeAlpha", () => {
    const alpha = alphaDesdeTau(DT, 300);
    expect(tauDesdeAlpha(DT, alpha)).toBeCloseTo(300, 6);
  });

  it("compensa el FPS: el mismo tau da la misma velocidad real a 30 y a 12 FPS", () => {
    // Este es el punto entero de derivar alpha de tau en segundos. Se simulan 10
    // segundos a dos tasas distintas y el baseline debe llegar practicamente al
    // mismo sitio.
    const simular = (dt: number) => {
      let valor = 0.6;
      const alpha = alphaDesdeTau(dt, 30);
      for (let t = 0; t < 10; t += dt) valor = alpha * 0.9 + (1 - alpha) * valor;
      return valor;
    };
    expect(simular(1 / 30)).toBeCloseTo(simular(1 / 12), 3);
  });
});

describe("actualizarBaseline — salvaguardas anti-deriva", () => {
  it("SALVAGUARDA 1: una racha larga de mala postura no mueve el baseline", () => {
    // El modo de fallo que hunde todo el aporte. Una hora de encorvamiento
    // sostenido no puede reeducar al sistema para que lo considere normal.
    const inicial = crearBaseline(metricasUniformes(0.9));
    let estado = inicial;

    for (let i = 0; i < 60 * 60 * 5; i++) {
      estado = actualizarBaseline(
        estado,
        metricasUniformes(0.35),
        40, // muy por debajo del piso de calidad
        "vigilando",
        DT,
        CFG,
      ).estado;
    }

    for (const nombre of ORDEN_METRICAS) {
      expect(estado.valores[nombre], `metrica ${nombre}`).toBeCloseTo(0.9, 10);
    }
    expect(estado.aceptadas).toBe(0);
    expect(estado.rechazadas["calidad-insuficiente"]).toBe(60 * 60 * 5);
  });

  it("SALVAGUARDA 2: en estado de alerta no aprende, ni con muestras buenas", () => {
    const estado = crearBaseline(metricasUniformes(0.9));
    const r = actualizarBaseline(estado, metricasUniformes(1), 95, "alerta", DT, CFG);

    expect(r.aceptada).toBe(false);
    expect(r.motivo).toBe("estado-de-alerta");
    expect(r.estado.valores.cuelloVertical).toBeCloseTo(0.9, 10);
    // Se comprueba el ORDEN de las salvaguardas: el estado de alerta manda
    // aunque el puntaje pase el piso de calidad.
    expect(r.estado.rechazadas["calidad-insuficiente"]).toBe(0);
  });

  it("SALVAGUARDA 3: el baseline nunca sale de la banda alrededor del optimo", () => {
    // Aunque fallaran las otras dos, la deriva esta acotada por construccion.
    // Se alimenta con muestras "perfectas" durante mucho tiempo y con muestras
    // apenas aceptables, y en ambos casos debe quedar dentro de la banda.
    for (const valorMuestra of [1, 0.7]) {
      let estado = crearBaseline({ ...OPTIMO_ERGONOMICO });
      for (let i = 0; i < 20000; i++) {
        estado = actualizarBaseline(
          estado,
          metricasUniformes(valorMuestra),
          90,
          "buena",
          DT,
          CFG,
        ).estado;
      }
      for (const nombre of ORDEN_METRICAS) {
        const deriva = Math.abs(estado.valores[nombre] - OPTIMO_ERGONOMICO[nombre]);
        expect(deriva, `metrica ${nombre} con muestra ${valorMuestra}`).toBeLessThanOrEqual(
          CFG.derivaMaxima + 1e-9,
        );
      }
    }
  });

  it("si aprende de variaciones normales de una BUENA postura", () => {
    // La salvaguarda no puede ser tan estricta que anule el aporte: con muestras
    // buenas y sin alerta, el baseline SI debe moverse hacia ellas.
    let estado = crearBaseline(metricasUniformes(0.8));
    for (let i = 0; i < 300 * 5; i++) {
      estado = actualizarBaseline(
        estado,
        metricasUniformes(0.93),
        88,
        "buena",
        DT,
        CFG,
      ).estado;
    }
    expect(estado.aceptadas).toBe(1500);
    expect(estado.valores.cuelloVertical).toBeGreaterThan(0.85);
  });

  it("registra el veredicto de cada muestra para la evidencia de tesis", () => {
    let estado = crearBaseline(metricasUniformes(0.9));
    const veredictos: (string | null)[] = [];

    const guiones = [
      { metricas: 0.95, puntaje: 90, fsm: "buena" },
      { metricas: 0.4, puntaje: 45, fsm: "vigilando" },
      { metricas: 0.95, puntaje: 92, fsm: "alerta" },
    ] as const;

    for (const g of guiones) {
      const r = actualizarBaseline(
        estado,
        metricasUniformes(g.metricas),
        g.puntaje,
        g.fsm,
        DT,
        CFG,
      );
      estado = r.estado;
      veredictos.push(r.motivo);
    }

    expect(veredictos).toEqual([null, "calidad-insuficiente", "estado-de-alerta"]);
  });
});

describe("aplicarBaseline", () => {
  it("no compensa nada si la referencia ya esta en el optimo", () => {
    const ajustadas = aplicarBaseline(metricasUniformes(0.7), { ...OPTIMO_ERGONOMICO });
    expect(ajustadas.cuelloVertical).toBeCloseTo(0.7, 10);
  });

  it("acredita una fraccion de la diferencia, no toda", () => {
    // La razon de ser del aporte: reconocer que no todo el mundo puede sentarse
    // como un maniqui. Pero solo una parte, o la escala pierde su significado.
    const baseline = metricasUniformes(0.75);
    const brecha = OPTIMO_ERGONOMICO.cuelloVertical - 0.75;
    const ajustadas = aplicarBaseline(metricasUniformes(0.75), baseline, 0.6);
    expect(ajustadas.cuelloVertical).toBeCloseTo(0.75 + 0.6 * brecha, 10);
    // Y por tanto NO llega a 1: una postura mediocre no puede puntuar perfecto
    // solo porque la referencia se haya relajado.
    expect(ajustadas.cuelloVertical).toBeLessThan(0.85);
  });

  it("NO convierte una mala postura en aceptable", () => {
    // Este es el test que blinda contra la deriva por la puerta de atras. Con la
    // formulacion ingenua (metrica / referencia), un 0.50 con la referencia en su
    // limite inferior daria 0.69 y pasaria por postura pasable.
    const referenciaEnElLimite = metricasUniformes(
      OPTIMO_ERGONOMICO.cuelloVertical - 0.18,
    );
    const ajustadas = aplicarBaseline(metricasUniformes(0.5), referenciaEnElLimite);
    expect(ajustadas.cuelloVertical).toBeLessThan(0.62);
    // Comparacion explicita con lo que habria dado la version por division.
    expect(ajustadas.cuelloVertical).toBeLessThan(0.5 / (OPTIMO_ERGONOMICO.cuelloVertical - 0.18));
  });

  it("no penaliza a quien tiene una referencia mejor que el optimo", () => {
    const ajustadas = aplicarBaseline(metricasUniformes(0.8), metricasUniformes(1));
    expect(ajustadas.cuelloVertical).toBeCloseTo(0.8, 10);
  });

  it("nunca pasa de 1", () => {
    const ajustadas = aplicarBaseline(metricasUniformes(1), metricasUniformes(0.5));
    expect(ajustadas.cuelloVertical).toBe(1);
  });

  it("se comporta con una referencia degenerada en cero", () => {
    const ajustadas = aplicarBaseline(metricasUniformes(0.6), metricasUniformes(0));
    expect(Number.isFinite(ajustadas.cuelloVertical)).toBe(true);
    expect(ajustadas.cuelloVertical).toBeLessThanOrEqual(1);
  });
});

describe("derivaActual", () => {
  it("es cero cuando el baseline esta en el optimo", () => {
    const d = derivaActual({ ...OPTIMO_ERGONOMICO });
    for (const nombre of ORDEN_METRICAS) expect(d[nombre]).toBeCloseTo(0, 10);
  });

  it("es negativa cuando el baseline se relajo por debajo del optimo", () => {
    const d = derivaActual(metricasUniformes(0.75));
    expect(d.cuelloVertical).toBeLessThan(0);
  });
});
