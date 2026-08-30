/**
 * Corridas de benchmark simuladas — aporte 2 de tesis (seccion 11.2).
 *
 * Convierte "la app es liviana" en una tabla comparable. Las dos corridas de
 * referencia son las que exige el prompt maestro:
 *
 *   ANTES   configuracion ingenua: 1280x720, sin muestreo de frames (30/s),
 *           model_complexity = 1 (full), sin resolucion adaptativa.
 *   DESPUES configuracion optimizada: 640x480, 5 muestras/s, modelo lite,
 *           resolucion adaptativa activa.
 *
 * HONESTIDAD DE LOS NUMEROS: estas cifras son PLAUSIBLES, no medidas. Ningun
 * numero de este archivo puede citarse en el documento de tesis. Existen para
 * que el cliente vea la forma del entregable — que grafica va a recibir, que
 * columnas tiene el CSV — no para sustituir la medicion real con psutil.
 * La pantalla de benchmark lo declara en un aviso permanente.
 *
 * Metodologia que el software real debe respetar (verificada contra los docs de
 * psutil 7.2.2 el 2026-07-31):
 *  - Descartar la primera lectura de `cpu_percent`: devuelve 0.0 sin significado.
 *  - Descartar los primeros 15 s: incluyen import de numpy/OpenCV y carga del
 *    modelo.
 *  - Normalizar dividiendo por `psutil.cpu_count()`, o las cifras no son
 *    comparables entre equipos — fatal en una tesis que mide en varias maquinas.
 *  - Usar `Process.cpu_percent()`, no `psutil.cpu_percent()`, y sumar los hijos.
 *  - Reportar CPU% SIEMPRE junto al FPS efectivo: sin la carga, el porcentaje no
 *    significa nada.
 */

import { config } from "@/config/app.config";
import type {
  ConfigBenchmark,
  CorridaBenchmark,
  MuestraBenchmark,
} from "@/dominio/tipos";
import { crearAleatorio, fechaHace, gaussiano } from "../semilla";

const rnd = crearAleatorio(config.SEMILLA + 20);

export const CONFIG_ANTES: ConfigBenchmark = {
  resolucion: "1280x720",
  muestrasPorSegundo: 30,
  complejidadModelo: 1,
  resolucionAdaptativa: false,
};

export const CONFIG_DESPUES: ConfigBenchmark = {
  resolucion: "640x480",
  muestrasPorSegundo: 5,
  complejidadModelo: 0,
  resolucionAdaptativa: true,
};

interface Perfil {
  cpu: number;
  rss: number;
  fps: number;
  deteccion: number;
}

const PERFILES: Record<string, Perfil> = {
  antes: { cpu: 41.8, rss: 612, fps: 21.4, deteccion: 0.973 },
  despues: { cpu: 9.6, rss: 388, fps: 5.0, deteccion: 0.961 },
};

function generarMuestras(
  runId: string,
  perfil: Perfil,
  diasAtras: number,
  duracionSegundos: number,
): MuestraBenchmark[] {
  const muestras: MuestraBenchmark[] = [];
  const inicio = fechaHace(diasAtras).getTime();

  for (let s = 0; s < duracionSegundos; s += config.BENCHMARK_INTERVALO_SEGUNDOS) {
    // El calentamiento consume mas CPU y menos memoria estabilizada. Se incluye
    // en la serie a proposito: la grafica debe MOSTRAR la zona descartada, para
    // que se vea que el promedio no la incluye.
    const calentando = s < config.BENCHMARK_CALENTAMIENTO_SEGUNDOS;
    const factorCpu = calentando ? 1.55 : 1;
    const factorRss = calentando ? 0.82 + (s / config.BENCHMARK_CALENTAMIENTO_SEGUNDOS) * 0.18 : 1;

    muestras.push({
      run_id: runId,
      timestamp: new Date(inicio + s * 1000).toISOString(),
      cpu_percent: Math.max(0.5, perfil.cpu * factorCpu + gaussiano(0, perfil.cpu * 0.09, rnd)),
      rss_mb: Math.max(60, perfil.rss * factorRss + gaussiano(0, 7, rnd)),
      effective_fps: Math.max(0.5, perfil.fps + gaussiano(0, perfil.fps * 0.05, rnd)),
      detection_rate: Math.min(1, Math.max(0.75, perfil.deteccion + gaussiano(0, 0.014, rnd))),
    });
  }

  return muestras;
}

/**
 * Resume una corrida DESCARTANDO el calentamiento.
 *
 * Es la operacion que mas facilmente invalida un benchmark si se omite, asi que
 * vive aqui y no en cada pantalla.
 */
export function resumirCorrida(muestras: readonly MuestraBenchmark[]) {
  const utiles = muestras.slice(config.BENCHMARK_CALENTAMIENTO_SEGUNDOS);
  if (utiles.length === 0) {
    return {
      cpuPromedio: 0,
      cpuMaximo: 0,
      rssPromedioMb: 0,
      fpsEfectivo: 0,
      tasaDeteccion: 0,
      duracionSegundos: 0,
    };
  }
  const media = (f: (m: MuestraBenchmark) => number) =>
    utiles.reduce((a, m) => a + f(m), 0) / utiles.length;

  return {
    cpuPromedio: media((m) => m.cpu_percent),
    cpuMaximo: Math.max(...utiles.map((m) => m.cpu_percent)),
    rssPromedioMb: media((m) => m.rss_mb),
    fpsEfectivo: media((m) => m.effective_fps),
    tasaDeteccion: media((m) => m.detection_rate),
    duracionSegundos: muestras.length * config.BENCHMARK_INTERVALO_SEGUNDOS,
  };
}

const DURACION = 300; // 5 minutos por corrida

const MUESTRAS_ANTES = generarMuestras("run-antes", PERFILES.antes, 3, DURACION);
const MUESTRAS_DESPUES = generarMuestras("run-despues", PERFILES.despues, 2, DURACION);

export const MUESTRAS_POR_CORRIDA: Record<string, MuestraBenchmark[]> = {
  "run-antes": MUESTRAS_ANTES,
  "run-despues": MUESTRAS_DESPUES,
};

export const CORRIDAS: CorridaBenchmark[] = [
  {
    run_id: "run-antes",
    started_at: fechaHace(3).toISOString(),
    label: "Antes (configuracion ingenua)",
    config: CONFIG_ANTES,
    resumen: resumirCorrida(MUESTRAS_ANTES),
  },
  {
    run_id: "run-despues",
    started_at: fechaHace(2).toISOString(),
    label: "Despues (optimizada)",
    config: CONFIG_DESPUES,
    resumen: resumirCorrida(MUESTRAS_DESPUES),
  },
];

/** Equipo donde se "corrio" el benchmark. La metodologia exige declararlo. */
export const EQUIPO_DE_PRUEBA = {
  modelo: "Portatil de gama media",
  cpu: "Intel Core i5-1135G7 · 4 nucleos / 8 hilos",
  ram: "8 GB",
  so: "Windows 11 Pro 24H2",
  camara: "Camara integrada 720p",
  planEnergia: "Alto rendimiento (fijado a proposito: Windows hace throttling en modo equilibrado)",
};
