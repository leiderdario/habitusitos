/**
 * Antecedentes de salud.
 *
 * NO diagnostica. Sirve para contextualizar alertas (p. ej. no sugerir una
 * pausa de muneca a quien tiene tunel carpiano) y para que el reloj wearable
 * de una fase futura sepa a cual muneca asociarse. Cada guardado deja rastro
 * en `antecedentes_cambios` -- ver datos/api/antecedentes.api.ts.
 */

import { useEffect, useState } from "react";
import { Check, HeartPulse, HelpCircle, Info, PersonStanding, Timer } from "lucide-react";
import { CATALOGO_CONSENTIMIENTOS } from "@/dominio/consentimientos";
import type { AntecedentesSalud, ManoDominante } from "@/dominio/tipos";
import { guardarAntecedentes, leerAntecedentes } from "@/datos/api/antecedentes.api";
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { leerConsentimientosVigentes, registrarConsentimiento } from "@/datos/api/consentimientos.api";
import { Button } from "@/components/ui/button";
import { Cargando, EstadoError } from "@/componentes/comunes/avisos";
import { CampoSelect } from "@/componentes/comunes/campo-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CamposEditables = Omit<AntecedentesSalud, "usuario_id" | "actualizado_en">;

export function PantallaAntecedentes() {
  const usuario = useSesionUsuario((s) => s.usuario);
  const [antecedentes, setAntecedentes] = useState<AntecedentesSalud | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [guardado, setGuardado] = useState(false);
  const [consentimientoSalud, setConsentimientoSalud] = useState<boolean | null>(null);

  useEffect(() => {
    if (!usuario) return;
    void leerAntecedentes(usuario.id).then(setAntecedentes).catch(setError);
    void leerConsentimientosVigentes(usuario.id)
      .then((v) => setConsentimientoSalud(v.salud))
      .catch(setError);
  }, [usuario]);

  async function guardar(parcial: Partial<CamposEditables>) {
    if (!antecedentes || !usuario) return;
    const optimista = { ...antecedentes, ...parcial } as AntecedentesSalud;
    setAntecedentes(optimista);
    try {
      const confirmado = await guardarAntecedentes(usuario.id, parcial);
      setAntecedentes(confirmado);
      setGuardado(true);
      window.setTimeout(() => setGuardado(false), 2000);
    } catch (e) {
      setError(e);
    }
  }

  if (error) return <EstadoError error={error} onReintentar={() => setError(null)} />;
  if (!antecedentes || consentimientoSalud === null) {
    return <Cargando texto="Cargando tus antecedentes..." />;
  }

  async function darConsentimientoSalud() {
    if (!usuario) return;
    try {
      await registrarConsentimiento(usuario.id, "salud", true);
      setConsentimientoSalud(true);
    } catch (e) {
      setError(e);
    }
  }

  if (!consentimientoSalud) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Antecedentes de salud</h1>
        <div className="text-muted-foreground space-y-1.5 text-sm">
          {CATALOGO_CONSENTIMIENTOS.find((c) => c.tipo === "salud")?.cuerpo.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <Button onClick={darConsentimientoSalud}>Acepto guardar mis antecedentes</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Antecedentes de salud</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Los cambios se guardan al instante.
            {guardado && (
              <span className="text-estado-buena ml-2 inline-flex items-center gap-1">
                <Check className="size-3.5" aria-hidden />
                Guardado
              </span>
            )}
          </p>
        </div>
      </header>

      <div
        className="border-nota/30 bg-nota-suave text-nota flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs"
        role="note"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Esto no diagnostica nada. Sirve para que las alertas y las futuras pausas activas tengan
          en cuenta tu situacion real y no sugieran algo contraindicado (por ejemplo, un ejercicio
          de muneca si tienes tunel carpiano). Nadie en tu organizacion ve estas respuestas de
          forma individual.
        </span>
      </div>

      <Tabs defaultValue="columna">
        <TabsList className="flex-wrap">
          <TabsTrigger value="columna">
            <PersonStanding className="size-3.5" aria-hidden />
            Columna
          </TabsTrigger>
          <TabsTrigger value="miembro-superior">
            <HeartPulse className="size-3.5" aria-hidden />
            Brazos y manos
          </TabsTrigger>
          <TabsTrigger value="otros">
            <HelpCircle className="size-3.5" aria-hidden />
            Otros
          </TabsTrigger>
          <TabsTrigger value="habitos">
            <Timer className="size-3.5" aria-hidden />
            Habitos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="columna" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Espalda y cuello</CardTitle>
              <CardDescription>Marca solo lo que ya te han diagnosticado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <Interruptor
                id="cervicalgia"
                etiqueta="Cervicalgia (dolor de cuello)"
                valor={antecedentes.cervicalgia}
                onCambio={(v) => guardar({ cervicalgia: v })}
              />
              <Interruptor
                id="lumbalgia"
                etiqueta="Lumbalgia (dolor lumbar)"
                valor={antecedentes.lumbalgia}
                onCambio={(v) => guardar({ lumbalgia: v })}
              />
              <Interruptor
                id="cifosis"
                etiqueta="Cifosis o hipercifosis"
                valor={antecedentes.cifosis_hipercifosis}
                onCambio={(v) => guardar({ cifosis_hipercifosis: v })}
              />
              <Interruptor
                id="lordosis"
                etiqueta="Lordosis"
                valor={antecedentes.lordosis}
                onCambio={(v) => guardar({ lordosis: v })}
              />
              <Interruptor
                id="hernia"
                etiqueta="Hernia o protrusion discal"
                valor={antecedentes.hernia_protrusion}
                onCambio={(v) => guardar({ hernia_protrusion: v })}
              />
              <Interruptor
                id="escoliosis"
                etiqueta="Escoliosis"
                valor={antecedentes.escoliosis}
                onCambio={(v) => guardar({ escoliosis: v })}
              />
              <Interruptor
                id="cirugia-columna"
                etiqueta="Cirugia de columna, cuello u hombro"
                valor={antecedentes.cirugia_columna_cuello_hombro}
                onCambio={(v) => guardar({ cirugia_columna_cuello_hombro: v })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="miembro-superior" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Brazos y manos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Interruptor
                id="tunel-carpiano"
                etiqueta="Tunel carpiano"
                valor={antecedentes.tunel_carpiano}
                onCambio={(v) => guardar({ tunel_carpiano: v })}
              />
              <Interruptor
                id="de-quervain"
                etiqueta="Tendinitis / De Quervain"
                valor={antecedentes.tendinitis_de_quervain}
                onCambio={(v) => guardar({ tendinitis_de_quervain: v })}
              />
              <Interruptor
                id="epicondilitis"
                etiqueta="Epicondilitis"
                valor={antecedentes.epicondilitis}
                onCambio={(v) => guardar({ epicondilitis: v })}
              />
              <Interruptor
                id="manguito-rotador"
                etiqueta="Manguito rotador"
                valor={antecedentes.manguito_rotador}
                onCambio={(v) => guardar({ manguito_rotador: v })}
              />
              <Interruptor
                id="cirugia-mano"
                etiqueta="Cirugia de mano o muneca"
                valor={antecedentes.cirugia_mano_muneca}
                onCambio={(v) => guardar({ cirugia_mano_muneca: v })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="otros" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Otros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Interruptor
                id="ferulas"
                etiqueta="Usas ferulas"
                valor={antecedentes.usa_ferulas}
                onCambio={(v) => guardar({ usa_ferulas: v })}
              />
              <Interruptor
                id="embarazo"
                etiqueta="Embarazo"
                ayuda="Dato sensible. Solo tu lo ves; nunca aparece en ninguna vista de equipo."
                valor={antecedentes.embarazo}
                onCambio={(v) => guardar({ embarazo: v })}
              />
              <Interruptor
                id="dolor-cronico"
                etiqueta="Dolor cronico"
                valor={antecedentes.dolor_cronico}
                onCambio={(v) => guardar({ dolor_cronico: v })}
              />
              <Interruptor
                id="enfermedad-laboral"
                etiqueta="Enfermedad laboral de origen biomecanico, ya diagnosticada"
                valor={antecedentes.enfermedad_laboral_biomecanica_previa}
                onCambio={(v) => guardar({ enfermedad_laboral_biomecanica_previa: v })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="habitos" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tus habitos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CampoSelect
                id="horas-sentado"
                etiqueta="Horas sentado en un dia tipico"
                valor={String(antecedentes.horas_sentado_dia)}
                opciones={[
                  { valor: "4", texto: "Menos de 5 horas" },
                  { valor: "6", texto: "5 a 7 horas" },
                  { valor: "8", texto: "7 a 9 horas" },
                  { valor: "10", texto: "Mas de 9 horas" },
                ]}
                onCambio={(v) => guardar({ horas_sentado_dia: Number(v) })}
              />
              <CampoSelect
                id="mano-dominante"
                etiqueta="Mano dominante"
                valor={antecedentes.mano_dominante}
                opciones={OPCIONES_MANO}
                onCambio={(v) => guardar({ mano_dominante: v as ManoDominante })}
              />
              <CampoSelect
                id="muneca-reloj"
                etiqueta="En cual muneca usarias un reloj de seguimiento"
                ayuda="Para cuando exista el reloj wearable: necesita saber a cual muneca se asocia."
                valor={antecedentes.muneca_reloj}
                opciones={OPCIONES_MUNECA_RELOJ}
                onCambio={(v) => guardar({ muneca_reloj: v as AntecedentesSalud["muneca_reloj"] })}
              />
              <Interruptor
                id="ya-hace-pausas"
                etiqueta="Ya sueles hacer pausas activas por tu cuenta"
                valor={antecedentes.ya_hace_pausas}
                onCambio={(v) => guardar({ ya_hace_pausas: v })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const OPCIONES_MANO = [
  { valor: "derecha", texto: "Derecha" },
  { valor: "izquierda", texto: "Izquierda" },
  { valor: "ambidiestro", texto: "Ambidiestro" },
] as const;

const OPCIONES_MUNECA_RELOJ = [
  ...OPCIONES_MANO,
  { valor: "no_usa", texto: "No uso reloj" },
] as const;

function Interruptor({
  id,
  etiqueta,
  ayuda,
  valor,
  onCambio,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: boolean;
  onCambio(v: boolean): void;
}) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {etiqueta}
        </Label>
        {ayuda && <p className="text-muted-foreground text-xs text-balance">{ayuda}</p>}
      </div>
      <Switch id={id} checked={valor} onCheckedChange={onCambio} />
    </div>
  );
}
