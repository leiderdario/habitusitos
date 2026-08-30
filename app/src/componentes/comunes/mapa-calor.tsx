/**
 * Mapa de calor del calendario, al estilo del grafico de contribuciones.
 *
 * DECISION DE COLOR: escala MONOCROMA teal, nunca verde a rojo. Una escala
 * verde-rojo es ilegible para el daltonismo rojo-verde, que afecta a cerca del
 * 8% de los hombres; y en una prueba con 15 a 70 participantes eso son varias
 * personas que no verian nada. Con una escala monocroma la informacion esta en
 * la LUMINANCIA, que se percibe igual con cualquier tipo de vision del color.
 *
 * El color tampoco es el unico canal: cada celda tiene tooltip con el valor
 * exacto, y los festivos llevan un patron distinto ademas del color.
 *
 * Objetivo tactil: 24x24 px minimo entre celda y separacion (WCAG 2.2, 2.5.8).
 */

import { useMemo, useState } from "react";
import type { DiaHistorial } from "@/dominio/tipos";
import { formatearDiaLargo } from "@/utils/formato";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];
const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Cinco niveles + vacio. Los cortes se eligen sobre el rango util 0-100. */
function nivelDe(promedio: number | null): 0 | 1 | 2 | 3 | 4 | 5 {
  if (promedio === null) return 0;
  if (promedio < 55) return 1;
  if (promedio < 65) return 2;
  if (promedio < 75) return 3;
  if (promedio < 85) return 4;
  return 5;
}

const CLASE_NIVEL = [
  "bg-calor-0",
  "bg-calor-1",
  "bg-calor-2",
  "bg-calor-3",
  "bg-calor-4",
  "bg-calor-5",
] as const;

interface Props {
  dias: readonly DiaHistorial[];
  className?: string;
}

export function MapaCalor({ dias, className }: Props) {
  const [activo, setActivo] = useState<DiaHistorial | null>(null);

  /** Se reparte en columnas semanales, empezando el lunes. */
  const semanas = useMemo(() => {
    if (dias.length === 0) return [];
    const salida: (DiaHistorial | null)[][] = [];
    let columna: (DiaHistorial | null)[] = [];

    const primero = new Date(`${dias[0].fecha}T12:00:00Z`);
    const relleno = (primero.getUTCDay() + 6) % 7;
    for (let i = 0; i < relleno; i++) columna.push(null);

    for (const dia of dias) {
      columna.push(dia);
      if (columna.length === 7) {
        salida.push(columna);
        columna = [];
      }
    }
    if (columna.length > 0) {
      while (columna.length < 7) columna.push(null);
      salida.push(columna);
    }
    return salida;
  }, [dias]);

  /** Etiqueta de mes sobre la primera semana en que aparece cada mes. */
  const etiquetasMes = useMemo(() => {
    const salida = new Map<number, string>();
    let ultimoMes = -1;
    semanas.forEach((semana, i) => {
      const primerDia = semana.find(Boolean);
      if (!primerDia) return;
      const mes = new Date(`${primerDia.fecha}T12:00:00Z`).getUTCMonth();
      if (mes !== ultimoMes) {
        salida.set(i, MESES[mes]);
        ultimoMes = mes;
      }
    });
    return salida;
  }, [semanas]);

  if (dias.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavia no hay historial. Aparecera aqui despues de tus primeras sesiones.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Rejilla de celdas de 24x24 px: cada boton ocupa el objetivo tactil
          minimo que exige WCAG 2.2 (criterio 2.5.8) y dentro lleva un cuadro
          visual de 18 px. Separar el area tactil del cuadro visible es lo que
          permite tener un calendario denso sin sacrificar accesibilidad. */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col">
          <div className="flex pl-7">
            {semanas.map((_, i) => (
              <span
                key={i}
                className="text-muted-foreground w-6 text-[10px] leading-none"
              >
                {etiquetasMes.get(i) ?? ""}
              </span>
            ))}
          </div>

          <div className="flex">
            <div className="flex w-7 flex-col">
              {DIAS_SEMANA.map((d, i) => (
                <span
                  key={i}
                  className="text-muted-foreground flex h-6 items-center text-[10px] leading-none"
                  aria-hidden
                >
                  {i % 2 === 0 ? d : ""}
                </span>
              ))}
            </div>

            {semanas.map((semana, i) => (
              <div key={i} className="flex flex-col">
                {semana.map((dia, j) => {
                  if (!dia) return <span key={j} className="size-6" />;

                  const nivel = nivelDe(dia.promedio);
                  const descripcion = dia.esFestivo
                    ? `${formatearDiaLargo(dia.fecha)} · ${dia.nombreFestivo} · sin uso`
                    : dia.promedio === null
                      ? `${formatearDiaLargo(dia.fecha)} · sin uso`
                      : `${formatearDiaLargo(dia.fecha)} · ${dia.promedio.toFixed(1)} puntos · ${dia.minutosActivos} min`;

                  return (
                    <button
                      key={j}
                      type="button"
                      className="group flex size-6 items-center justify-center rounded-[5px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-(--ring)"
                      onMouseEnter={() => setActivo(dia)}
                      onFocus={() => setActivo(dia)}
                      onMouseLeave={() => setActivo(null)}
                      onBlur={() => setActivo(null)}
                      aria-label={descripcion}
                      title={descripcion}
                    >
                      <span
                        className={cn(
                          "size-[18px] rounded-[4px] transition-transform group-hover:scale-115",
                          CLASE_NIVEL[nivel],
                          dia.esFestivo && "franja-demo ring-demo/50 ring-1 ring-inset",
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground min-h-5 text-xs" aria-live="polite">
          {activo
            ? activo.esFestivo
              ? `${formatearDiaLargo(activo.fecha)} — festivo: ${activo.nombreFestivo}`
              : activo.promedio === null
                ? `${formatearDiaLargo(activo.fecha)} — sin uso`
                : `${formatearDiaLargo(activo.fecha)} — ${activo.promedio.toFixed(1)} puntos en ${activo.minutosActivos} min`
            : "Pasa el cursor por un dia para ver el detalle."}
        </p>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Menos</span>
          {CLASE_NIVEL.map((clase, i) => (
            <span
              key={i}
              className={cn("size-[13px] rounded-[3px]", clase)}
              aria-hidden
            />
          ))}
          <span className="text-muted-foreground text-xs">Mas</span>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Los dias con trama diagonal son festivos en Colombia: no se espera uso.
      </p>
    </div>
  );
}
