/**
 * Primera ejecucion — cinco pasos.
 *
 * Es la pantalla mas importante del producto y la que menos se suele cuidar. La
 * prueba se hace con 15 a 70 personas no tecnicas, en sus propios equipos, muchas
 * veces sin nadie al lado: si el onboarding no se puede completar solo, no hay
 * datos que recoger.
 *
 * Decisiones que vienen del prompt maestro (seccion 9.2.1):
 *  - La privacidad se explica ANTES de pedir la camara, no despues. Pedir permiso
 *    primero y explicar luego es como se pierde la confianza de un participante.
 *  - La calibracion dice "sientate como normalmente te sientas, no te alinees
 *    perfecto". Si la persona posa, la referencia queda inservible.
 *  - El ultimo paso dice DONDE encontrar la aplicacion. Vive en la bandeja: sin
 *    esto, la gente cierra la ventana y cree que la desinstalo.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Eye,
  HardDrive,
  Loader2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { APP, config } from "@/config/app.config";
import {
  DURACION_CALIBRACION_MS,
  listarCamaras,
  probarCamara,
} from "@/datos/api/sesion.api";
import type { DispositivoCamara } from "@/datos/api/sesion.api";
import { marcarOnboardingCompletado } from "@/datos/api/ajustes.api";
import { mensajeDeError } from "@/datos/cliente";
import { AvisoDemo } from "@/componentes/comunes/avisos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PASOS = ["Bienvenida", "Privacidad", "Camara", "Calibracion", "Listo"];

export function PantallaOnboarding() {
  const [paso, setPaso] = useState(0);
  const navegar = useNavigate();

  const avanzar = () => setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  const retroceder = () => setPaso((p) => Math.max(0, p - 1));

  async function terminar() {
    await marcarOnboardingCompletado();
    navegar("/");
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Sparkles className="size-4" aria-hidden />
            </span>
            {APP.nombre}
          </span>
          <AvisoDemo />
        </div>

        {/* Indicador de progreso: en un flujo de varios pasos hay que saber
            cuantos faltan, o la gente abandona a mitad. */}
        <ol className="flex items-center gap-1.5" aria-label="Progreso de la configuracion">
          {PASOS.map((nombre, i) => (
            <li key={nombre} className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1 rounded-full transition-colors",
                  i <= paso ? "bg-primary" : "bg-muted",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[11px]",
                  i === paso ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {nombre}
              </span>
            </li>
          ))}
        </ol>

        <Card>
          <CardContent className="min-h-[22rem] pt-6">
            {paso === 0 && <PasoBienvenida />}
            {paso === 1 && <PasoPrivacidad />}
            {paso === 2 && <PasoCamara onListo={avanzar} />}
            {paso === 3 && <PasoCalibracion onListo={avanzar} />}
            {paso === 4 && <PasoFinal />}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={retroceder} disabled={paso === 0}>
            <ArrowLeft className="size-4" aria-hidden />
            Atras
          </Button>

          {paso < 2 && (
            <Button onClick={avanzar}>
              Continuar
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
          {paso === 4 && (
            <Button onClick={terminar}>
              Empezar a usar {APP.nombre}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PasoBienvenida() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hola. Vamos a cuidar tu espalda.
      </h1>
      <p className="text-muted-foreground text-sm text-balance">
        {APP.nombre} usa la camara de tu computador para revisar como estas
        sentado. Cuando llevas un buen rato en una postura que te puede cansar, te
        manda un recordatorio. Nada mas.
      </p>
      <ul className="space-y-2.5 text-sm">
        <Punto>No te interrumpe si vas bien. Solo habla cuando hace falta.</Punto>
        <Punto>Vive en la barra de tareas, sin ventanas abiertas todo el dia.</Punto>
        <Punto>Todo pasa dentro de tu computador. Nada se sube a internet.</Punto>
      </ul>
      <p className="text-muted-foreground text-xs">
        La configuracion toma menos de un minuto.
      </p>
    </div>
  );
}

function PasoPrivacidad() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Antes de pedirte la camara
      </h1>
      <p className="text-muted-foreground text-sm text-balance">
        Es justo que sepas exactamente que pasa con tu video antes de darnos
        permiso.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-estado-buena/25 bg-estado-buena-suave rounded-xl border p-4">
          <p className="text-estado-buena flex items-center gap-1.5 text-sm font-medium">
            <Check className="size-4" aria-hidden />
            Lo que si hacemos
          </p>
          <ul className="text-muted-foreground mt-2 space-y-1.5 text-xs">
            <li>Calcular angulos de tu cuello, hombros y espalda.</li>
            <li>Guardar esos numeros en tu computador, para ver tu progreso.</li>
            <li>Avisarte cuando llevas rato en mala postura.</li>
          </ul>
        </div>

        <div className="border-estado-corrige/25 bg-estado-corrige-suave rounded-xl border p-4">
          <p className="text-estado-corrige flex items-center gap-1.5 text-sm font-medium">
            <Eye className="size-4" aria-hidden />
            Lo que nunca hacemos
          </p>
          <ul className="text-muted-foreground mt-2 space-y-1.5 text-xs">
            <li>Guardar el video o tomar fotos.</li>
            <li>Enviar nada a internet ni a ningun servidor.</li>
            <li>Grabar audio. Ni siquiera pedimos el microfono.</li>
          </ul>
        </div>
      </div>

      <div className="text-muted-foreground space-y-2 text-xs">
        <p className="flex items-start gap-2">
          <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Tus datos se guardan en un archivo en tu equipo. Puedes borrarlos cuando
          quieras desde Ajustes.
        </p>
        <p className="flex items-start gap-2">
          <WifiOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {APP.nombre} funciona sin conexion a internet.
        </p>
        <p className="flex items-start gap-2">
          <Camera className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          La luz de tu camara va a estar encendida mientras la aplicacion esta
          midiendo. Es normal: significa que esta funcionando, no que este grabando.
        </p>
      </div>
    </div>
  );
}

function PasoCamara({ onListo }: { onListo(): void }) {
  const [camaras, setCamaras] = useState<DispositivoCamara[] | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    void listarCamaras().then((lista) => {
      setCamaras(lista);
      setElegida(lista.find((c) => c.disponible)?.id ?? null);
    });
  }, []);

  async function probar() {
    if (elegida === null) return;
    setProbando(true);
    setError(null);
    try {
      await probarCamara(elegida);
      onListo();
    } catch (e) {
      setError(e);
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Elige tu camara</h1>
      <p className="text-muted-foreground text-sm text-balance">
        Si tienes varias, escoge la que te enfoque de frente mientras trabajas.
      </p>

      {!camaras ? (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Buscando camaras...
        </div>
      ) : (
        <div className="space-y-2" role="radiogroup" aria-label="Camaras disponibles">
          {camaras.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={elegida === c.id}
              disabled={!c.disponible}
              onClick={() => setElegida(c.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                elegida === c.id ? "border-primary bg-primary/5" : "border-border",
                !c.disponible && "cursor-not-allowed opacity-60",
              )}
            >
              <Camera className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{c.nombre}</span>
                <span className="text-muted-foreground block text-xs">
                  {c.disponible ? c.resolucion : c.motivo}
                </span>
              </span>
              {elegida === c.id && <Check className="text-primary size-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}

      {error !== null && (
        <div className="border-destructive/25 bg-destructive/5 rounded-lg border p-3" role="alert">
          <p className="text-sm font-medium">{mensajeDeError(error).titulo}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {mensajeDeError(error).mensaje}
          </p>
        </div>
      )}

      <Button onClick={probar} disabled={elegida === null || probando}>
        {probando ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Probando camara...
          </>
        ) : (
          <>
            Probar y continuar
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Button>
    </div>
  );
}

function PasoCalibracion({ onListo }: { onListo(): void }) {
  const [estado, setEstado] = useState<"listo" | "contando" | "midiendo" | "hecho">("listo");
  // El tipo explicito es necesario: `config` es `as const`, asi que
  // SEGUNDOS_CALIBRACION es el literal 6 y no un `number`.
  const [restante, setRestante] = useState<number>(config.SEGUNDOS_CALIBRACION);

  useEffect(() => {
    if (estado !== "midiendo") return;
    const inicio = Date.now();
    const t = window.setInterval(() => {
      const pasados = (Date.now() - inicio) / 1000;
      const queda = config.SEGUNDOS_CALIBRACION - pasados;
      if (queda <= 0) {
        clearInterval(t);
        setRestante(0);
        setEstado("hecho");
      } else {
        setRestante(queda);
      }
    }, 100);
    return () => clearInterval(t);
  }, [estado]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Vamos a conocer tu postura
      </h1>
      <p className="text-muted-foreground text-sm text-balance">
        Durante {config.SEGUNDOS_CALIBRACION} segundos vamos a mirar como te
        sientas normalmente.{" "}
        <strong className="text-foreground">
          Sientate como te sientas siempre, no te alinees perfecto.
        </strong>{" "}
        Si posas para la camara, la referencia queda mal y despues te va a avisar
        de mas.
      </p>

      <div className="bg-muted flex aspect-video items-center justify-center rounded-xl">
        {estado === "midiendo" ? (
          <div className="flex flex-col items-center gap-3">
            <span className="tabular text-5xl font-semibold">
              {Math.ceil(restante)}
            </span>
            <span className="text-muted-foreground text-sm">
              Quedate como estas...
            </span>
          </div>
        ) : estado === "hecho" ? (
          <div className="text-estado-buena flex flex-col items-center gap-2">
            <Check className="size-10" aria-hidden />
            <span className="text-sm font-medium">Listo. Ya te conocemos.</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            Cuando estes comodo, pulsa el boton.
          </span>
        )}
      </div>

      {estado === "hecho" ? (
        <Button onClick={onListo}>
          Continuar
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      ) : (
        <Button onClick={() => setEstado("midiendo")} disabled={estado === "midiendo"}>
          {estado === "midiendo"
            ? `Midiendo... ${Math.ceil(restante)} s`
            : "Empezar la medicion"}
        </Button>
      )}

      <p className="text-muted-foreground text-xs text-balance">
        Puedes repetir esta medicion cuando quieras desde Ajustes — por ejemplo si
        cambias de silla o de escritorio. Toma {DURACION_CALIBRACION_MS / 1000}{" "}
        segundos.
      </p>
    </div>
  );
}

function PasoFinal() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Todo listo</h1>
      <p className="text-muted-foreground text-sm text-balance">
        {APP.nombre} ya esta cuidandote. A partir de ahora trabaja solo, en segundo
        plano.
      </p>

      <div className="border-border bg-muted/40 space-y-3 rounded-xl border p-4">
        <p className="text-sm font-medium">Donde encontrarlo</p>
        <p className="text-muted-foreground text-xs text-balance">
          {APP.nombre} no deja una ventana abierta. Vive en la esquina inferior
          derecha de tu pantalla, al lado del reloj. Haz clic ahi cuando quieras ver
          como vas o cambiar algo.
        </p>
        <div className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-muted-foreground text-xs">Barra de tareas</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="bg-estado-buena/15 text-estado-buena rounded px-1.5 py-0.5 text-[11px] font-medium">
              {APP.nombre}
            </span>
            <span className="text-muted-foreground text-xs">10:42 p. m.</span>
          </span>
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        <Punto>Si te encorvas un buen rato, te llega un aviso discreto.</Punto>
        <Punto>Si te levantas, se pausa solo. No cuenta como mala postura.</Punto>
        <Punto>Cada 50 minutos te recuerda tomar una pausa breve.</Punto>
      </ul>
    </div>
  );
}

function Punto({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="bg-accent/15 text-accent mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
        <Check className="size-2.5" aria-hidden />
      </span>
      <span className="text-muted-foreground text-balance">{children}</span>
    </li>
  );
}
