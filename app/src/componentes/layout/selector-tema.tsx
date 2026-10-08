/**
 * Boton de tema: sol/luna, dos estados.
 *
 * Decision del 2026-10-08 (docs/PLAN_REDISENO_ESPINKER.md, §7.3): un unico boton
 * a un clic, en la franja superior de la app y en el acceso. La primera visita sigue al sistema
 * operativo (ver estado/interfaz.ts). Los dos temas se disenaron juntos y su
 * contraste se verifica por separado en contraste.test.ts.
 *
 * El icono muestra el tema AL QUE se cambia, como en la maqueta aprobada: con
 * el modo claro activo se ve la luna.
 */

import { Moon, Sun } from "lucide-react";
import { useInterfaz } from "@/estado/interfaz";
import { Button } from "@/components/ui/button";

export function SelectorTema({ className }: { className?: string }) {
  const tema = useInterfaz((s) => s.tema);
  const fijar = useInterfaz((s) => s.fijarTema);
  const destino = tema === "oscuro" ? "claro" : "oscuro";
  const Icono = destino === "oscuro" ? Moon : Sun;
  const etiqueta = destino === "oscuro" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => fijar(destino)}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icono className="size-4" aria-hidden />
    </Button>
  );
}
