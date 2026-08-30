/**
 * Selector de tema.
 *
 * `Sistema` es el valor por defecto porque la seccion 9.1 pide adaptarse al modo
 * claro/oscuro de Windows. Los dos temas se disenaron juntos y su contraste se
 * verifico por separado: asumir que los colores del tema claro funcionan en el
 * oscuro es el error mas comun al anadir modo oscuro tarde.
 */

import { Monitor, Moon, Sun } from "lucide-react";
import type { Tema } from "@/estado/interfaz";
import { useInterfaz } from "@/estado/interfaz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPCIONES: { valor: Tema; icono: typeof Sun; etiqueta: string }[] = [
  { valor: "claro", icono: Sun, etiqueta: "Claro" },
  { valor: "oscuro", icono: Moon, etiqueta: "Oscuro" },
  { valor: "sistema", icono: Monitor, etiqueta: "Sistema" },
];

export function SelectorTema({ compacta = false }: { compacta?: boolean }) {
  const tema = useInterfaz((s) => s.tema);
  const fijar = useInterfaz((s) => s.fijarTema);

  if (compacta) {
    const actual = OPCIONES.find((o) => o.valor === tema) ?? OPCIONES[2];
    const siguiente = OPCIONES[(OPCIONES.indexOf(actual) + 1) % OPCIONES.length];
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className="w-full"
        onClick={() => fijar(siguiente.valor)}
        aria-label={`Tema: ${actual.etiqueta}. Cambiar a ${siguiente.etiqueta}.`}
        title={`Tema: ${actual.etiqueta}`}
      >
        <actual.icono className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <div
      className="bg-muted grid grid-cols-3 gap-0.5 rounded-lg p-0.5"
      role="radiogroup"
      aria-label="Tema de la interfaz"
    >
      {OPCIONES.map(({ valor, icono: Icono, etiqueta }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          onClick={() => fijar(valor)}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs transition-colors",
            "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-1",
            tema === valor
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={etiqueta}
        >
          <Icono className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">{etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
