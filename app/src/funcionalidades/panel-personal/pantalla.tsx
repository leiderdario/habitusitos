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

import { useEffect } from "react";
import { Flame, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { config } from "@/config/app.config";
import { useCamara } from "@/camara/use-camara";
import { decliveReciente, resumirSesion } from "@/dominio/estadisticas";
import { DIAGNOSTICO_PATRON } from "@/dominio/clasificador-posturas";
import { useSimulacion } from "@/estado/simulacion";
import { AvisoDemo } from "@/componentes/comunes/avisos";
import { DesgloseMetricas } from "@/componentes/comunes/desglose-metricas";
import { SparklineSesion } from "@/componentes/comunes/graficas";
import { FormaEstado } from "@/componentes/comunes/forma-estado";
import { clasesEstado, InsigniaEstado } from "@/componentes/comunes/insignia-estado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearDuracion, formatearNumero, formatearPorcentaje } from "@/utils/formato";
import { VistaCamara } from "@/componentes/comunes/vista-camara";

export function PantallaPanelPersonal() {
  // La sesion la hidrata el marco de la aplicacion (componentes/layout/marco.tsx),
  // no esta pantalla: la franja de bandeja muestra el estado en TODAS las rutas,
  // y si la carga dependiera de abrir el panel, entrar directo a /historial
  // mostraria una sesion en cero.
  const {
    listo,
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

  // Puente entre la camara y el motor: la pose real entra por el mismo
  // camino de calculo que las muestras simuladas.
  useEffect(() => {
    if (modoCamara && camara.fuenteActiva === "webcam") {
      empujarLandmarks(camara.pose);
    }
  }, [camara.pose, camara.fuenteActiva, modoCamara, empujarLandmarks]);

  async function cambiarModoCamara(activo: boolean) {
    activarModoCamara(activo);
    if (activo) {
      await camara.encender(camara.fuenteActiva);
    } else {
      camara.apagar();
    }
  }

  // Si la camara web falla, se vuelve a modo simulado para que la pantalla
  // nunca se quede sin datos.
  useEffect(() => {
    if (camara.estado === "error" && modoCamara) {
      activarModoCamara(false);
    }
  }, [camara.estado, modoCamara, activarModoCamara]);

  const stats = resumirSesion(muestras, config.UMBRAL_BUENA_POSTURA);
  const declive = decliveReciente(muestras, 900);

  // Una muestra cada 15 s: suficiente resolucion visual sin renderizar miles de
  // puntos en cada tick del motor.
  const paso = Math.max(1, Math.floor(muestras.length / 400));
  const serie = muestras
    .filter((_, i) => i % paso === 0)
    .filter((m) => m.detectado)
    .map((m) => ({ t: m.t, score: m.score }));

  // Diagnostico especifico de que corregir, en vez de un numero. Si el
  // clasificador no tiene una lectura util todavia (sin camara, sin datos
  // suficientes, o la postura ya es optima), se cae a la descripcion general
  // del estado -- nunca a un marcador vacio.
  const hayDiagnosticoEspecifico =
    modoCamara &&
    clasificacion.patronMostrado !== "sin_datos" &&
    clasificacion.patronMostrado !== "postura_desconocida" &&
    clasificacion.patronMostrado !== "optima";
  const mensajePrincipal = hayDiagnosticoEspecifico
    ? DIAGNOSTICO_PATRON[clasificacion.patronMostrado]
    : presentacion.descripcion;

  return (
    <div className="mx-auto max-w-[110rem] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de hoy</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-balance">
            {listo ? mensajePrincipal : "Preparando tu sesion..."}
          </p>
        </div>
        <AvisoDemo />
      </header>

      {/* La camara va primera en el DOM: en pantallas angostas queda arriba y el
          orden de tabulacion sigue el orden visual (camara, controles, rieles).
          Desde el breakpoint `ancho` (1360 px) los rieles se colocan a los lados con posiciones
          explicitas; por debajo, la camara ocupa el ancho (con tope) y los rieles
          van en dos columnas. 1360 y no `xl`: a 1280 la camara central quedaba en
          unos 440 px, menos de lo que pide que sea la protagonista. */}
      <div className="grid gap-4 lg:grid-cols-2 ancho:grid-cols-[12.5rem_minmax(0,1fr)_16rem] 2xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <div className="mx-auto w-full max-w-[44rem] min-w-0 lg:col-span-2 ancho:col-span-1 ancho:col-start-2 ancho:row-start-1 ancho:max-w-none">
          <VistaCamara
            modoCamara={modoCamara}
            onCambiarModo={cambiarModoCamara}
            fuenteCamara="webcam"
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
            dispositivosVideo={camara.dispositivosVideo}
            idDispositivoSeleccionado={camara.idDispositivoSeleccionado}
            onSeleccionarDispositivo={camara.seleccionarDispositivo}
            onMarcaPosturaNeutra={() => marcarPosturaNeutra(camara.pose)}
            onLimpiarCalibracion={() => limpiarCalibracionPostural()}
          />
        </div>

        <aside className="space-y-4 ancho:col-start-1 ancho:row-start-1" aria-label="Estado y resumen de hoy">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <FormaEstado
                forma={presentacion.forma}
                tamano={64}
                className={clasesEstado(presentacion.tokenColor).texto}
              />
              <InsigniaEstado presentacion={presentacion} tamano="lg" />
            </CardContent>
          </Card>

          <section
            className="bg-secondary text-secondary-foreground space-y-4 rounded-xl p-4"
            aria-label="Cifras de hoy"
          >
            <Cifra
              icono={Timer}
              etiqueta="Tiempo activo"
              valor={formatearDuracion(stats.duracionActivaSegundos)}
              nota="Sin contar el tiempo que estuviste fuera"
            />
            <Cifra
              icono={Flame}
              etiqueta="Racha actual"
              valor={formatearDuracion(stats.rachaActualSegundos)}
              nota={`Tu mejor racha hoy: ${formatearDuracion(stats.mejorRachaSegundos)}`}
            />
            <Cifra
              icono={TrendingUp}
              etiqueta="Buena postura"
              valor={formatearPorcentaje(stats.proporcionBuenaPostura * 100)}
              nota={`Promedio de la sesion: ${formatearNumero(stats.promedio, 1)}`}
            />
            <Cifra
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
          </section>
        </aside>

        <Card className="ancho:sticky ancho:top-4 ancho:col-start-3 ancho:row-start-1 ancho:self-start">
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

        <Card className="lg:col-span-2 ancho:col-span-3">
          <CardHeader>
            <CardTitle>Tendencia de la sesion</CardTitle>
          </CardHeader>
          <CardContent>
            <SparklineSesion
              datos={serie}
              umbral={ajustes.notificaciones.umbralMalaPostura}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Cifra({
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
    <div className="space-y-0.5">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Icono className="size-3.5" aria-hidden />
        {etiqueta}
      </p>
      <p className="tabular text-xl font-semibold">{valor}</p>
      <p className="text-xs text-balance">{nota}</p>
    </div>
  );
}
