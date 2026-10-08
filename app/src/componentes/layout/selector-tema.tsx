/**
 * Boton de tema: sol/luna, dos estados.
 *
 * Decision del 2026-10-08 (docs/PLAN_REDISENO_ESPINKER.md, §7.3): un unico boton
 * a un clic, visible tambien en el acceso. La primera visita sigue al sistema
 * operativo (ver estado/interfaz.ts). Los dos temas se disenaron juntos y su
 * contraste se verifica por separado en contraste.test.ts.
 *
 * El icono muestra el tema AL QUE se cambia, como en la maqueta aprobada: con
 * el modo claro activo se ve la luna.
 */

import { Moon, Sun } from "lucide-react";
import { useInterfaz } from "@/estado/interfaz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SelectorTema({
  conTexto = false,
  className,
}: {
  conTexto?: boolean;
  className?: string;
}) {
  const tema = useInterfaz((s) => s.tema);
  const fijar = useInterfaz((s) => s.fijarTema);
  const destino = tema === "oscuro" ? "claro" : "oscuro";
  const Icono = destino === "oscuro" ? Moon : Sun;
  const etiqueta = destino === "oscuro" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";

  return (
    <Button
      type="button"
      variant="ghost"
      size={conTexto ? "sm" : "icon"}
      className={cn(conTexto && "w-full justify-start", className)}
      onClick={() => fijar(destino)}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icono className="size-4" aria-hidden />
      {conTexto && (destino === "oscuro" ? "Modo oscuro" : "Modo claro")}
    </Button>
  );
}
