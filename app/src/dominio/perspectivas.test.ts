import { describe, expect, it } from "vitest";
import {
  aplicarPerspectivaAPose,
  calibrarVectorArriba,
  OPCIONES_PERSPECTIVA,
} from "./perspectivas";
import type { Landmark3D } from "./tipos";
import { PUNTO } from "./tipos";

describe("perspectivas", () => {
  function crearEsqueleto3D(inclinacionY = -1, inclinacionZ = 0): Landmark3D[] {
    const puntos: Landmark3D[] = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0.95,
    }));

    // Caderas en el origen
    puntos[PUNTO.CADERA_IZQ] = { x: -0.15, y: 0, z: 0, visibility: 0.95 };
    puntos[PUNTO.CADERA_DER] = { x: 0.15, y: 0, z: 0, visibility: 0.95 };

    // Hombros a lo largo del vector inclinacion
    puntos[PUNTO.HOMBRO_IZQ] = { x: -0.18, y: inclinacionY * 0.4, z: inclinacionZ * 0.4, visibility: 0.95 };
    puntos[PUNTO.HOMBRO_DER] = { x: 0.18, y: inclinacionY * 0.4, z: inclinacionZ * 0.4, visibility: 0.95 };

    // Orejas mas arriba en la misma linea
    puntos[PUNTO.OREJA_IZQ] = { x: -0.08, y: inclinacionY * 0.6, z: inclinacionZ * 0.6, visibility: 0.95 };
    puntos[PUNTO.OREJA_DER] = { x: 0.08, y: inclinacionY * 0.6, z: inclinacionZ * 0.6, visibility: 0.95 };

    return puntos;
  }

  it("calibra un vector vertical apuntando hacia arriba en postura recta", () => {
    const puntos = crearEsqueleto3D(-1, 0);
    const vec = calibrarVectorArriba(puntos, 0.4);
    expect(vec).not.toBeNull();
    if (vec) {
      expect(vec[0]).toBeCloseTo(0, 1);
      expect(vec[1]).toBeCloseTo(-1, 1);
      expect(vec[2]).toBeCloseTo(0, 1);
    }
  });

  it("captura la orientacion inclinada del torso con laptop o camara en angulo", () => {
    // Esqueleto con inclinacion hacia adelante/arriba
    const puntos = crearEsqueleto3D(-0.8, -0.6);
    const vec = calibrarVectorArriba(puntos, 0.4);
    expect(vec).not.toBeNull();
    if (vec) {
      expect(vec[1]).toBeLessThan(0);
      expect(vec[2]).toBeLessThan(0);
      // La norma debe ser 1 (vector unitario)
      const norma = Math.hypot(vec[0], vec[1], vec[2]);
      expect(norma).toBeCloseTo(1, 4);
    }
  });

  it("devuelve null si la visibilidad es insuficiente en puntos criticos", () => {
    const puntos = crearEsqueleto3D(-1, 0);
    puntos[PUNTO.HOMBRO_IZQ].visibility = 0.2; // debajo del umbral 0.4
    const vec = calibrarVectorArriba(puntos, 0.4);
    expect(vec).toBeNull();
  });

  it("devuelve null si los puntos son nulos o incompletos", () => {
    expect(calibrarVectorArriba([], 0.4)).toBeNull();
  });
});


describe("OPCIONES_PERSPECTIVA", () => {
  it("contiene exactamente las 3 opciones de angulo horizontal requeridas", () => {
    expect(OPCIONES_PERSPECTIVA).toHaveLength(3);
    const etiquetas = OPCIONES_PERSPECTIVA.map((o) => o.etiqueta);
    expect(etiquetas).toContain("Al frente");
    expect(etiquetas).toContain("Al lado");
    expect(etiquetas).toContain("En diagonal");
  });
});

describe("aplicarPerspectivaAPose", () => {
  it("mantiene intacta la pose en perspectiva frente (0 grados)", () => {
    const pose = {
      landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }],
      worldLandmarks: [{ x: 0.2, y: -0.4, z: 0.1, visibility: 1 }],
    };
    const res = aplicarPerspectivaAPose(pose, "frente");
    expect(res.worldLandmarks?.[0].x).toBeCloseTo(0.2);
    expect(res.worldLandmarks?.[0].z).toBeCloseTo(0.1);
  });

  it("rota adecuadamente los worldLandmarks en perspectiva lado (90 grados)", () => {
    const pose = {
      landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }],
      worldLandmarks: [{ x: 1, y: 0, z: 0, visibility: 1 }],
    };
    const res = aplicarPerspectivaAPose(pose, "lado");
    // Rotar 1, 0, 0 por -90 grados alrededor de Y
    expect(res.worldLandmarks?.[0].x).toBeCloseTo(0);
    expect(res.worldLandmarks?.[0].z).toBeCloseTo(1);
  });
});
