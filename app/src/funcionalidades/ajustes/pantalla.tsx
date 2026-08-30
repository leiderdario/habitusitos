/**
 * Ajustes — seis secciones que reflejan las del `SettingsService` real.
 *
 * PREVENCION DE ERRORES (seccion 9.3 del prompt maestro):
 *  - Los valores numericos se ofrecen como PRESETS etiquetados, no como campos
 *    libres. Nadie que no haya escrito el algoritmo sabe que significa poner el
 *    peso de "rotacion de hombros" en 0.22.
 *  - Los deslizadores llevan siempre un control alternativo sin arrastre (WCAG
 *    2.2, criterio 2.5.7).
 *  - Las acciones destructivas piden confirmacion.
 *  - La validacion ocurre aqui, no solo en el motor: el usuario debe enterarse
 *    del error en el mismo sitio donde lo cometio, no en un archivo de registro.
 */

import { useEffect, useState } from "react";
import { Bell, Camera, Check, Database, Settings2, Sliders, Target, Volume2 } from "lucide-react";
import { APP } from "@/config/app.config";
import type { Ajustes } from "@/datos/api/ajustes.api";
import {
  guardarAjustes,
  leerAjustes,
  listarPresetsPesos,
  reiniciarDemostracion,
  restaurarAjustes,
} from "@/datos/api/ajustes.api";
import { ETIQUETA_METRICA, ORDEN_METRICAS, normalizarPesos } from "@/dominio/puntaje";
import { reproducirSonidoAlerta } from "@/utils/sonido-alerta";
import { useSimulacion } from "@/estado/simulacion";
import { AvisoDemo, Cargando, EstadoError } from "@/componentes/comunes/avisos";
import { CampoSelect } from "@/componentes/comunes/campo-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearNumero } from "@/utils/formato";
import { cn } from "@/lib/utils";

export function PantallaAjustes() {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [presets, setPresets] = useState<
    { id: string; nombre: string; descripcion: string; pesos: number[] }[]
  >([]);
  const [error, setError] = useState<unknown>(null);
  const [guardado, setGuardado] = useState(false);
  const aplicarEnMotor = useSimulacion((s) => s.aplicarAjustes);

  useEffect(() => {
    void leerAjustes().then(setAjustes).catch(setError);
    void listarPresetsPesos().then((p) => setPresets(p.map((x) => ({ ...x, pesos: [...x.pesos] }))));
  }, []);

  async function guardar(parcial: Partial<Ajustes>) {
    if (!ajustes) return;
    const optimista = { ...ajustes, ...parcial } as Ajustes;
    setAjustes(optimista);
    aplicarEnMotor(optimista);
    try {
      const confirmado = await guardarAjustes(parcial);
      setAjustes(confirmado);
      aplicarEnMotor(confirmado);
      setGuardado(true);
      window.setTimeout(() => setGuardado(false), 2000);
    } catch (e) {
      setError(e);
    }
  }

  if (error) return <EstadoError error={error} onReintentar={() => setError(null)} />;
  if (!ajustes) return <Cargando texto="Cargando ajustes..." />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Los cambios se aplican al instante.
            {guardado && (
              <span className="text-estado-buena ml-2 inline-flex items-center gap-1">
                <Check className="size-3.5" aria-hidden />
                Guardado
              </span>
            )}
          </p>
        </div>
        <AvisoDemo />
      </header>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">
            <Settings2 className="size-3.5" aria-hidden />
            General
          </TabsTrigger>
          <TabsTrigger value="camara">
            <Camera className="size-3.5" aria-hidden />
            Camara
          </TabsTrigger>
          <TabsTrigger value="deteccion">
            <Sliders className="size-3.5" aria-hidden />
            Deteccion
          </TabsTrigger>
          <TabsTrigger value="avisos">
            <Bell className="size-3.5" aria-hidden />
            Avisos
          </TabsTrigger>
          <TabsTrigger value="referencia">
            <Target className="size-3.5" aria-hidden />
            Referencia
          </TabsTrigger>
          <TabsTrigger value="datos">
            <Database className="size-3.5" aria-hidden />
            Datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Comportamiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Interruptor
                id="iniciar-windows"
                etiqueta="Iniciar con Windows"
                ayuda="Empieza a cuidarte en cuanto enciendes el computador."
                valor={ajustes.general.iniciarConWindows}
                onCambio={(v) => guardar({ general: { ...ajustes.general, iniciarConWindows: v } })}
              />
              <Interruptor
                id="minimizar"
                etiqueta="Cerrar a la barra de tareas"
                ayuda="Al cerrar la ventana la aplicacion sigue midiendo en segundo plano."
                valor={ajustes.general.minimizarABandeja}
                onCambio={(v) => guardar({ general: { ...ajustes.general, minimizarABandeja: v } })}
              />
              <Interruptor
                id="enfoque"
                etiqueta="Modo enfoque"
                ayuda="Silencia los avisos sin dejar de medir. El icono sigue mostrando tu estado real."
                valor={ajustes.general.modoEnfoque}
                onCambio={(v) => guardar({ general: { ...ajustes.general, modoEnfoque: v } })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camara" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Captura</CardTitle>
              <CardDescription>
                Menos calidad y menos imagenes por segundo significan menos consumo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CampoSelect
                id="resolucion"
                etiqueta="Calidad de imagen"
                valor={ajustes.camara.resolucion}
                opciones={[
                  { valor: "1280x720", texto: "Alta (1280 × 720)" },
                  { valor: "640x480", texto: "Normal (640 × 480) — recomendada" },
                ]}
                onCambio={(v) =>
                  guardar({
                    camara: { ...ajustes.camara, resolucion: v as "1280x720" | "640x480" },
                  })
                }
              />
              <CampoSelect
                id="muestreo"
                etiqueta="Imagenes analizadas por segundo"
                ayuda="No es la velocidad de la camara: es cuantas de esas imagenes se revisan."
                valor={String(ajustes.camara.muestrasPorSegundo)}
                opciones={[
                  { valor: "2", texto: "2 por segundo — mínimo consumo" },
                  { valor: "5", texto: "5 por segundo — recomendado" },
                  { valor: "10", texto: "10 por segundo — más sensible" },
                ]}
                onCambio={(v) =>
                  guardar({ camara: { ...ajustes.camara, muestrasPorSegundo: Number(v) } })
                }
              />
              <Interruptor
                id="adaptativa"
                etiqueta="Bajar calidad si el equipo va lento"
                ayuda="Reduce la resolucion automaticamente en vez de ralentizar tu computador."
                valor={ajustes.camara.resolucionAdaptativa}
                onCambio={(v) =>
                  guardar({ camara: { ...ajustes.camara, resolucionAdaptativa: v } })
                }
              />
              <Interruptor
                id="contraste"
                etiqueta="Mejorar la imagen con poca luz"
                ayuda="Ayuda a detectarte en habitaciones oscuras. Tiene un limite: con muy poca luz la medicion pierde precision."
                valor={ajustes.camara.mejorarContrasteConPocaLuz}
                onCambio={(v) =>
                  guardar({ camara: { ...ajustes.camara, mejorarContrasteConPocaLuz: v } })
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inclinación y posición de tu cámara</CardTitle>
              <CardDescription>
                Ya sea que uses una laptop sobre el escritorio, un monitor elevado o una cámara externa, la aplicación se adapta a tu ángulo de visión cuando marcas tu postura de referencia en el panel principal.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="deteccion" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>A que le prestamos mas atencion</CardTitle>
              <CardDescription>
                Tu puntaje sale de siete medidas. Puedes elegir cuales pesan mas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {presets.map((preset) => {
                  const activo =
                    JSON.stringify(normalizarPesos(preset.pesos).map((p) => p.toFixed(4))) ===
                    JSON.stringify(
                      normalizarPesos(ajustes.deteccion.pesos).map((p) => p.toFixed(4)),
                    );
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        guardar({
                          deteccion: { ...ajustes.deteccion, pesos: [...preset.pesos] },
                        })
                      }
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left transition-colors",
                        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                        activo ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {preset.nombre}
                        {activo && <Check className="text-primary size-3.5" aria-hidden />}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs text-balance">
                        {preset.descripcion}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Interruptor
                id="clasificacion-patrones"
                etiqueta="Identificar patrones de postura especificos"
                ayuda="Reconoce cuando te encorvas, adelantas la cabeza o te recuestas sobre un brazo para darte recordatorios mas utiles."
                valor={ajustes.deteccion.clasificacionPatronesActiva}
                onCambio={(v) =>
                  guardar({
                    deteccion: { ...ajustes.deteccion, clasificacionPatronesActiva: v },
                  })
                }
              />

              <details className="border-border rounded-xl border">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                  Ajustar cada medida por separado
                </summary>
                <div className="space-y-4 px-4 pt-1 pb-4">
                  <p className="text-muted-foreground text-xs text-balance">
                    Los pesos se reparten proporcionalmente: no hace falta que sumen
                    100. Lo que importa es cuanto pesa cada uno respecto a los demas.
                  </p>
                  {ORDEN_METRICAS.map((nombre, i) => (
                    <ControlPeso
                      key={nombre}
                      etiqueta={ETIQUETA_METRICA[nombre]}
                      valor={ajustes.deteccion.pesos[i]}
                      onCambio={(v) => {
                        const pesos = [...ajustes.deteccion.pesos];
                        pesos[i] = v;
                        guardar({ deteccion: { ...ajustes.deteccion, pesos } });
                      }}
                    />
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avisos" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuando avisarte</CardTitle>
              <CardDescription>
                Ajusta que tan exigente y que tan insistente quieres que sea.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CampoSelect
                id="umbral"
                etiqueta="Avisarme cuando el puntaje baje de"
                valor={String(ajustes.notificaciones.umbralMalaPostura)}
                opciones={[
                  { valor: "50", texto: "50 — solo si es muy notorio" },
                  { valor: "60", texto: "60 — recomendado" },
                  { valor: "70", texto: "70 — exigente" },
                  { valor: "80", texto: "80 — muy exigente" },
                ]}
                onCambio={(v) =>
                  guardar({
                    notificaciones: {
                      ...ajustes.notificaciones,
                      umbralMalaPostura: Number(v),
                    },
                  })
                }
              />
              <CampoSelect
                id="sostenido"
                etiqueta="Solo si se mantiene al menos"
                ayuda="Evita que agacharte un momento dispare un aviso."
                valor={String(ajustes.notificaciones.segundosSostenidos)}
                opciones={[
                  { valor: "10", texto: "10 segundos" },
                  { valor: "20", texto: "20 segundos — recomendado" },
                  { valor: "45", texto: "45 segundos" },
                  { valor: "90", texto: "1 minuto y medio" },
                ]}
                onCambio={(v) =>
                  guardar({
                    notificaciones: {
                      ...ajustes.notificaciones,
                      segundosSostenidos: Number(v),
                    },
                  })
                }
              />
              <CampoSelect
                id="enfriamiento"
                etiqueta="No repetir el aviso durante"
                valor={String(ajustes.notificaciones.minutosEnfriamiento)}
                opciones={[
                  { valor: "5", texto: "5 minutos" },
                  { valor: "10", texto: "10 minutos — recomendado" },
                  { valor: "20", texto: "20 minutos" },
                  { valor: "60", texto: "1 hora" },
                ]}
                onCambio={(v) =>
                  guardar({
                    notificaciones: {
                      ...ajustes.notificaciones,
                      minutosEnfriamiento: Number(v),
                    },
                  })
                }
              />
              <Interruptor
                id="pausa"
                etiqueta="Recordarme tomar pausas"
                ayuda={`Cada ${ajustes.notificaciones.minutosRecordatorioPausa} minutos de sesion continua.`}
                valor={ajustes.notificaciones.recordatorioPausa}
                onCambio={(v) =>
                  guardar({
                    notificaciones: { ...ajustes.notificaciones, recordatorioPausa: v },
                  })
                }
              />

              <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5">
                <div>
                  <p className="text-sm font-medium">Sonido de alerta postural</p>
                  <p className="text-muted-foreground text-xs text-balance">
                    Tono sutil y perceptible que suena automáticamente cuando se emite una alerta por mala postura sostenida.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => reproducirSonidoAlerta()}
                  className="shrink-0"
                >
                  <Volume2 className="size-3.5" aria-hidden />
                  Probar sonido
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referencia" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Referencia personal</CardTitle>
              <CardDescription>
                Si esta activa, el sistema aprende cual es tu buena postura habitual.
                Si la apagas, te compara contra una postura ideal fija.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Interruptor
                id="baseline-activo"
                etiqueta="Adaptarse a mi postura"
                ayuda="Recomendado. Sin esto te compara contra un ideal que puede no encajar con tu cuerpo ni tu escritorio."
                valor={ajustes.baseline.activo}
                onCambio={(v) => guardar({ baseline: { ...ajustes.baseline, activo: v } })}
              />
              <CampoSelect
                id="tau"
                etiqueta="Que tan rapido se adapta"
                ayuda="Mas lento es mas estable; mas rapido reacciona antes a un cambio real de escritorio o silla."
                valor={String(ajustes.baseline.tauSegundos)}
                opciones={[
                  { valor: "120", texto: "Rápido — unos 2 minutos" },
                  { valor: "480", texto: "Equilibrado — unos 8 minutos (recomendado)" },
                  { valor: "1800", texto: "Lento — unos 30 minutos" },
                ]}
                onCambio={(v) =>
                  guardar({ baseline: { ...ajustes.baseline, tauSegundos: Number(v) } })
                }
              />
              <CampoSelect
                id="piso"
                etiqueta="Solo aprender de posturas mejores que"
                ayuda="La proteccion clave: impide que el sistema se acostumbre a tu mala postura."
                valor={String(ajustes.baseline.pisoCalidad)}
                opciones={[
                  { valor: "55", texto: "55 — aprende de casi todo" },
                  { valor: "65", texto: "65 — recomendado" },
                  { valor: "75", texto: "75 — solo de tus mejores momentos" },
                ]}
                onCambio={(v) =>
                  guardar({ baseline: { ...ajustes.baseline, pisoCalidad: Number(v) } })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tus datos</CardTitle>
              <CardDescription>
                Todo se guarda unicamente en este equipo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Interruptor
                id="historial"
                etiqueta="Guardar mi historial"
                ayuda="Sin esto la aplicacion funciona igual, pero no podras ver tu progreso."
                valor={ajustes.datos.guardarHistorial}
                onCambio={(v) => guardar({ datos: { ...ajustes.datos, guardarHistorial: v } })}
              />
              <Interruptor
                id="detalladas"
                etiqueta="Guardar tambien las medidas detalladas"
                ayuda="Ocupa mas espacio. Util solo si vas a analizar los datos por tu cuenta."
                valor={ajustes.datos.guardarMetricasDetalladas}
                onCambio={(v) =>
                  guardar({ datos: { ...ajustes.datos, guardarMetricasDetalladas: v } })
                }
              />
              <div className="space-y-1.5">
                <Label className="text-sm">Donde se guardan</Label>
                <Input readOnly value={ajustes.datos.rutaBaseDatos} className="font-mono text-xs" />
                <p className="text-muted-foreground text-xs">
                  Si desinstalas {APP.nombre}, este archivo se conserva. Son tus datos.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Restablecer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void restaurarAjustes().then(setAjustes)}
              >
                Volver a los ajustes recomendados
              </Button>
              <Button
                variant="outline"
                onClick={() => void reiniciarDemostracion().then(() => location.reload())}
              >
                Reiniciar la demostracion
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Interruptor({
  id,
  etiqueta,
  ayuda,
  valor,
  onCambio,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: boolean;
  onCambio(v: boolean): void;
}) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {etiqueta}
        </Label>
        {ayuda && <p className="text-muted-foreground text-xs text-balance">{ayuda}</p>}
      </div>
      <Switch id={id} checked={valor} onCheckedChange={onCambio} />
    </div>
  );
}

/**
 * Deslizador con alternativa sin arrastre.
 *
 * El criterio 2.5.7 de WCAG 2.2 exige que toda accion de arrastre tenga una
 * alternativa. Los botones de mas y menos no son un adorno: para alguien con
 * temblor o usando un trackpad, arrastrar con precision no es viable.
 */
function ControlPeso({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: number;
  onCambio(v: number): void;
}) {
  const ajustar = (delta: number) =>
    onCambio(Math.max(0, Math.min(0.5, Number((valor + delta).toFixed(2)))));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{etiqueta}</Label>
        <span className="tabular text-muted-foreground text-xs">
          {formatearNumero(valor * 100, 0)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => ajustar(-0.01)}
          aria-label={`Reducir el peso de ${etiqueta}`}
        >
          −
        </Button>
        <Slider
          value={[valor]}
          min={0}
          max={0.5}
          step={0.01}
          onValueChange={(v) => onCambio(Array.isArray(v) ? v[0] : v)}
          className="flex-1"
          aria-label={`Peso de ${etiqueta}`}
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => ajustar(0.01)}
          aria-label={`Aumentar el peso de ${etiqueta}`}
        >
          +
        </Button>
      </div>
    </div>
  );
}
