import { describe, expect, it } from "vitest";
import {
  avanzarClasificacion,
  clasificarPatron,
  ESTADO_CLASIFICACION_INICIAL,
} from "./clasificador-posturas";
import type {
  ConfigClasificacion,
  EstadoClasificacion,
} from "./clasificador-posturas";
import type { FramePose, Landmark3D, MetricasPostura } from "./tipos";
import { PUNTO } from "./tipos";

const CONFIG_PRUEBA: ConfigClasificacion = {
  segundosSostenidos: 3,
  umbralVisibilidad: 0.4,
  umbrales: {
    cuelloAdelantadoGrados: 25,
    encorvamientoGrados: 20,
    reclinacionGrados: 15,
    torsionGrados: 20,
    ladeoGrados: 15,
    distanciaCodoCabezaMetros: 0.15,
  },
};

const METRICAS_OPTIMAS: MetricasPostura = {
  inclinacionCabeza: 1,
  cuelloVertical: 1,
  nivelHombros: 1,
  rotacionHombros: 1,
  alineacionColumna: 1,
  inclinacionLateralCabeza: 1,
};

function crearPoseBase(ajuste?: (puntos: Landmark3D[]) => void): FramePose {
  const puntos: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  // Torso ergonómico neutro
  puntos[PUNTO.CADERA_IZQ] = { x: 0.4, y: 0.8, z: 0, visibility: 0.95 };
  puntos[PUNTO.CADERA_DER] = { x: 0.6, y: 0.8, z: 0, visibility: 0.95 };
  puntos[PUNTO.HOMBRO_IZQ] = { x: 0.35, y: 0.45, z: 0, visibility: 0.95 };
  puntos[PUNTO.HOMBRO_DER] = { x: 0.65, y: 0.45, z: 0, visibility: 0.95 };
  puntos[PUNTO.OREJA_IZQ] = { x: 0.42, y: 0.25, z: 0, visibility: 0.95 };
  puntos[PUNTO.OREJA_DER] = { x: 0.58, y: 0.25, z: 0, visibility: 0.95 };
  puntos[PUNTO.NARIZ] = { x: 0.5, y: 0.26, z: -0.05, visibility: 0.95 };
  puntos[PUNTO.OJO_IZQ] = { x: 0.47, y: 0.23, z: -0.02, visibility: 0.95 };
  puntos[PUNTO.OJO_DER] = { x: 0.53, y: 0.23, z: -0.02, visibility: 0.95 };
  puntos[PUNTO.BOCA_IZQ] = { x: 0.48, y: 0.3, z: -0.02, visibility: 0.95 };
  puntos[PUNTO.BOCA_DER] = { x: 0.52, y: 0.3, z: -0.02, visibility: 0.95 };

  puntos[PUNTO.CODO_IZQ] = { x: 0.3, y: 0.6, z: 0, visibility: 0.95 };
  puntos[PUNTO.CODO_DER] = { x: 0.7, y: 0.6, z: 0, visibility: 0.95 };
  puntos[PUNTO.MUNECA_IZQ] = { x: 0.3, y: 0.75, z: -0.2, visibility: 0.95 };
  puntos[PUNTO.MUNECA_DER] = { x: 0.7, y: 0.75, z: -0.2, visibility: 0.95 };

  if (ajuste) ajuste(puntos);

  return {
    landmarks: puntos,
    worldLandmarks: puntos,
  };
}

describe("clasificador-posturas", () => {
  describe("clasificarPatron", () => {
    it("clasifica como optima ante un esqueleto neutro alineado", () => {
      const pose = crearPoseBase();
      const resultado = clasificarPatron(pose, METRICAS_OPTIMAS, null, CONFIG_PRUEBA);
      expect(resultado.patronPrincipal).toBe("optima");
      expect(resultado.confianza).toBeGreaterThan(0.5);
    });

    it("clasifica cuello_adelantado cuando la cabeza se desplaza en Z o angulo cervical alto", () => {
      const pose = crearPoseBase((p) => {
        // Cabeza muy adelante
        p[PUNTO.OREJA_IZQ].z = -0.3;
        p[PUNTO.OREJA_DER].z = -0.3;
        p[PUNTO.NARIZ].z = -0.5;
      });
      const metricasMalaCabeza = { ...METRICAS_OPTIMAS, inclinacionCabeza: 0.3 };
      const resultado = clasificarPatron(pose, metricasMalaCabeza, null, CONFIG_PRUEBA);
      expect(resultado.patronPrincipal).toBe("cuello_adelantado");
    });

    it("clasifica encorvamiento_toracico ante inclinacion anterior de columna", () => {
      const pose = crearPoseBase((p) => {
        // Hombros y cabeza desplazados adelante en Z (columna inclinada hacia adelante)
        p[PUNTO.HOMBRO_IZQ].z = -0.3;
        p[PUNTO.HOMBRO_DER].z = -0.3;
        p[PUNTO.OREJA_IZQ].z = -0.3;
        p[PUNTO.OREJA_DER].z = -0.3;
        p[PUNTO.NARIZ].z = -0.35;
      });
      const metricas = { ...METRICAS_OPTIMAS, alineacionColumna: 0.3 };
      const resultado = clasificarPatron(pose, metricas, null, CONFIG_PRUEBA);
      expect(resultado.patronPrincipal).toBe("encorvamiento_toracico");
    });

    it("clasifica apoyo_asimetrico_codo cuando una mano/codo esta muy cerca de la cabeza", () => {
      const pose = crearPoseBase((p) => {
        // Mano izquierda apoyando la cabeza y hombro desnivelado
        p[PUNTO.MUNECA_IZQ] = { x: 0.43, y: 0.26, z: 0, visibility: 0.95 };
        p[PUNTO.HOMBRO_IZQ].y = 0.4;
        p[PUNTO.HOMBRO_DER].y = 0.5;
      });
      const metricas = { ...METRICAS_OPTIMAS, nivelHombros: 0.5 };
      const resultado = clasificarPatron(pose, metricas, null, CONFIG_PRUEBA);
      expect(resultado.patronPrincipal).toBe("apoyo_asimetrico_codo");
    });

    it("devuelve postura_desconocida si no hay worldLandmarks", () => {
      const pose: FramePose = { landmarks: crearPoseBase().landmarks, worldLandmarks: null };
      const resultado = clasificarPatron(pose, METRICAS_OPTIMAS, null, CONFIG_PRUEBA);
      expect(resultado.patronPrincipal).toBe("postura_desconocida");
    });
  });

  describe("avanzarClasificacion (histeresis temporal)", () => {
    it("no cambia el patron mostrado ante un candidato efimero (< segundosSostenidos)", () => {
      let estado: EstadoClasificacion = {
        ...ESTADO_CLASIFICACION_INICIAL,
        patronMostrado: "optima",
      };
      const candidato = {
        patronPrincipal: "cuello_adelantado" as const,
        patronesSecundarios: [],
        diagnosticoPrincipal: "Cabeza inclinada",
        confianza: 0.9,
        anguloCervical3D: 30,
        anguloEspalda3D: 5,
        rotacionCabeza3D: null,
      };

      // T = 0 s: entra el candidato
      estado = avanzarClasificacion(estado, candidato, 0, CONFIG_PRUEBA);
      expect(estado.patronMostrado).toBe("optima");
      expect(estado.candidato).toBe("cuello_adelantado");

      // T = 2 s (< 3 s requeridos): no debe cambiar el mostrado
      estado = avanzarClasificacion(estado, candidato, 2, CONFIG_PRUEBA);
      expect(estado.patronMostrado).toBe("optima");

      // T = 3.5 s (>= 3 s): ahora si cambia
      estado = avanzarClasificacion(estado, candidato, 3.5, CONFIG_PRUEBA);
      expect(estado.patronMostrado).toBe("cuello_adelantado");
      expect(estado.candidato).toBeNull();
    });

    it("resetea el candidato si la postura vuelve a la mostrada antes del tiempo", () => {
      let estado: EstadoClasificacion = {
        ...ESTADO_CLASIFICACION_INICIAL,
        patronMostrado: "optima",
      };
      const candidatoMalo = {
        patronPrincipal: "cuello_adelantado" as const,
        patronesSecundarios: [],
        diagnosticoPrincipal: "Cabeza inclinada",
        confianza: 0.9,
        anguloCervical3D: 30,
        anguloEspalda3D: 5,
        rotacionCabeza3D: null,
      };
      const candidatoBueno = {
        patronPrincipal: "optima" as const,
        patronesSecundarios: [],
        diagnosticoPrincipal: "Alineada",
        confianza: 0.9,
        anguloCervical3D: 5,
        anguloEspalda3D: 5,
        rotacionCabeza3D: null,
      };

      estado = avanzarClasificacion(estado, candidatoMalo, 0, CONFIG_PRUEBA);
      expect(estado.candidato).toBe("cuello_adelantado");

      // A los 1.5s vuelve a buena
      estado = avanzarClasificacion(estado, candidatoBueno, 1.5, CONFIG_PRUEBA);
      expect(estado.patronMostrado).toBe("optima");
      expect(estado.candidato).toBeNull();
    });
  });
});
