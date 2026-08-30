import { describe, expect, it } from "vitest";
import type { ConfigAlertas } from "./maquina-estado";
import { avanzar, crearMaquina } from "./maquina-estado";

const CFG: ConfigAlertas = {
  umbralMalaPostura: 60,
  umbralBuenaPostura: 65,
  umbralExcelente: 82,
  segundosSostenidos: 20,
  segundosParaPausa: 2,
  minutosEnfriamiento: 10,
  modoEnfoque: false,
};

/** Corre una secuencia de (puntaje, instante) y devuelve estado + avisos. */
function correr(
  pasos: readonly [number | null, number][],
  cfg: ConfigAlertas = CFG,
) {
  let maquina = crearMaquina();
  const avisos: number[] = [];
  for (const [puntaje, t] of pasos) {
    const r = avanzar(maquina, puntaje, t, cfg);
    maquina = r.estado;
    if (r.emitirNotificacion) avisos.push(t);
  }
  return { maquina, avisos };
}

describe("RF-3 — solo alerta ante mala postura SOSTENIDA", () => {
  it("un movimiento brusco de menos de 2 segundos NO dispara notificacion", () => {
    // Criterio de aceptacion literal del RF-3: agacharse a recoger algo no puede
    // generar una alerta.
    const { maquina, avisos } = correr([
      [88, 0],
      [30, 1],
      [28, 2],
      [86, 3],
      [90, 4],
    ]);
    expect(avisos).toHaveLength(0);
    expect(maquina.estado).toBe("excelente");
  });

  it("pasa por `vigilando` antes de alertar, nunca directo a `alerta`", () => {
    const estados: string[] = [];
    let maquina = crearMaquina();
    for (let t = 0; t <= 25; t++) {
      maquina = avanzar(maquina, t === 0 ? 90 : 40, t, CFG).estado;
      estados.push(maquina.estado);
    }
    expect(estados[1]).toBe("vigilando");
    expect(estados[19]).toBe("vigilando");
    expect(estados[21]).toBe("alerta");
  });

  it("la mala postura sostenida SI dispara notificacion", () => {
    const pasos: [number | null, number][] = [[90, 0]];
    for (let t = 1; t <= 30; t++) pasos.push([45, t]);
    const { avisos } = correr(pasos);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toBe(21);
  });

  it("respeta el enfriamiento: no repite el aviso dentro de la ventana", () => {
    const pasos: [number | null, number][] = [];
    for (let t = 0; t <= 900; t += 1) pasos.push([40, t]);
    const { avisos } = correr(pasos);
    // 15 minutos de mala postura continua con enfriamiento de 10: dos avisos,
    // no novecientos.
    expect(avisos).toEqual([20, 620]);
  });

  it("el modo enfoque silencia el aviso pero NO oculta el estado", () => {
    const pasos: [number | null, number][] = [];
    for (let t = 0; t <= 40; t++) pasos.push([40, t]);
    const { maquina, avisos } = correr(pasos, { ...CFG, modoEnfoque: true });
    expect(avisos).toHaveLength(0);
    // Silenciar no es mentir: el icono de bandeja sigue reflejando la realidad.
    expect(maquina.estado).toBe("alerta");
  });
});

describe("pausa automatica", () => {
  it("pausa tras 2 segundos sin detectar persona", () => {
    const { maquina } = correr([
      [88, 0],
      [null, 1],
      [null, 2],
      [null, 3],
    ]);
    expect(maquina.estado).toBe("pausa");
  });

  it("no pausa por un frame suelto sin deteccion", () => {
    const { maquina } = correr([
      [88, 0],
      [null, 1],
      [86, 1.5],
    ]);
    expect(maquina.estado).toBe("excelente");
  });

  it("se reanuda sola al volver a detectar", () => {
    const { maquina } = correr([
      [40, 0],
      [null, 1],
      [null, 5],
      [90, 6],
    ]);
    expect(maquina.estado).toBe("excelente");
  });

  it("la ausencia cancela la vigilancia en vez de acumular tiempo", () => {
    // Si el contador de vigilancia siguiera corriendo mientras la persona no
    // esta, volver al escritorio dispararia una alerta inmediata e injusta.
    const { maquina, avisos } = correr([
      [40, 0],
      [40, 5],
      [null, 6],
      [null, 60],
      [40, 61],
      [40, 62],
    ]);
    expect(avisos).toHaveLength(0);
    expect(maquina.estado).toBe("vigilando");
  });
});

describe("umbrales de estado", () => {
  it("distingue excelente de buena", () => {
    expect(correr([[95, 0]]).maquina.estado).toBe("excelente");
    expect(correr([[70, 0]]).maquina.estado).toBe("buena");
  });
});
