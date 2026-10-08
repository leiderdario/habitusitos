/**
 * Vista de equipo para el rol RRHH/jefe (Fase 8). Aporte propio de Habitusitos.
 *
 * Es gestion de riesgo, no vigilancia nombre por nombre: solo agregados por dia de
 * toda la organizacion, sin ranking de personas. Los dias con pocas fuentes ni
 * siquiera llegan (la base los omite), asi que un hueco aqui es privacidad, no error.
 */

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { obtenerResumenEquipo } from "@/datos/api/equipo.api";
import { totalesEquipo } from "@/dominio/resumen-equipo";
import type { ResumenEquipoDia } from "@/dominio/resumen-equipo";
import { Cargando, EstadoError, EstadoVacio } from "@/componentes/comunes/avisos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearNumero } from "@/utils/formato";

export function PantallaEquipo() {
  const [dias, setDias] = useState<ResumenEquipoDia[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function cargar() {
    setError(null);
    try {
      setDias(await obtenerResumenEquipo(28));
    } catch (e) {
      setError(e);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  if (error) return <EstadoError error={error} onReintentar={cargar} />;
  if (!dias) return <Cargando texto="Cargando el resumen del equipo..." />;

  const t = totalesEquipo(dias);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-balance">
          Resumen de los ultimos 28 dias de toda la organizacion. No muestra personas, solo el
          conjunto.
        </p>
      </header>

      <div
        className="border-demo/30 bg-demo-suave text-demo flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs"
        role="note"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Solo se muestran los dias con al menos 5 cuentas activas, para que ningun dato se pueda
          atribuir a una persona. Si un dia falta, es por esa razon.
        </span>
      </div>

      {dias.length === 0 ? (
        <EstadoVacio
          titulo="Todavia no hay datos que mostrar"
          mensaje="Aparecera aqui cuando haya dias con suficientes cuentas activas."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tarjeta titulo="Dias con datos" valor={String(t.diasConDatos)} />
            <Tarjeta
              titulo="Mala postura"
              valor={t.porcentajeMalaPostura === null ? "—" : `${formatearNumero(t.porcentajeMalaPostura, 1)} %`}
              detalle="del tiempo monitoreado"
            />
            <Tarjeta
              titulo="Tiempo monitoreado"
              valor={`${formatearNumero(t.minutos / 60, 0)} h`}
              detalle="sumando todas las cuentas"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Por dia</CardTitle>
              <CardDescription>Mas reciente primero.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1.5 pr-4 font-medium">Fecha</th>
                    <th className="py-1.5 pr-4 font-medium">Cuentas activas</th>
                    <th className="py-1.5 pr-4 font-medium">Mala postura</th>
                    <th className="py-1.5 font-medium">Horas</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {[...dias].reverse().map((d) => (
                    <tr key={d.fecha} className="border-border border-t">
                      <td className="py-1.5 pr-4">{d.fecha}</td>
                      <td className="py-1.5 pr-4">{d.fuentes_activas}</td>
                      <td className="py-1.5 pr-4">
                        {d.porcentaje_mala_postura === null
                          ? "—"
                          : `${formatearNumero(d.porcentaje_mala_postura, 1)} %`}
                      </td>
                      <td className="py-1.5">{formatearNumero(d.minutos_monitoreados / 60, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="tabular text-2xl">{valor}</CardTitle>
      </CardHeader>
      {detalle && <CardContent className="text-muted-foreground text-xs">{detalle}</CardContent>}
    </Card>
  );
}
