/**
 * Desglose de las siete metricas con divulgacion progresiva (Progressive Disclosure).
 *
 * Por defecto muestra solo la metrica que mas resta. Las otras 6 metricas estan
 * colapsadas detras de un control explicito para optimizar el espacio vertical
 * y la carga cognitiva del usuario.
 *
 * Si alguna metrica no esta disponible por visibilidad insuficiente (ej: encuadre
 * tipo selfie sin caderas visibles), se informa con honestidad en lenguaje llano
 * sin penalizar el puntaje con numeros inventados.
 */

import { useState } from "react";
import type { MetricasDisponibilidad, MetricasPostura, NombreMetrica } from "@/dominio/tipos";
import { AYUDA_METRICA, ETIQUETA_METRICA, ORDEN_METRICAS } from "@/dominio/puntaje";
import { formatearNumero } from "@/utils/formato";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info, EyeOff } from "lucide-react";

interface Props {
  metricas: MetricasPostura;
  aportes: MetricasPostura;
  pesos: readonly number[];
  disponibilidad?: MetricasDisponibilidad;
  className?: string;
}

/** Color por calidad de la metrica. */
function claseBarra(valor: number): string {
  if (valor >= 0.82) return "bg-estado-buena";
  if (valor >= 0.6) return "bg-estado-regular";
  return "bg-estado-corrige";
}

export function DesgloseMetricas({
  metricas,
  aportes,
  pesos,
  disponibilidad,
  className,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const total = ORDEN_METRICAS.reduce((a, n) => a + (aportes[n] ?? 0), 0);
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);

  function estaDisponible(nombre: NombreMetrica): boolean {
    return disponibilidad ? disponibilidad[nombre] !== false : true;
  }

  function perdida(nombre: NombreMetrica): number {
    if (!estaDisponible(nombre)) return 0;
    const pesoNorm = pesos[ORDEN_METRICAS.indexOf(nombre)] / sumaPesos;
    return (1 - metricas[nombre]) * pesoNorm * 100;
  }

  // Metricas disponibles
  const metricasDisponibles = ORDEN_METRICAS.filter((n) => estaDisponible(n));
  const noDisponibles = ORDEN_METRICAS.filter((n) => !estaDisponible(n));

  // La peor medida entre las disponibles
  const peor: NombreMetrica =
    metricasDisponibles.length > 0
      ? metricasDisponibles.reduce((a, b) => (perdida(b) > perdida(a) ? b : a))
      : "cuelloVertical";

  const hayAlgoQueCorregir = estaDisponible(peor) && perdida(peor) >= 0.5;

  const renderFilaMetrica = (nombre: NombreMetrica, esDestacada = false) => {
    const disponible = estaDisponible(nombre);
    const valor = metricas[nombre];
    const pesoNorm = pesos[ORDEN_METRICAS.indexOf(nombre)] / sumaPesos;
    const cuestaPuntos = perdida(nombre);

    return (
      <li key={nombre} className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium flex items-center gap-1.5">
            {ETIQUETA_METRICA[nombre]}
            {esDestacada && hayAlgoQueCorregir && (
              <span className="bg-estado-regular-suave text-estado-regular rounded px-1.5 py-0.5 text-[10px] font-medium">
                la que mas resta
              </span>
            )}
            {!disponible && (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-1">
                <EyeOff className="size-2.5" /> No visible
              </span>
            )}
          </span>
          <span className="tabular text-muted-foreground text-xs whitespace-nowrap">
            {!disponible
              ? "sin penalizar"
              : cuestaPuntos >= 0.5
                ? `-${formatearNumero(cuestaPuntos, 1)} pts`
                : "sin perdida"}
          </span>
        </div>

        {disponible ? (
          <div className="flex items-center gap-2">
            <div
              className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
              role="meter"
              aria-valuenow={Math.round(valor * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${ETIQUETA_METRICA[nombre]}: ${Math.round(valor * 100)} de 100`}
            >
              <div
                className={cn("h-full rounded-full transition-all duration-500", claseBarra(valor))}
                style={{ width: `${Math.max(2, valor * 100)}%` }}
              />
            </div>
            <span className="tabular w-9 text-right text-xs font-medium">
              {Math.round(valor * 100)}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic bg-muted/40 rounded px-2 py-1">
            Necesito verte un poco mas de cuerpo para medir esto bien.
          </p>
        )}

        <p className="text-muted-foreground text-xs">
          {AYUDA_METRICA[nombre]}{" "}
          <span className="opacity-70">
            Pesa {formatearNumero(pesoNorm * 100, 0)}% del total.
          </span>
        </p>
      </li>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Resumen principal: lo que mas resta */}
      {hayAlgoQueCorregir ? (
        <p className="text-muted-foreground text-xs">
          Lo que mas te esta restando ahora:{" "}
          <span className="text-foreground font-medium">{ETIQUETA_METRICA[peor]}</span>.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Tu postura se mantiene equilibrada en todas las medidas activas.
        </p>
      )}

      {/* Aviso honesto si hay puntos fuera de cuadro */}
      {noDisponibles.length > 0 && (
        <div className="bg-muted/50 border border-border/60 rounded-md p-2 text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          <span>
            {noDisponibles.length === 1
              ? `La metrica "${ETIQUETA_METRICA[noDisponibles[0]]}" no esta visible en tu encuadre actual; el puntaje se calcula con las otras ${metricasDisponibles.length}.`
              : `${noDisponibles.length} metricas no estan visibles en el encuadre; el puntaje se recalcula sobre las medidas disponibles.`}
          </span>
        </div>
      )}

      {/* VISTA COLAPSADA (POR DEFECTO): Solo la metrica que mas resta */}
      {!expandido ? (
        <ul className="space-y-2.5">
          {renderFilaMetrica(peor, true)}
        </ul>
      ) : (
        /* VISTA EXPANDIDA: Las 7 metricas en orden canonico */
        <ul className="space-y-2.5">
          {ORDEN_METRICAS.map((nombre) => renderFilaMetrica(nombre, nombre === peor))}
        </ul>
      )}

      {/* Control explicito para expandir / colapsar las 7 metricas */}
      <div className="pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandido((prev) => !prev)}
          className="w-full text-xs h-8 flex items-center justify-center gap-1.5"
          aria-expanded={expandido}
        >
          {expandido ? (
            <>
              <ChevronUp className="size-3.5" />
              Ocultar desglose completo
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              Ver las 7 metricas
            </>
          )}
        </Button>
      </div>

      {/* Nota al pie: suma total transparente */}
      <p className="text-muted-foreground border-border border-t pt-2.5 text-xs">
        {noDisponibles.length > 0
          ? `Las ${metricasDisponibles.length} medidas visibles suman `
          : "Las siete medidas suman "}
        <span className="tabular text-foreground font-medium">
          {formatearNumero(total, 1)}
        </span>{" "}
        puntos, que es el puntaje total.
      </p>
    </div>
  );
}
