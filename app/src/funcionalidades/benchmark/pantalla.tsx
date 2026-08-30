/**
 * Consumo de recursos — APORTE 2 DE TESIS (seccion 11.2).
 *
 * Convierte "la aplicacion es liviana" en una tabla que se puede defender.
 *
 * HONESTIDAD, PRIMERO: las cifras de esta pantalla son SIMULADAS y no pueden
 * citarse en el documento de tesis. El aviso que lo dice es permanente y no se
 * puede cerrar. Lo que esta pantalla demuestra es el ENTREGABLE — que grafica se
 * va a producir, que columnas tiene el CSV, que metodologia se sigue — no el
 * resultado. Presentar numeros inventados como medidos seria exactamente el tipo
 * de error que invalida un capitulo de resultados.
 *
 * Este modo es una herramienta de desarrollo y de tesis. En el producto real NO
 * va en el menu principal: los 15 a 70 participantes de la prueba no deben verlo.
 */

import { useEffect, useState } from "react";
import { Download, FlaskConical, Play, TriangleAlert } from "lucide-react";
import { config } from "@/config/app.config";
import {
  EQUIPO_DE_PRUEBA,
  ejecutarCorrida,
  exportarBenchmarkCsv,
  listarCorridas,
  obtenerComparacion,
  obtenerMuestras,
} from "@/datos/api/benchmark.api";
import type { FilaComparacion } from "@/datos/api/benchmark.api";
import type { ConfigBenchmark, CorridaBenchmark, MuestraBenchmark } from "@/dominio/tipos";
import { AvisoDemo, Cargando, EstadoError, NotaSimulado } from "@/componentes/comunes/avisos";
import { CampoSelect } from "@/componentes/comunes/campo-select";
import { SerieBenchmark } from "@/componentes/comunes/graficas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { descargarTexto, formatearCambio, formatearNumero } from "@/utils/formato";
import { cn } from "@/lib/utils";

export function PantallaBenchmark() {
  const [corridas, setCorridas] = useState<CorridaBenchmark[]>([]);
  const [comparacion, setComparacion] = useState<FilaComparacion[]>([]);
  const [muestras, setMuestras] = useState<Record<string, MuestraBenchmark[]>>({});
  const [error, setError] = useState<unknown>(null);
  const [corriendo, setCorriendo] = useState(false);

  const [cfg, setCfg] = useState<ConfigBenchmark>({
    resolucion: "640x480",
    muestrasPorSegundo: 5,
    complejidadModelo: 0,
    resolucionAdaptativa: true,
  });

  async function cargar() {
    setError(null);
    try {
      const lista = await listarCorridas();
      setCorridas(lista);
      setComparacion(await obtenerComparacion());
      const porCorrida: Record<string, MuestraBenchmark[]> = {};
      for (const c of lista) porCorrida[c.run_id] = await obtenerMuestras(c.run_id);
      setMuestras(porCorrida);
    } catch (e) {
      setError(e);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function correr() {
    setCorriendo(true);
    try {
      const { corrida, muestras: nuevas } = await ejecutarCorrida(cfg);
      setCorridas((prev) => [...prev.filter((c) => c.run_id !== corrida.run_id), corrida]);
      setMuestras((prev) => ({ ...prev, [corrida.run_id]: nuevas }));
    } catch (e) {
      setError(e);
    } finally {
      setCorriendo(false);
    }
  }

  async function exportar() {
    try {
      const { nombre, csv } = await exportarBenchmarkCsv();
      descargarTexto(nombre, csv);
    } catch (e) {
      setError(e);
    }
  }

  if (error) return <EstadoError error={error} onReintentar={cargar} />;
  if (corridas.length === 0) return <Cargando texto="Cargando corridas..." />;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-accent text-xs font-medium tracking-wide uppercase">
            Aporte propio de Habitusitos
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Consumo de recursos
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm text-balance">
            Compara el consumo de CPU y memoria entre la configuracion inicial y la
            optimizada, con la misma metodologia en ambas, y exporta el resultado
            listo para el capitulo de resultados.
          </p>
        </div>
        <AvisoDemo />
      </header>

      <Card className="border-demo/40 bg-demo-suave/40">
        <CardContent className="flex items-start gap-3 pt-5">
          <TriangleAlert className="text-demo mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Estas cifras son de ejemplo, no medidas</p>
            <p className="text-muted-foreground text-sm text-balance">
              Ninguno de los numeros de esta pantalla puede citarse en el documento
              de tesis. La medicion real se hace con <code>psutil</code> sobre el
              software final. Lo que se demuestra aqui es el formato del entregable
              y la metodologia, no el resultado.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Comparacion antes / despues</CardTitle>
            <CardDescription>
              Misma duracion, mismo equipo, misma metodologia. Solo cambia la
              configuracion.
            </CardDescription>
          </div>
          <div data-slot="card-action" className="self-start">
            <Button variant="outline" size="sm" onClick={exportar}>
              <Download className="size-3.5" aria-hidden />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                  <th className="pb-2 font-medium">Metrica</th>
                  <th className="pb-2 text-right font-medium">Antes</th>
                  <th className="pb-2 text-right font-medium">Despues</th>
                  <th className="pb-2 text-right font-medium">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {comparacion.map((f) => {
                  const mejora = f.menorEsMejor ? f.cambio < 0 : f.cambio > 0;
                  return (
                    <tr key={f.metrica} className="border-border/60 border-b last:border-0">
                      <td className="py-2.5">
                        {f.metrica}
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          ({f.unidad})
                        </span>
                      </td>
                      <td className="tabular py-2.5 text-right">
                        {formatearNumero(f.antes, 1)}
                      </td>
                      <td className="tabular py-2.5 text-right font-medium">
                        {formatearNumero(f.despues, 1)}
                      </td>
                      <td
                        className={cn(
                          "tabular py-2.5 text-right font-medium",
                          mejora ? "text-estado-buena" : "text-estado-regular",
                        )}
                      >
                        {formatearCambio(f.cambio)}
                        {/* El signo no basta: "mejor" o "peor" en palabras evita
                            que se lea al reves segun la metrica. */}
                        <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                          {mejora ? "mejor" : "peor"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <NotaSimulado>
            El FPS efectivo baja a proposito: procesar menos imagenes por segundo es
            justamente la optimizacion. Lo que importa es que la tasa de deteccion
            apenas cambie — si cayera, se estaria ahorrando CPU a costa de precision.
          </NotaSimulado>
        </CardContent>
      </Card>

      <Tabs defaultValue={corridas[0].run_id}>
        <TabsList>
          {corridas.map((c) => (
            <TabsTrigger key={c.run_id} value={c.run_id}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {corridas.map((c) => {
          const serie = muestras[c.run_id] ?? [];
          return (
            <TabsContent key={c.run_id} value={c.run_id} className="space-y-4 pt-4">
              <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span>Resolucion: {c.config.resolucion}</span>
                <span>Muestreo: {c.config.muestrasPorSegundo}/s</span>
                <span>
                  Modelo:{" "}
                  {["lite", "full", "heavy"][c.config.complejidadModelo] ?? "lite"}
                </span>
                <span>
                  Resolucion adaptativa: {c.config.resolucionAdaptativa ? "si" : "no"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CPU del proceso</CardTitle>
                    <CardDescription>
                      Promedio sin calentamiento:{" "}
                      <span className="tabular font-medium">
                        {formatearNumero(c.resumen.cpuPromedio, 1)}%
                      </span>{" "}
                      de un nucleo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SerieBenchmark
                      datos={serie.map((m, i) => ({ s: i, valor: m.cpu_percent }))}
                      clave="cpu"
                      etiqueta="CPU"
                      unidad="%"
                      calentamientoHasta={config.BENCHMARK_CALENTAMIENTO_SEGUNDOS}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Memoria (RSS)</CardTitle>
                    <CardDescription>
                      Promedio:{" "}
                      <span className="tabular font-medium">
                        {formatearNumero(c.resumen.rssPromedioMb, 0)} MB
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SerieBenchmark
                      datos={serie.map((m, i) => ({ s: i, valor: m.rss_mb }))}
                      clave="rss"
                      etiqueta="Memoria"
                      unidad="MB"
                      color="var(--chart-4)"
                      calentamientoHasta={config.BENCHMARK_CALENTAMIENTO_SEGUNDOS}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ejecutar una corrida nueva</CardTitle>
            <CardDescription>
              Cambia la configuracion y observa como afecta al consumo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoSelect
                id="bm-resolucion"
                etiqueta="Resolucion de captura"
                valor={cfg.resolucion}
                opciones={[
                  { valor: "1280x720", texto: "1280 × 720" },
                  { valor: "640x480", texto: "640 × 480" },
                ]}
                onCambio={(v) =>
                  setCfg({ ...cfg, resolucion: v as ConfigBenchmark["resolucion"] })
                }
              />

              <CampoSelect
                id="bm-modelo"
                etiqueta="Modelo de deteccion"
                valor={String(cfg.complejidadModelo)}
                opciones={[
                  { valor: "0", texto: "Ligero (mas rapido)" },
                  { valor: "1", texto: "Completo" },
                  { valor: "2", texto: "Pesado (mas preciso)" },
                ]}
                onCambio={(v) =>
                  setCfg({
                    ...cfg,
                    complejidadModelo: Number(v) as ConfigBenchmark["complejidadModelo"],
                  })
                }
              />

              <CampoSelect
                id="bm-muestreo"
                etiqueta="Imagenes analizadas por segundo"
                valor={String(cfg.muestrasPorSegundo)}
                opciones={[
                  { valor: "2", texto: "2 por segundo" },
                  { valor: "5", texto: "5 por segundo" },
                  { valor: "15", texto: "15 por segundo" },
                  { valor: "30", texto: "30 por segundo (sin muestreo)" },
                ]}
                onCambio={(v) => setCfg({ ...cfg, muestrasPorSegundo: Number(v) })}
              />

              <div className="flex items-end gap-2.5 pb-1">
                <Switch
                  id="bm-adaptativa"
                  checked={cfg.resolucionAdaptativa}
                  onCheckedChange={(v) => setCfg({ ...cfg, resolucionAdaptativa: v })}
                />
                <Label htmlFor="bm-adaptativa" className="text-sm">
                  Bajar calidad si el equipo va lento
                </Label>
              </div>
            </div>

            <Button onClick={correr} disabled={corriendo} className="w-full">
              {corriendo ? (
                <>
                  <FlaskConical className="size-4 animate-pulse" aria-hidden />
                  Midiendo... (5 minutos simulados)
                </>
              ) : (
                <>
                  <Play className="size-4" aria-hidden />
                  Ejecutar corrida
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metodologia</CardTitle>
            <CardDescription>
              Lo que hay que respetar para que las cifras sean comparables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-4 text-xs">
              <li>
                Se descartan los primeros{" "}
                {config.BENCHMARK_CALENTAMIENTO_SEGUNDOS} segundos: incluyen la carga
                de librerias y del modelo, que no representan el uso normal.
              </li>
              <li>
                La primera lectura de CPU se ignora siempre: la herramienta devuelve
                un valor sin significado.
              </li>
              <li>
                El porcentaje se normaliza por numero de nucleos, o las cifras no son
                comparables entre equipos distintos.
              </li>
              <li>
                Se mide el proceso y sus procesos hijos, no el sistema completo.
              </li>
              <li>
                El CPU siempre se reporta junto al FPS efectivo: sin saber la carga,
                el porcentaje no significa nada.
              </li>
              <li>
                Plan de energia fijado en alto rendimiento y declarado: Windows
                reduce la frecuencia del procesador en modo equilibrado.
              </li>
            </ul>

            <div className="border-border space-y-1 border-t pt-3 text-xs">
              <p className="font-medium">Equipo declarado</p>
              <p className="text-muted-foreground">{EQUIPO_DE_PRUEBA.cpu}</p>
              <p className="text-muted-foreground">
                {EQUIPO_DE_PRUEBA.ram} · {EQUIPO_DE_PRUEBA.so}
              </p>
              <p className="text-muted-foreground">{EQUIPO_DE_PRUEBA.camara}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
