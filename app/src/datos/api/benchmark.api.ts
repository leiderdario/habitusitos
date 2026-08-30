/**
 * Benchmark de recursos — aporte 2 de tesis (seccion 11.2).
 *
 * Equivalencias en el producto real:
 *   listarCorridas()  -> SELECT * FROM benchmark_runs
 *   obtenerMuestras() -> SELECT * FROM benchmark_samples WHERE run_id = ?
 *   ejecutarCorrida() -> BenchmarkService.run(config, duracion) instrumentado con psutil
 *   exportarCsv()     -> volcado de benchmark_samples con metadatos de configuracion
 *
 * El modo benchmark es una herramienta de desarrollo y de tesis, NO una funcion
 * expuesta al usuario final de las pruebas con 15-70 personas. En el producto
 * real vive detras de una bandera o un comando dedicado, no en el menu principal.
 */

import { config } from "@/config/app.config";
import type {
  ConfigBenchmark,
  CorridaBenchmark,
  MuestraBenchmark,
} from "@/dominio/tipos";
import { resolver } from "../cliente";
import {
  CORRIDAS,
  EQUIPO_DE_PRUEBA,
  MUESTRAS_POR_CORRIDA,
  resumirCorrida,
} from "../fixtures/benchmark";

export async function listarCorridas(): Promise<CorridaBenchmark[]> {
  return resolver("SELECT * FROM benchmark_runs", () => CORRIDAS);
}

export async function obtenerMuestras(runId: string): Promise<MuestraBenchmark[]> {
  return resolver(
    `SELECT * FROM benchmark_samples WHERE run_id = '${runId}'`,
    () => MUESTRAS_POR_CORRIDA[runId] ?? [],
  );
}

/** Comparacion antes/despues, en la forma exacta que va al documento de tesis. */
export interface FilaComparacion {
  metrica: string;
  unidad: string;
  antes: number;
  despues: number;
  /** Cambio porcentual. Negativo = mejora en consumo. */
  cambio: number;
  /** true cuando un valor menor es mejor (CPU, RAM). */
  menorEsMejor: boolean;
}

export async function obtenerComparacion(): Promise<FilaComparacion[]> {
  const [antes, despues] = CORRIDAS;
  const fila = (
    metrica: string,
    unidad: string,
    a: number,
    d: number,
    menorEsMejor: boolean,
  ): FilaComparacion => ({
    metrica,
    unidad,
    antes: a,
    despues: d,
    cambio: a === 0 ? 0 : ((d - a) / a) * 100,
    menorEsMejor,
  });

  return resolver("BenchmarkService.compare()", () => [
    fila("CPU promedio", "% de un nucleo", antes.resumen.cpuPromedio, despues.resumen.cpuPromedio, true),
    fila("CPU maximo", "% de un nucleo", antes.resumen.cpuMaximo, despues.resumen.cpuMaximo, true),
    fila("Memoria (RSS)", "MB", antes.resumen.rssPromedioMb, despues.resumen.rssPromedioMb, true),
    fila("FPS efectivo", "cuadros/s", antes.resumen.fpsEfectivo, despues.resumen.fpsEfectivo, false),
    fila("Tasa de deteccion", "%", antes.resumen.tasaDeteccion * 100, despues.resumen.tasaDeteccion * 100, false),
  ]);
}

/**
 * Simula una corrida nueva.
 *
 * Devuelve las muestras de la corrida de referencia que mas se parece a la
 * configuracion pedida. No inventa un modelo de rendimiento: fingir que se puede
 * predecir el consumo a partir de la configuracion seria justo el tipo de dato
 * inventado que este proyecto no puede permitirse.
 */
export async function ejecutarCorrida(
  cfg: ConfigBenchmark,
): Promise<{ corrida: CorridaBenchmark; muestras: MuestraBenchmark[] }> {
  const esOptimizada =
    cfg.complejidadModelo === 0 && cfg.muestrasPorSegundo <= 10 && cfg.resolucion === "640x480";
  const referencia = esOptimizada ? CORRIDAS[1] : CORRIDAS[0];
  const muestras = MUESTRAS_POR_CORRIDA[referencia.run_id];

  return resolver(
    "BenchmarkService.run()",
    () => ({
      corrida: {
        ...referencia,
        run_id: `run-${esOptimizada ? "optimizada" : "base"}`,
        label: esOptimizada ? "Configuracion optimizada" : "Configuracion base",
        config: cfg,
        resumen: resumirCorrida(muestras),
      },
      muestras,
    }),
    { factorLatencia: 3 },
  );
}

export function generarCsvBenchmark(
  corridas: readonly CorridaBenchmark[],
  muestrasPorCorrida: Record<string, MuestraBenchmark[]>,
): string {
  const lineas: string[] = [];

  // Metadatos primero: una corrida sin su configuracion y su equipo no es
  // comparable con nada y no sirve para el capitulo de resultados.
  lineas.push("# Habitusitos - exportacion de benchmark (DATOS SIMULADOS DEL PROTOTIPO)");
  lineas.push(`# equipo,${EQUIPO_DE_PRUEBA.modelo} / ${EQUIPO_DE_PRUEBA.cpu} / ${EQUIPO_DE_PRUEBA.ram}`);
  lineas.push(`# sistema,${EQUIPO_DE_PRUEBA.so}`);
  lineas.push(`# plan_energia,${EQUIPO_DE_PRUEBA.planEnergia}`);
  lineas.push(`# calentamiento_descartado_s,${config.BENCHMARK_CALENTAMIENTO_SEGUNDOS}`);
  for (const c of corridas) {
    lineas.push(
      `# corrida,${c.run_id},${c.label},${c.config.resolucion},${c.config.muestrasPorSegundo}fps,complejidad=${c.config.complejidadModelo},adaptativa=${c.config.resolucionAdaptativa}`,
    );
  }
  lineas.push("");
  lineas.push("run_id,timestamp,cpu_percent,rss_mb,effective_fps,detection_rate,en_calentamiento");

  for (const c of corridas) {
    (muestrasPorCorrida[c.run_id] ?? []).forEach((m, i) => {
      const calentando = i < config.BENCHMARK_CALENTAMIENTO_SEGUNDOS ? "si" : "no";
      lineas.push(
        [
          m.run_id,
          m.timestamp,
          m.cpu_percent.toFixed(2),
          m.rss_mb.toFixed(1),
          m.effective_fps.toFixed(2),
          m.detection_rate.toFixed(4),
          calentando,
        ].join(","),
      );
    });
  }

  return lineas.join("\r\n");
}

export async function exportarBenchmarkCsv(): Promise<{ nombre: string; csv: string }> {
  return resolver(
    "BenchmarkService.export_csv()",
    () => ({
      nombre: "habitusitos_benchmark_antes_despues.csv",
      csv: generarCsvBenchmark(CORRIDAS, MUESTRAS_POR_CORRIDA),
    }),
    { factorLatencia: 1.5 },
  );
}

export { EQUIPO_DE_PRUEBA };
