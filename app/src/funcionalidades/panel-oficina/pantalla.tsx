/**
 * Panel de oficina — monitoreo agregado y anonimo de varios puestos.
 *
 * Nunca muestra un puntaje individual ni identifica a nadie: solo el circulo
 * de promedio del equipo (ventana de los ultimos minutos, no del frame
 * actual) y una alerta si mas de la mitad esta en mala postura sostenida. El
 * video es el elemento protagonista -- es lo que de verdad hay que vigilar
 * cuando se monitorean varios escritorios a la vez.
 *
 * Los datos llegan automaticamente por WebSocket en cuanto `camara.encender
 * ("oficina")` abre la conexion (ver camara/use-camara.ts), no hay que
 * empujarlos desde aqui.
 */

import { useMemo } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { config } from "@/config/app.config";
import { useCamara } from "@/camara/use-camara";
import { agregarOficina, proporcionMalaPostura } from "@/dominio/agregacion-oficina";
import { estadoDesdePuntaje, PRESENTACION } from "@/dominio/maquina-estado";
import { useSimulacion } from "@/estado/simulacion";
import { AvisoDemo } from "@/componentes/comunes/avisos";
import { clasesEstado, InsigniaEstado } from "@/componentes/comunes/insignia-estado";
import { FormaEstado } from "@/componentes/comunes/forma-estado";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VistaCamara } from "@/componentes/comunes/vista-camara";

export function PantallaPanelOficina() {
  const {
    ajustes,
    modoCamara,
    activarModoCamara,
    personas,
    historialAgregadoOficina,
    estadoConexionVisionNode,
    ticketVideoOficina,
    camarasOficinaDisponibles,
    fuenteOficinaActual,
    calibracionPostural,
  } = useSimulacion();

  const camara = useCamara(ajustes.camara.muestrasPorSegundo);

  async function cambiarModoCamara(activo: boolean) {
    activarModoCamara(activo);
    if (activo) {
      await camara.encender("oficina");
    } else {
      camara.apagar();
    }
  }

  const personasActivas = useMemo(
    () => Array.from(personas.values()).filter((p) => p.id !== "local"),
    [personas],
  );

  const agregado = useMemo(() => {
    const muestras = historialAgregadoOficina.map((e) => ({ estado: e.estado, puntaje: e.puntaje }));
    return agregarOficina(
      muestras,
      personasActivas.length,
      [],
      new Date(Date.now()).toISOString(),
    );
  }, [historialAgregadoOficina, personasActivas.length]);

  const cfgAlertas = {
    umbralMalaPostura: ajustes.notificaciones.umbralMalaPostura,
    umbralExcelente: config.UMBRAL_EXCELENTE,
  };
  const estadoPromedio =
    agregado.personasActivas > 0
      ? estadoDesdePuntaje(agregado.puntajeAgregado.promedio, cfgAlertas)
      : "sin-camara";
  const presentacionPromedio = PRESENTACION[estadoPromedio];

  const alertaGrupal =
    agregado.personasActivas > 0 && proporcionMalaPostura(agregado.conteoPorEstado) > 0.5;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de oficina</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-balance">
            Monitoreo agregado y anonimo. Nadie ve el puntaje de otra persona en particular.
          </p>
        </div>
        <AvisoDemo />
      </header>

      {alertaGrupal && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium",
            clasesEstado("estado-corrige").fondo,
            clasesEstado("estado-corrige").texto,
            clasesEstado("estado-corrige").borde,
          )}
          role="alert"
        >
          <AlertTriangle className="size-4.5 shrink-0" aria-hidden />
          <span>
            Mas de la mitad del equipo lleva un rato en mala postura. Puede ser buen momento para
            una pausa activa grupal.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardContent className="pt-6">
            <VistaCamara
              modoCamara={modoCamara}
              onCambiarModo={cambiarModoCamara}
              fuenteCamara="oficina"
              personas={personas}
              estadoConexionVisionNode={estadoConexionVisionNode}
              ticketVideoOficina={ticketVideoOficina}
              estado={camara.estado}
              error={camara.error}
              origenRecursos={camara.origenRecursos}
              videoRef={camara.videoRef}
              landmarks={null}
              presentacion={presentacionPromedio}
              perspectiva="frente"
              onCambiarPerspectiva={() => {}}
              calibracionPostural={calibracionPostural}
              camarasOficinaDisponibles={camarasOficinaDisponibles}
              fuenteOficinaActual={fuenteOficinaActual}
              onCambiarFuenteOficina={camara.cambiarFuenteOficina}
              onMarcaPosturaNeutra={() => {}}
              onLimpiarCalibracion={() => {}}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <FormaEstado
              forma={presentacionPromedio.forma}
              tamano={64}
              className={clasesEstado(presentacionPromedio.tokenColor).texto}
            />
            <InsigniaEstado presentacion={presentacionPromedio} tamano="lg" />
            <p className="text-muted-foreground text-xs text-balance">
              Promedio del equipo en los ultimos {Math.round(config.VENTANA_AGREGADO_OFICINA_SEGUNDOS / 60)}{" "}
              minutos.
            </p>

            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="size-4" aria-hidden />
              {agregado.personasActivas === 0
                ? "Nadie en el encuadre"
                : agregado.personasActivas === 1
                  ? "1 persona en el encuadre"
                  : `${agregado.personasActivas} personas en el encuadre`}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
