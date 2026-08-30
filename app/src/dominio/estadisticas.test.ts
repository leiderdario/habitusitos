import { describe, expect, it } from "vitest";
import type { DiaHistorial, MuestraPuntaje } from "./tipos";
import {
  decliveReciente,
  promedioMovil,
  promedioPorDiaSemana,
  resumirEnPalabras,
  resumirSesion,
  tendenciaPorSemana,
} from "./estadisticas";

/** Serie a 1 muestra por segundo. `null` = frame sin persona detectada. */
function serie(scores: readonly (number | null)[]): MuestraPuntaje[] {
  return scores.map((score, t) => ({
    t,
    score: score ?? 0,
    detectado: score !== null,
  }));
}

describe("resumirSesion", () => {
  it("devuelve ceros sin datos, en vez de NaN", () => {
    const s = resumirSesion([], 65);
    expect(s.promedio).toBe(0);
    expect(Number.isNaN(s.promedio)).toBe(false);
  });

  it("calcula promedio, minimo y maximo sobre las muestras detectadas", () => {
    const s = resumirSesion(serie([80, 60, 100]), 65);
    expect(s.muestras).toBe(3);
    expect(s.promedio).toBeCloseTo(80, 6);
    expect(s.minimo).toBe(60);
    expect(s.maximo).toBe(100);
  });

  it("excluye del promedio los frames sin persona", () => {
    // Contarlos como 0 hundiria el promedio y le diria al usuario que su postura
    // empeoro cuando lo unico que hizo fue levantarse.
    const s = resumirSesion(serie([90, null, null, 90]), 65);
    expect(s.muestras).toBe(2);
    expect(s.promedio).toBe(90);
  });

  it("la pausa no rompe la racha ni suma a la duracion activa", () => {
    const s = resumirSesion(serie([90, 90, null, null, 90, 90]), 65);
    // 5 transiciones de 1 s, pero dos son hacia frames no detectados.
    expect(s.duracionActivaSegundos).toBe(3);
    expect(s.mejorRachaSegundos).toBe(3);
  });

  it("reinicia la racha cuando el puntaje cae bajo el umbral", () => {
    const s = resumirSesion(serie([90, 90, 90, 40, 90, 90]), 65);
    expect(s.mejorRachaSegundos).toBe(2);
    expect(s.rachaActualSegundos).toBe(2);
  });

  it("descarta saltos grandes: el equipo suspendido no cuenta como sesion", () => {
    // Prompt maestro seccion 10: al reanudar tras suspender, la sesion no debe
    // reportar datos corruptos.
    const muestras: MuestraPuntaje[] = [
      { t: 0, score: 90, detectado: true },
      { t: 1, score: 90, detectado: true },
      { t: 7200, score: 90, detectado: true }, // dos horas suspendido
      { t: 7201, score: 90, detectado: true },
    ];
    const s = resumirSesion(muestras, 65);
    expect(s.duracionActivaSegundos).toBe(2);
  });

  it("la proporcion de buena postura esta en [0,1]", () => {
    const s = resumirSesion(serie([90, 90, 40, 40]), 65);
    expect(s.proporcionBuenaPostura).toBeGreaterThanOrEqual(0);
    expect(s.proporcionBuenaPostura).toBeLessThanOrEqual(1);
    expect(s.proporcionBuenaPostura).toBeCloseTo(1 / 3, 6);
  });
});

describe("promedioMovil", () => {
  it("suaviza sin cambiar la longitud de la serie", () => {
    const r = promedioMovil([10, 20, 30, 40], 2);
    expect(r).toHaveLength(4);
    expect(r[0]).toBe(10);
    expect(r[3]).toBeCloseTo(35, 6);
  });

  it("con ventana 1 devuelve la serie original", () => {
    expect(promedioMovil([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});

describe("decliveReciente", () => {
  it("devuelve null si no hay muestras suficientes", () => {
    // Es honesto decir "todavia no se" en vez de devolver 0 y que la interfaz lo
    // lea como "todo estable".
    expect(decliveReciente(serie([90, 90]), 10)).toBeNull();
  });

  it("es positivo cuando la postura empeora dentro de la sesion", () => {
    const s = serie([90, 90, 90, 90, 90, 90, 60, 60, 60, 60]);
    const d = decliveReciente(s, 4);
    expect(d).not.toBeNull();
    expect(d as number).toBeGreaterThan(20);
  });

  it("es negativo o cercano a cero cuando la postura mejora", () => {
    const s = serie([60, 60, 60, 60, 60, 60, 90, 90, 90, 90]);
    expect(decliveReciente(s, 4) as number).toBeLessThan(0);
  });
});

const dia = (fecha: string, promedio: number | null, minutos = 120): DiaHistorial => ({
  fecha,
  promedio,
  minutosActivos: minutos,
  esFestivo: false,
});

describe("promedioPorDiaSemana", () => {
  it("devuelve siempre los siete dias, empezando en lunes", () => {
    const r = promedioPorDiaSemana([dia("2026-07-27", 80)]);
    expect(r).toHaveLength(7);
    expect(r[0].etiqueta).toBe("Lunes");
    expect(r[6].etiqueta).toBe("Domingo");
  });

  it("asigna cada fecha a su dia real de la semana", () => {
    // 2026-07-27 es lunes; 2026-07-31 es viernes.
    const r = promedioPorDiaSemana([dia("2026-07-27", 80), dia("2026-07-31", 50)]);
    expect(r[0].promedio).toBe(80);
    expect(r[4].promedio).toBe(50);
  });

  it("ignora los dias sin uso en vez de contarlos como cero", () => {
    const r = promedioPorDiaSemana([dia("2026-07-27", 80), dia("2026-08-03", null)]);
    expect(r[0].promedio).toBe(80);
  });
});

describe("tendenciaPorSemana", () => {
  it("agrupa por semana ISO y ordena cronologicamente", () => {
    const r = tendenciaPorSemana([
      dia("2026-07-27", 70), // lunes
      dia("2026-08-02", 90), // domingo de la misma semana
      dia("2026-08-03", 60), // lunes siguiente
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].semana).toBe("2026-07-27");
    expect(r[0].promedio).toBe(80);
    expect(r[1].semana).toBe("2026-08-03");
  });
});

describe("resumirEnPalabras", () => {
  it("dice que no hay datos en vez de mostrar ceros", () => {
    const texto = resumirEnPalabras(resumirSesion([], 65), null);
    expect(texto).toContain("Todavia no hay datos");
  });

  it("traduce las cifras a una frase en espanol, sin jerga tecnica", () => {
    const texto = resumirEnPalabras(resumirSesion(serie([90, 90, 90, 90]), 65), 6);
    expect(texto).toMatch(/buena postura/);
    expect(texto).toMatch(/mejor que ayer/);
    for (const jerga of ["landmark", "EMA", "CLAHE", "score", "baseline"]) {
      expect(texto.toLowerCase()).not.toContain(jerga.toLowerCase());
    }
  });

  it("no exagera diferencias despreciables con ayer", () => {
    const texto = resumirEnPalabras(resumirSesion(serie([90, 90, 90]), 65), 1);
    expect(texto).toContain("parecido a ayer");
  });
});
