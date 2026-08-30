/**
 * Sesion en curso.
 *
 * Equivalencias en el producto real:
 *   obtenerSesionInicial() -> ScoreService.get_session_stats() + dashboard_history
 *   listarCamaras()        -> enumeracion de dispositivos de CameraService
 *   probarCamara()         -> CameraService.open(device_id)
 *   calibrar()             -> flujo de ui/onboarding.py (6 segundos)
 */

import { config } from "@/config/app.config";
import type { MetricasPostura, MuestraPuntaje } from "@/dominio/tipos";
import { fallar, resolver } from "../cliente";
import {
  CALIBRACION_INICIAL,
  METRICAS_ACTUALES,
  MUESTRAS_SESION,
  SEGUNDOS_YA_TRANSCURRIDOS,
} from "../fixtures/sesion";

export interface SesionInicial {
  muestras: MuestraPuntaje[];
  metricasActuales: MetricasPostura;
  segundosTranscurridos: number;
  calibracion: MetricasPostura;
}

export async function obtenerSesionInicial(): Promise<SesionInicial> {
  return resolver("ScoreService.get_session_stats()", () => ({
    muestras: MUESTRAS_SESION,
    metricasActuales: METRICAS_ACTUALES,
    segundosTranscurridos: SEGUNDOS_YA_TRANSCURRIDOS,
    calibracion: CALIBRACION_INICIAL,
  }));
}

export interface DispositivoCamara {
  id: number;
  nombre: string;
  resolucion: string;
  disponible: boolean;
  /** Motivo por el que no esta disponible, en lenguaje de usuario. */
  motivo?: string;
}

/**
 * Camaras del equipo.
 *
 * La segunda aparece ocupada a proposito: es el fallo mas comun en la practica
 * (una videollamada abierta) y el onboarding tiene que saber comunicarlo.
 */
export async function listarCamaras(): Promise<DispositivoCamara[]> {
  return resolver("CameraService.list_devices()", () => [
    { id: 0, nombre: "Camara integrada", resolucion: "1280x720", disponible: true },
    {
      id: 1,
      nombre: "Camara USB externa",
      resolucion: "1920x1080",
      disponible: false,
      motivo: "La esta usando otra aplicacion",
    },
  ]);
}

export async function probarCamara(id: number): Promise<{ ok: true }> {
  return resolver(
    `CameraService.open(${id})`,
    () => {
      if (id === 1) {
        fallar(
          "camara-ocupada",
          "Esa camara la esta usando otra aplicacion.",
          "Cierra la otra aplicacion y reintenta",
        );
      }
      return { ok: true as const };
    },
    { factorLatencia: 2 },
  );
}

/**
 * Calibracion inicial de 6 segundos.
 *
 * OJO — hallazgo verificado contra el repositorio el 2026-07-31: en el proyecto
 * original esta calibracion SI guarda `baseline_posture_score`,
 * `baseline_neck_angle` y `baseline_shoulder_level`, pero `pose_detector.py`
 * sigue usando vectores ideales fijos. Es decir, hoy el resultado se guarda y no
 * se usa para nada. Cerrar esa brecha es parte del aporte 1 de Habitusitos.
 */
export async function calibrar(): Promise<MetricasPostura> {
  return resolver(
    "OnboardingWizard.run_calibration()",
    () => CALIBRACION_INICIAL,
    { factorLatencia: 0.4 },
  );
}

export const DURACION_CALIBRACION_MS = config.SEGUNDOS_CALIBRACION * 1000;
