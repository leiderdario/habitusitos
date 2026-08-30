import { describe, expect, it } from "vitest";
import {
  acotar,
  anguloConVertical,
  distanciaMetros,
  norma,
  normalizarVector,
  productoCruz,
  productoPunto,
  puntoCuello,
  calcularCadenaCuello,
  restar,
  rotacionCabeza3D,
  rotarY,
  sumar,
  visiblePara,
} from "./geometria-3d";
import type { Landmark3D } from "./tipos";
import { PUNTO } from "./tipos";

describe("geometria-3d", () => {
  describe("operaciones basicas", () => {
    it("suma y resta de vectores", () => {
      const a = { x: 1, y: 2, z: 3 };
      const b = { x: 4, y: 5, z: 6 };
      expect(sumar(a, b)).toEqual({ x: 5, y: 7, z: 9 });
      expect(restar(b, a)).toEqual({ x: 3, y: 3, z: 3 });
    });

    it("producto punto y producto cruz", () => {
      const a = { x: 1, y: 0, z: 0 };
      const b = { x: 0, y: 1, z: 0 };
      expect(productoPunto(a, b)).toBe(0);
      expect(productoCruz(a, b)).toEqual({ x: 0, y: 0, z: 1 });
    });

    it("norma y normalizacion", () => {
      const v = { x: 0, y: 3, z: 4 };
      expect(norma(v)).toBe(5);
      expect(normalizarVector(v)).toEqual({ x: 0, y: 0.6, z: 0.8 });
      expect(normalizarVector({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("distancia euclidiana en metros", () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 1, y: 2, z: 2 };
      expect(distanciaMetros(a, b)).toBe(3);
    });

    it("acotado de valores", () => {
      expect(acotar(15, 0, 10)).toBe(10);
      expect(acotar(-5, 0, 10)).toBe(0);
      expect(acotar(5, 0, 10)).toBe(5);
    });

    it("puntoCuello calcula el punto medio entre hombros", () => {
      const hIzq = { x: -0.2, y: 0.5, z: 0.1 };
      const hDer = { x: 0.2, y: 0.5, z: 0.1 };
      const cuello = puntoCuello(hIzq, hDer);
      expect(cuello.x).toBeCloseTo(0);
      expect(cuello.y).toBeCloseTo(0.5);
      expect(cuello.z).toBeCloseTo(0.1);
    });

    it("calcularCadenaCuello genera los 3 puntos cervicales (C7 base, C4 medio, C1 tope)", () => {
      const hIzq = { x: -0.2, y: 0.5, z: 0 };
      const hDer = { x: 0.2, y: 0.5, z: 0 };
      const oIzq = { x: -0.08, y: 0.3, z: 0 };
      const oDer = { x: 0.08, y: 0.3, z: 0 };

      const cadena = calcularCadenaCuello(hIzq, hDer, oIzq, oDer);
      // Base C7
      expect(cadena.base.x).toBeCloseTo(0);
      expect(cadena.base.y).toBeCloseTo(0.5);
      // Tope C1
      expect(cadena.tope.x).toBeCloseTo(0);
      expect(cadena.tope.y).toBeCloseTo(0.3);
      // Medio C4
      expect(cadena.medio.x).toBeCloseTo(0);
      expect(cadena.medio.y).toBeCloseTo(0.4);
    });

    it("rotarY rota vectores 3D alrededor del eje vertical Y", () => {
      const v = { x: 1, y: 0, z: 0 };
      const rotado90 = rotarY(v, 90);
      expect(rotado90.x).toBeCloseTo(0);
      expect(rotado90.y).toBe(0);
      expect(rotado90.z).toBeCloseTo(-1);
    });
  });

  describe("visiblePara", () => {
    it("valida correctamente la visibilidad de los indices", () => {
      const puntos: Landmark3D[] = [
        { x: 0, y: 0, z: 0, visibility: 0.9 },
        { x: 0, y: 0, z: 0, visibility: 0.3 },
      ];
      expect(visiblePara(puntos, [0], 0.5)).toBe(true);
      expect(visiblePara(puntos, [0, 1], 0.5)).toBe(false);
      expect(visiblePara(puntos, [99], 0.5)).toBe(false);
    });
  });

  describe("anguloConVertical", () => {
    it("da 0 grados si el vector apunta exactamente en la vertical de referencia", () => {
      const desde = { x: 0, y: 0, z: 0 };
      const hasta = { x: 0, y: -1, z: 0 };
      expect(anguloConVertical(desde, hasta)).toBeCloseTo(0, 1);
    });

    it("da 90 grados si el vector es perpendicular a la vertical de referencia", () => {
      const desde = { x: 0, y: 0, z: 0 };
      const hasta = { x: 1, y: 0, z: 0 };
      expect(anguloConVertical(desde, hasta)).toBeCloseTo(90, 1);
    });

    it("da 180 grados si el vector es opuesto a la vertical de referencia", () => {
      const desde = { x: 0, y: 0, z: 0 };
      const hasta = { x: 0, y: 1, z: 0 };
      expect(anguloConVertical(desde, hasta)).toBeCloseTo(180, 1);
    });

    it("acepta un vector vertical personalizado y calcula respecto a el", () => {
      const verticalPersonal: [number, number, number] = [1, 0, 0];
      const desde = { x: 0, y: 0, z: 0 };
      const hasta = { x: 1, y: 0, z: 0 };
      expect(anguloConVertical(desde, hasta, verticalPersonal)).toBeCloseTo(0, 1);
    });
  });

  describe("rotacionCabeza3D", () => {
    function crearLandmarksFaciales(): Landmark3D[] {
      const puntos: Landmark3D[] = Array.from({ length: 33 }, () => ({
        x: 0,
        y: 0,
        z: 0,
        visibility: 1,
      }));

      // Cara neutra orientada al frente
      puntos[PUNTO.NARIZ] = { x: 0, y: -0.4, z: -0.05, visibility: 1 };
      puntos[PUNTO.OJO_IZQ] = { x: -0.03, y: -0.45, z: -0.02, visibility: 1 };
      puntos[PUNTO.OJO_DER] = { x: 0.03, y: -0.45, z: -0.02, visibility: 1 };
      puntos[PUNTO.OREJA_IZQ] = { x: -0.08, y: -0.43, z: 0, visibility: 1 };
      puntos[PUNTO.OREJA_DER] = { x: 0.08, y: -0.43, z: 0, visibility: 1 };
      puntos[PUNTO.BOCA_IZQ] = { x: -0.02, y: -0.35, z: -0.02, visibility: 1 };
      puntos[PUNTO.BOCA_DER] = { x: 0.02, y: -0.35, z: -0.02, visibility: 1 };

      return puntos;
    }

    it("calcula rotaciones validas y finitas sin NaN", () => {
      const puntos = crearLandmarksFaciales();
      const rot = rotacionCabeza3D(puntos);
      expect(rot).not.toBeNull();
      if (rot) {
        expect(Number.isFinite(rot.pitch)).toBe(true);
        expect(Number.isFinite(rot.yaw)).toBe(true);
        expect(Number.isFinite(rot.roll)).toBe(true);
      }
    });

    it("devuelve null si faltan puntos faciales requeridos", () => {
      const puntosIncompletos: Landmark3D[] = Array.from({ length: 5 }, () => ({
        x: 0,
        y: 0,
        z: 0,
        visibility: 1,
      }));
      expect(rotacionCabeza3D(puntosIncompletos)).toBeNull();
    });
  });
});
