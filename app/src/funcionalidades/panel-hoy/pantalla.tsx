/**
 * Panel de hoy — la pantalla principal.
 *
 * Abre con una FRASE en espanol natural y las graficas van debajo. Es
 * deliberado: la investigacion de tendencias en aplicaciones de bienestar 2026
 * es explicita en que las mejores "convierten los datos en guia clara en vez de
 * actuar como tableros de datos". Un panel que arranca con seis graficas obliga
 * al usuario a hacer el trabajo de interpretacion.
 *
 * Cubre RF-1, RF-2, RF-3 y RF-9 del prompt maestro.
 */

import { useEffect, useState } from "react";
import { Activity, Flame, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { config } from "@/config/app.config";
import { useCamara } from "@/camara/use-camara";
import { obtenerHistorial } from "@/datos/api/historial.api";
import {
  decliveReciente,
  resumirEnPalabras,
  resumirSesion,
} from "@/dominio/estadisticas";
import {
  DIAGNOSTICO_PATRON,
  ETIQUETA_PATRON,
} from "@/dominio/clasificador-posturas";
import { useSimulacion } from "@/estado/simulacion";
import { AvisoDemo } from "@/componentes/comunes/avisos";
import { DesgloseMetricas } from "@/componentes/comunes/desglose-metricas";
import { SparklineSesion } from "@/componentes/comunes/graficas";
import { MedidorPostura } from "@/componentes/comunes/medidor-postura";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearDuracion, formatearNumero, formatearPorcentaje } from "@/utils/formato";
import { VistaCamara } from "./vista-camara";

export function PantallaPanelHoy() {
  // La sesion la hidrata el marco de la aplicacion (componentes/layout/marco.tsx),
  // no esta pantalla: la franja de bandeja muestra el estado en TODAS las rutas,
  // y si la carga dependiera de abrir el panel, entrar directo a /historial
  // mostraria una sesion en cero.
  const {
    listo,
    puntajeSuavizado,
    presentacion,
    muestras,
    metricasAjustadas,
    aportes,
    ajustes,
    modoCamara,
    activarModoCamara,
    empujarLandmarks,
    calibracionPostural,
    disponibilidadMetricas,
    clasificacion,
    perspectiva,
    cambiarPerspectiva,
    marcarPosturaNeutra,
    limpiarCalibracionPostural,
  } = useSimulacion();

  const camara = useCamara(ajustes.camara.muestrasPorSegundo);
  const [promedioAyer, setPromedioAyer] = useState<number | null>(null);

  useEffect(() => {
    void obtenerHistorial().then((h) => setPromedioAyer(h.promedioAyer));
  }, []);

  // Puente entre la camara y el motor: la pose real entra por el mismo
  // camino de calculo que las muestras simuladas.
  useEffect(() => {
    if (modoCamara) empujarLandmarks(camara.pose);
  }, [camara.pose, modoCamara, empujarLandmarks]);

  async function cambiarModoCamara(activo: boolean) {
    activarModoCamara(activo);
    if (activo) {
      await camara.encender();
    } else {
      camara.apagar();
    }
  }

  // Si la camara falla, se vuelve solo a modo simulado. El prototipo nunca se
  // queda sin datos que ensenar.
  useEffect(() => {
    if (camara.estado === "error" && modoCamara) activarModoCamara(false);
  }, [camara.estado, modoCamara, activarModoCamara]);

  const stats = resumirSesion(muestras, config.UMBRAL_BUENA_POSTURA);
  const declive = decliveReciente(muestras, 900);
  const frase = resumirEnPalabras(
    stats,
    promedioAyer === null ? null : stats.promedio - promedioAyer,
  );

  // Una muestra cada 15 s: suficiente resolucion visual sin renderizar miles de
  // puntos en cada tick del motor.
  const paso = Math.max(1, Math.floor(muestras.length / 400));
  const serie = muestras
    .filter((_, i) => i % paso === 0)
    .filter((m) => m.detectado)
    .map((m) => ({ t: m.t, score: m.score }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de hoy</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-balance">
            {listo ? frase : "Preparando tu sesion..."}
          </p>
        </div>
        <AvisoDemo />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-6 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <VistaCamara
                modoCamara={modoCamara}
                onCambiarModo={cambiarModoCamara}
                estado={camara.estado}
                error={camara.error}
                origenRecursos={camara.origenRecursos}
                videoRef={camara.videoRef}
                landmarks={camara.pose?.landmarks ?? null}
                worldLandmarks={camara.pose?.worldLandmarks ?? null}
                presentacion={presentacion}
                perspectiva={perspectiva}
                onCambiarPerspectiva={cambiarPerspectiva}
                calibracionPostural={calibracionPostural}
                onMarcaPosturaNeutra={() => marcarPosturaNeutra(camara.pose)}
                onLimpiarCalibracion={() => limpiarCalibracionPostural()}
              />
              <div className="flex flex-col items-center gap-3">
                <MedidorPostura puntaje={puntajeSuavizado} presentacion={presentacion} />
                {modoCamara && clasificacion.patronMostrado !== "sin_datos" && (
                  <div className="bg-muted/60 flex max-w-[220px] items-center gap-2 rounded-md px-2.5 py-1.5 text-xs">
                    <Activity className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                    <div className="truncate">
                      <span className="font-medium text-foreground block truncate">
                        {ETIQUETA_PATRON[clasificacion.patronMostrado]}
                      </span>
                      <span className="text-muted-foreground text-[11px] block truncate">
                        {DIAGNOSTICO_PATRON[clasificacion.patronMostrado]}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Puntaje a lo largo de la sesion</CardTitle>
            </CardHeader>
            <CardContent>
              <SparklineSesion
                datos={serie}
                umbral={ajustes.notificaciones.umbralMalaPostura}
              />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador
              icono={Timer}
              etiqueta="Tiempo activo"
              valor={formatearDuracion(stats.duracionActivaSegundos)}
              nota="Sin contar el tiempo que estuviste fuera"
            />
            <Indicador
              icono={Flame}
              etiqueta="Racha actual"
              valor={formatearDuracion(stats.rachaActualSegundos)}
              nota={`Tu mejor racha hoy: ${formatearDuracion(stats.mejorRachaSegundos)}`}
            />
            <Indicador
              icono={TrendingUp}
              etiqueta="Buena postura"
              valor={formatearPorcentaje(stats.proporcionBuenaPostura * 100)}
              nota={`Promedio de la sesion: ${formatearNumero(stats.promedio, 1)}`}
            />
            <Indicador
              icono={TrendingDown}
              etiqueta="Ultimos 15 minutos"
              valor={
                declive === null
                  ? "Sin datos"
                  : declive > 2 ? `-${formatearNumero(declive, 1)} pts` : "Estable"
              }
              nota={
                declive === null
                  ? "Hace falta mas tiempo de sesion"
                  : declive > 2
                    ? "Tu postura viene cayendo: buen momento para una pausa"
                    : "Te mantienes en tu nivel habitual"
              }
            />
          </div>
        </div>

        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle>De que se compone tu puntaje</CardTitle>
          </CardHeader>
          <CardContent>
            <DesgloseMetricas
              metricas={metricasAjustadas}
              aportes={aportes}
              pesos={ajustes.deteccion.pesos}
              disponibilidad={disponibilidadMetricas}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Indicador({
  icono: Icono,
  etiqueta,
  valor,
  nota,
}: {
  icono: typeof Timer;
  etiqueta: string;
  valor: string;
  nota: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Icono className="size-3.5" aria-hidden />
          {etiqueta}
        </p>
        <p className="tabular text-xl font-semibold">{valor}</p>
        <p className="text-muted-foreground text-xs text-balance">{nota}</p>
      </CardContent>
    </Card>
  );
}
