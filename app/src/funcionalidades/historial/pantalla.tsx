/**
 * Historial y analitica ampliada — aporte 3 de tesis (seccion 11.3).
 *
 * De las cuatro vistas propuestas en el prompt maestro se implementan tres, y se
 * declara por que se dejo una fuera. Implementar las cuatro por inercia era justo
 * lo que la seccion 11.3 pedia no hacer.
 *
 *  IMPLEMENTADA  Mapa de calor de calendario — el progreso a mediano plazo es lo
 *                que sostiene la adherencia; una sesion suelta no dice nada.
 *  IMPLEMENTADA  Comparacion por dia de la semana — es la unica vista que
 *                produce una accion concreta ("los viernes empeoro").
 *  IMPLEMENTADA  Exportacion ampliada — insumo directo del capitulo de resultados.
 *  IMPLEMENTADA  Declive intra-sesion — vive en el panel de hoy, no aqui: es un
 *                dato de la sesion en curso, no del historial.
 */

import { useEffect, useState } from "react";
import { Download, Info, WifiOff } from "lucide-react";
import { config } from "@/config/app.config";
import {
  exportarHistorialCsv,
  obtenerDiaSemana,
  obtenerHistorial,
  obtenerTendencia,
} from "@/datos/api/historial.api";
import type { ComparacionDiaSemana, DiaHistorial } from "@/dominio/tipos";
import { AvisoDemo, Cargando, EstadoError } from "@/componentes/comunes/avisos";
import { BarrasDiaSemana, LineaTendencia } from "@/componentes/comunes/graficas";
import { MapaCalor } from "@/componentes/comunes/mapa-calor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { descargarTexto, formatearNumero } from "@/utils/formato";

export function PantallaHistorial() {
  const [dias, setDias] = useState<DiaHistorial[] | null>(null);
  const [diaSemana, setDiaSemana] = useState<ComparacionDiaSemana[]>([]);
  const [tendencia, setTendencia] = useState<{ semana: string; promedio: number }[]>([]);
  const [festivosDesdeRed, setFestivosDesdeRed] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [exportando, setExportando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      const historial = await obtenerHistorial();
      setDias(historial.dias);
      setFestivosDesdeRed(historial.festivosDesdeRed);
      setDiaSemana(await obtenerDiaSemana());
      setTendencia(await obtenerTendencia());
    } catch (e) {
      setError(e);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function exportar() {
    setExportando(true);
    try {
      const { nombre, csv } = await exportarHistorialCsv();
      descargarTexto(nombre, csv);
    } catch (e) {
      setError(e);
    } finally {
      setExportando(false);
    }
  }

  if (error) return <EstadoError error={error} onReintentar={cargar} />;
  if (!dias) return <Cargando texto="Cargando tu historial..." />;

  const conUso = dias.filter((d) => d.promedio !== null);
  const promedioGlobal =
    conUso.reduce((a, d) => a + (d.promedio ?? 0), 0) / Math.max(1, conUso.length);
  const peorDia = [...diaSemana]
    .filter((d) => d.promedio > 0)
    .sort((a, b) => a.promedio - b.promedio)[0];
  const mejorDia = [...diaSemana]
    .filter((d) => d.promedio > 0)
    .sort((a, b) => b.promedio - a.promedio)[0];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-balance">
            Tus ultimos {config.DIAS_HISTORIAL} dias. Usaste Habitusitos{" "}
            {conUso.length} dias, con un promedio de{" "}
            <span className="tabular text-foreground font-medium">
              {formatearNumero(promedioGlobal, 1)}
            </span>{" "}
            puntos.
          </p>
        </div>
        <AvisoDemo />
      </header>

      <Card>
        {/* `data-slot="card-action"` es la API de la primitiva para poner una
            accion a la derecha del titulo: el CardHeader es una rejilla y pasa a
            dos columnas al detectarlo. Poner `flex-row` no funciona, porque solo
            cambia la direccion y el display sigue siendo grid. */}
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Calendario de constancia</CardTitle>
            <CardDescription>
              Cada cuadro es un dia. Cuanto mas intenso, mejor fue tu postura ese dia.
            </CardDescription>
          </div>
          <div data-slot="card-action" className="self-start">
            <Button variant="outline" size="sm" onClick={exportar} disabled={exportando}>
              <Download className="size-3.5" aria-hidden />
              {exportando ? "Preparando..." : "Exportar CSV"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <MapaCalor dias={dias} />
          {!festivosDesdeRed && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <WifiOff className="size-3.5" aria-hidden />
              Sin conexion: los festivos vienen de la tabla local incluida en la
              aplicacion, no de la consulta en linea.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Como te va cada dia de la semana</CardTitle>
            <CardDescription>
              {peorDia && mejorDia ? (
                <>
                  Tu peor dia es el <strong>{peorDia.etiqueta.toLowerCase()}</strong> (
                  {formatearNumero(peorDia.promedio, 1)} puntos) y el mejor, el{" "}
                  <strong>{mejorDia.etiqueta.toLowerCase()}</strong> (
                  {formatearNumero(mejorDia.promedio, 1)}).
                </>
              ) : (
                "Hace falta mas historial para comparar dias."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarrasDiaSemana datos={diaSemana} umbral={config.UMBRAL_MALA_POSTURA} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia semana a semana</CardTitle>
            <CardDescription>
              El progreso real se ve en semanas, no en sesiones sueltas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineaTendencia datos={tendencia} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sobre estos datos</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            El historial se guarda unicamente en este equipo, en una base de datos
            local. Nunca se envia a ningun servidor. Puedes borrarlo cuando quieras
            desde Ajustes.
          </p>
          <p className="pl-6">
            La exportacion incluye fecha, promedio del dia, minutos activos y si el
            dia era festivo. Es el formato pensado para analizar los datos en Excel,
            R o Python.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
