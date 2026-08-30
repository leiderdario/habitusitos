/**
 * Franja de la bandeja del sistema.
 *
 * El producto final es una aplicacion de escritorio que vive en la bandeja de
 * Windows, no una pagina web. Esta franja existe para que el cliente vea COMO se
 * va a comportar ahi: el icono que cambia de forma y color segun el estado, el
 * menu contextual, y las notificaciones toast que aparecen abajo a la derecha.
 *
 * Es una representacion, no una simulacion del escritorio de Windows: se
 * mantiene dentro del marco de la aplicacion para no distraer del contenido.
 */

import { useEffect, useState } from "react";
import { Bell, BellOff, Pause, Play, Sparkles } from "lucide-react";
import { useSimulacion } from "@/estado/simulacion";
import { IconoBandeja } from "@/componentes/comunes/forma-estado";
import { clasesEstado } from "@/componentes/comunes/insignia-estado";
import { Button } from "@/components/ui/button";
import { formatearDuracion } from "@/utils/formato";
import { cn } from "@/lib/utils";

export function FranjaBandeja() {
  const presentacion = useSimulacion((s) => s.presentacion);
  // El icono de bandeja usa el valor suavizado: un numero que parpadea cinco
  // veces por segundo al lado del reloj seria intolerable en uso real.
  const puntaje = useSimulacion((s) => s.puntajeSuavizado);
  const corriendo = useSimulacion((s) => s.corriendo);
  const alternar = useSimulacion((s) => s.alternar);
  const t = useSimulacion((s) => s.t);
  const modoEnfoque = useSimulacion((s) => s.ajustes.general.modoEnfoque);
  const estilo = clasesEstado(presentacion.tokenColor);

  return (
    <div className="border-border bg-card flex items-center gap-3 border-b px-4 py-2">
      <span className="text-muted-foreground hidden text-xs sm:inline">
        Bandeja del sistema
      </span>

      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-2 py-1",
          estilo.fondo,
          estilo.texto,
          estilo.borde,
        )}
        // El tooltip textual es el tercer canal en la bandeja, donde no cabe
        // texto visible. Un usuario con daltonismo depende de el.
        title={`Habitusitos — ${presentacion.etiqueta} (${Math.round(puntaje)}/100)`}
      >
        <IconoBandeja forma={presentacion.forma} />
        <span className="tabular text-xs font-medium">{Math.round(puntaje)}</span>
      </div>

      <span className="text-muted-foreground hidden text-xs md:inline">
        {presentacion.etiqueta} · sesion de {formatearDuracion(t)}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {modoEnfoque && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <BellOff className="size-3.5" aria-hidden />
            Modo enfoque
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={alternar}
          aria-label={corriendo ? "Detener seguimiento" : "Iniciar seguimiento"}
        >
          {corriendo ? (
            <>
              <Pause className="size-3.5" aria-hidden />
              Detener
            </>
          ) : (
            <>
              <Play className="size-3.5" aria-hidden />
              Iniciar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Notificaciones toast, como las de Windows 10/11.
 *
 * Aparecen abajo a la derecha y se van solas. No roban el foco (`aria-live`
 * polite en vez de assertive): interrumpir a alguien que esta escribiendo seria
 * exactamente el tipo de molestia que esta aplicacion quiere evitar.
 *
 * NOTA PARA EL PRODUCTO REAL: en Python usar `windows-toasts`, no `winotify` —
 * winotify no publica desde febrero de 2022 y no tiene commits desde 2023. Hay
 * que registrar un AppUserModelID en el instalador, o el toast sale como
 * "Python" en vez de con el nombre y el icono de Habitusitos.
 */
import { reproducirSonidoAlerta } from "@/utils/sonido-alerta";

export function NotificacionesEscritorio() {
  const notificaciones = useSimulacion((s) => s.notificaciones);
  const descartar = useSimulacion((s) => s.descartarNotificacion);
  const [visibles, setVisibles] = useState<number[]>([]);

  useEffect(() => {
    const nuevas = notificaciones.map((n) => n.id).filter((id) => !visibles.includes(id));
    if (nuevas.length === 0) return;

    // Reproduce sonido sutil y claro cuando entra un aviso de postura
    const hayAlertaPostura = notificaciones.some(
      (n) => nuevas.includes(n.id) && n.tipo === "postura",
    );
    if (hayAlertaPostura) {
      reproducirSonidoAlerta();
    }

    setVisibles((v) => [...v, ...nuevas]);
    // Las toast de Windows se van solas a los pocos segundos. Que persistan
    // obligaria al usuario a cerrarlas, que es justo la friccion a evitar.
    const temporizadores = nuevas.map((id) =>
      window.setTimeout(() => {
        descartar(id);
        setVisibles((v) => v.filter((x) => x !== id));
      }, 7000),
    );
    return () => temporizadores.forEach(clearTimeout);
  }, [notificaciones, visibles, descartar]);

  if (notificaciones.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {notificaciones.map((n) => (
        <div
          key={n.id}
          className="border-border bg-card pointer-events-auto rounded-xl border p-3 shadow-lg"
        >
          <div className="flex items-start gap-2.5">
            <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Bell className="size-3.5" aria-hidden />
                {n.titulo}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm text-balance">{n.cuerpo}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => descartar(n.id)}
              aria-label="Descartar notificacion"
            >
              ×
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
