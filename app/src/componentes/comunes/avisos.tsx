/**
 * Avisos transversales y estados de carga, vacio y error.
 *
 * Todo error termina en una accion. Ningun mensaje muestra una traza tecnica ni
 * una ruta interna: el destinatario es una persona no tecnica en un equipo que
 * el equipo de tesis no controla.
 */

import type { ReactNode } from "react";
import { AlertTriangle, Info, Loader2, RotateCcw } from "lucide-react";
import { AVISO_DEMO } from "@/config/app.config";
import { mensajeDeError } from "@/datos/cliente";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Aviso permanente de que esto es una demostracion.
 *
 * No se cierra ni se atenua. Es lo que separa una demostracion honesta de una
 * que se puede confundir con producto terminado — y este prototipo se presenta
 * ante un cliente que va a financiar el desarrollo real.
 */
export function AvisoDemo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-demo/30 bg-demo-suave text-demo flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        className,
      )}
      role="note"
    >
      <Info className="size-4 shrink-0" aria-hidden />
      <span>{AVISO_DEMO}</span>
    </div>
  );
}

export function Cargando({ texto = "Cargando..." }: { texto?: string }) {
  return (
    <div
      className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function EstadoVacio({
  titulo,
  mensaje,
  accion,
}: {
  titulo: string;
  mensaje: string;
  accion?: ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <h3 className="font-medium">{titulo}</h3>
      <p className="text-muted-foreground max-w-md text-sm text-balance">{mensaje}</p>
      {accion}
    </div>
  );
}

/**
 * Error presentable.
 *
 * Toma cualquier excepcion y la traduce con el catalogo en espanol. Siempre
 * ofrece un camino de salida: la seccion 9.2 prohibe los callejones sin salida.
 */
export function EstadoError({
  error,
  onReintentar,
}: {
  error: unknown;
  onReintentar?: () => void;
}) {
  const { titulo, mensaje, accion } = mensajeDeError(error);

  return (
    <div
      className="border-destructive/25 bg-destructive/5 flex flex-col items-start gap-3 rounded-xl border p-5"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <h3 className="font-medium">{titulo}</h3>
          <p className="text-muted-foreground text-sm">{mensaje}</p>
        </div>
      </div>
      {onReintentar && (
        <Button variant="outline" size="sm" onClick={onReintentar}>
          <RotateCcw className="size-3.5" aria-hidden />
          {accion}
        </Button>
      )}
    </div>
  );
}

/**
 * Nota de que un dato es simulado.
 *
 * Se usa donde el numero podria confundirse con una medicion real — sobre todo
 * en el benchmark, cuyas cifras NO pueden citarse en el documento de tesis.
 */
export function NotaSimulado({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground border-demo/40 border-l-2 py-0.5 pl-3 text-xs text-balance">
      {children}
    </p>
  );
}
