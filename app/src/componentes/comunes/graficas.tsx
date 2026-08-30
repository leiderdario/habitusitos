/**
 * Graficas del prototipo, sobre Recharts.
 *
 * REGLAS DE DATOS QUE SE APLICAN AQUI (WCAG 2.2 y buenas practicas de dataviz):
 *  - Ningun dato se distingue SOLO por color. Las series llevan etiqueta directa
 *    o leyenda, y las bandas de umbral llevan texto.
 *  - Las lineas de rejilla van en bajo contraste para no competir con los datos.
 *  - Contraste minimo 3:1 entre dato y fondo (criterio 1.4.11).
 *  - Todo grafico tiene estado vacio explicito: un eje sin datos parece un error
 *    de carga, no una ausencia de informacion.
 *  - Cifras tabulares en tooltips y ejes para que no salten de ancho.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const EJE = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const REJILLA = { stroke: "var(--border)", strokeDasharray: "3 3", vertical: false };

/** Contenedor con estado vacio. Nunca se renderiza un eje sin datos. */
export function Grafica({
  alto = 220,
  hayDatos,
  mensajeVacio = "Todavia no hay datos suficientes para esta vista.",
  children,
  className,
}: {
  alto?: number;
  hayDatos: boolean;
  mensajeVacio?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!hayDatos) {
    return (
      <div
        className={cn(
          "border-border text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-balance",
          className,
        )}
        style={{ height: alto }}
      >
        {mensajeVacio}
      </div>
    );
  }
  return (
    <div className={className} style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

function CajaTooltip({ filas }: { filas: { etiqueta: string; valor: string }[] }) {
  return (
    <div className="bg-popover text-popover-foreground border-border rounded-lg border px-3 py-2 text-xs shadow-md">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{f.etiqueta}</span>
          <span className="tabular font-medium">{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline de la sesion
// ---------------------------------------------------------------------------

export function SparklineSesion({
  datos,
  umbral,
  alto = 160,
}: {
  datos: { t: number; score: number }[];
  umbral: number;
  alto?: number;
}) {
  return (
    <Grafica alto={alto} hayDatos={datos.length > 1} mensajeVacio="La sesion acaba de empezar.">
      <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id="degradadoSesion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...REJILLA} />
        <XAxis
          dataKey="t"
          {...EJE}
          tickFormatter={(v: number) => `${Math.round(v / 60)} min`}
          minTickGap={40}
        />
        <YAxis domain={[0, 100]} {...EJE} width={46} />
        {/* La banda de umbral lleva etiqueta de texto: sin ella, una linea
            punteada de color no comunica nada por si sola. */}
        <ReferenceLine
          y={umbral}
          stroke="var(--estado-regular)"
          strokeDasharray="5 4"
          label={{
            value: `Umbral de aviso (${umbral})`,
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <CajaTooltip
                filas={[
                  { etiqueta: "Minuto", valor: `${Math.round((payload[0].payload.t as number) / 60)}` },
                  { etiqueta: "Puntaje", valor: (payload[0].value as number).toFixed(1) },
                ]}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#degradadoSesion)"
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </Grafica>
  );
}

// ---------------------------------------------------------------------------
// Comparacion por dia de la semana
// ---------------------------------------------------------------------------

export function BarrasDiaSemana({
  datos,
  umbral,
}: {
  datos: { etiqueta: string; promedio: number }[];
  umbral: number;
}) {
  const peor = datos.reduce(
    (min, d) => (d.promedio > 0 && d.promedio < min.promedio ? d : min),
    { etiqueta: "", promedio: Infinity },
  );

  return (
    <Grafica alto={240} hayDatos={datos.some((d) => d.promedio > 0)}>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis dataKey="etiqueta" {...EJE} tickFormatter={(v: string) => v.slice(0, 3)} />
        <YAxis domain={[0, 100]} {...EJE} width={46} />
        <ReferenceLine y={umbral} stroke="var(--estado-regular)" strokeDasharray="5 4" />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <CajaTooltip
                filas={[
                  { etiqueta: String(label), valor: `${(payload[0].value as number).toFixed(1)} pts` },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="promedio" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {datos.map((d) => (
            // El peor dia se resalta con otro color Y se nombra en el texto que
            // acompana la grafica: el color solo no comunicaria cual es.
            <Cell
              key={d.etiqueta}
              fill={d.etiqueta === peor.etiqueta ? "var(--chart-4)" : "var(--chart-1)"}
            />
          ))}
        </Bar>
      </BarChart>
    </Grafica>
  );
}

// ---------------------------------------------------------------------------
// Tendencia semanal
// ---------------------------------------------------------------------------

export function LineaTendencia({
  datos,
}: {
  datos: { semana: string; promedio: number }[];
}) {
  return (
    <Grafica alto={240} hayDatos={datos.length > 1}>
      <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis
          dataKey="semana"
          {...EJE}
          tickFormatter={(v: string) => v.slice(5)}
          minTickGap={28}
        />
        <YAxis domain={[40, 100]} {...EJE} width={46} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <CajaTooltip
                filas={[
                  { etiqueta: "Semana del", valor: String(label) },
                  { etiqueta: "Promedio", valor: `${(payload[0].value as number).toFixed(1)} pts` },
                ]}
              />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="promedio"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--chart-1)" }}
          isAnimationActive={false}
        />
      </LineChart>
    </Grafica>
  );
}

// ---------------------------------------------------------------------------
// Evolucion del baseline adaptativo (aporte 1)
// ---------------------------------------------------------------------------

export function GraficaBaseline({
  datos,
  optimo,
  derivaMaxima,
  alto = 300,
}: {
  datos: { i: number; baseline: number; muestra: number; aceptada: boolean }[];
  optimo: number;
  derivaMaxima: number;
  alto?: number;
}) {
  const aceptadas = datos.filter((d) => d.aceptada);
  const rechazadas = datos.filter((d) => !d.aceptada);

  return (
    <Grafica
      alto={alto}
      hayDatos={datos.length > 1}
      mensajeVacio="Todavia no hay suficientes muestras para mostrar la evolucion."
    >
      <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis
          type="number"
          dataKey="i"
          {...EJE}
          name="Muestra"
          tickFormatter={(v: number) => `${v}`}
        />
        <YAxis type="number" dataKey="muestra" domain={[0.4, 1]} {...EJE} width={46} />

        {/* Banda de deriva maxima: la salvaguarda 3 hecha visible. Es el limite
            del que la linea del baseline no puede salir por construccion. */}
        <ReferenceArea
          y1={optimo - derivaMaxima}
          y2={optimo + derivaMaxima}
          fill="var(--chart-1)"
          fillOpacity={0.14}
          stroke="var(--chart-1)"
          strokeOpacity={0.5}
          strokeDasharray="4 4"
        />
        {/* El limite inferior es el que importa: es contra el que choca la
            referencia cuando la postura se relaja. Va rotulado porque una linea
            punteada suelta no explica nada. */}
        <ReferenceLine
          y={optimo - derivaMaxima}
          stroke="var(--chart-1)"
          strokeOpacity={0.75}
          strokeDasharray="4 4"
          label={{
            value: "Limite: no puede bajar de aqui",
            position: "insideBottomRight",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />
        <ReferenceLine
          y={optimo}
          stroke="var(--chart-3)"
          strokeDasharray="6 3"
          label={{
            value: "Optimo ergonomico",
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />

        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof datos)[number];
            return (
              <CajaTooltip
                filas={[
                  { etiqueta: "Muestra", valor: d.muestra.toFixed(3) },
                  { etiqueta: "Referencia", valor: d.baseline.toFixed(3) },
                  { etiqueta: "Estado", valor: d.aceptada ? "Aceptada" : "Rechazada" },
                ]}
              />
            );
          }}
        />

        <Scatter
          name="Aceptadas"
          data={aceptadas}
          fill="var(--baseline-aceptada)"
          shape="circle"
          isAnimationActive={false}
        />
        {/* Las rechazadas usan otro color Y otra forma (cruz): a simple vista se
            distinguen sin depender del color. */}
        <Scatter
          name="Rechazadas"
          data={rechazadas}
          fill="var(--baseline-rechazada)"
          shape="cross"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="baseline"
          data={datos}
          stroke="var(--baseline-linea)"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
          legendType="none"
        />
      </ScatterChart>
    </Grafica>
  );
}

// ---------------------------------------------------------------------------
// Series del benchmark (aporte 2)
// ---------------------------------------------------------------------------

export function SerieBenchmark({
  datos,
  clave,
  etiqueta,
  unidad,
  calentamientoHasta,
  color = "var(--chart-1)",
  alto = 200,
}: {
  datos: { s: number; valor: number }[];
  clave: string;
  etiqueta: string;
  unidad: string;
  calentamientoHasta: number;
  color?: string;
  alto?: number;
}) {
  return (
    <Grafica alto={alto} hayDatos={datos.length > 1}>
      <AreaChart data={datos} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis dataKey="s" {...EJE} tickFormatter={(v: number) => `${v}s`} minTickGap={36} />
        <YAxis {...EJE} width={46} />

        {/* La zona de calentamiento se sombrea y se etiqueta. Es la parte que NO
            entra en el promedio: omitirla del grafico ocultaria la metodologia. */}
        <ReferenceArea
          x1={0}
          x2={calentamientoHasta}
          fill="var(--muted-foreground)"
          fillOpacity={0.1}
          label={{
            // `insideTop` centra el texto sobre una banda estrecha y lo recorta
            // por la izquierda. Anclado a la derecha cabe entero.
            value: "Calentamiento descartado",
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />

        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <CajaTooltip
                filas={[
                  { etiqueta: "Segundo", valor: String(label) },
                  {
                    etiqueta,
                    valor: `${(payload[0].value as number).toFixed(1)} ${unidad}`,
                  },
                ]}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="valor"
          name={clave}
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.12}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </Grafica>
  );
}
