/**
 * Consentimientos (Fase 8). Aporte propio de Espinker.
 *
 * El aviso de borrador no se puede cerrar: mientras los textos no pasen por el comite
 * de etica no son un consentimiento informado valido (mismo criterio que el aviso de
 * demostracion). El de camara es obligatorio; el de salud, no.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Info } from "lucide-react";
import {
  CATALOGO_CONSENTIMIENTOS,
  consentimientosFaltantes,
} from "@/dominio/consentimientos";
import type { TipoConsentimiento } from "@/dominio/consentimientos";
import {
  leerConsentimientosVigentes,
  registrarConsentimiento,
} from "@/datos/api/consentimientos.api";
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { Cargando, EstadoError } from "@/componentes/comunes/avisos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function PantallaConsentimiento() {
  const navigate = useNavigate();
  const usuario = useSesionUsuario((s) => s.usuario);
  const [elegidos, setElegidos] = useState<Record<TipoConsentimiento, boolean> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    leerConsentimientosVigentes(usuario.id).then(setElegidos).catch(setError);
  }, [usuario]);

  if (error) return <EstadoError error={error} onReintentar={() => setError(null)} />;
  if (!elegidos || !usuario) return <Cargando texto="Cargando..." />;

  const activos = CATALOGO_CONSENTIMIENTOS.filter((c) => c.activo);
  const puedeContinuar = consentimientosFaltantes(elegidos).length === 0;

  async function continuar() {
    if (!usuario || !elegidos) return;
    setEnviando(true);
    try {
      const previos = await leerConsentimientosVigentes(usuario.id);
      for (const c of activos) {
        // Solo se escribe lo que cambio: cada fila es evidencia, no ruido.
        if (previos[c.tipo] !== elegidos[c.tipo]) {
          await registrarConsentimiento(usuario.id, c.tipo, elegidos[c.tipo]);
        }
      }
      navigate("/", { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Antes de empezar</h1>
          <p className="text-muted-foreground text-sm">
            Lee con calma. Puedes cambiar estas decisiones cuando quieras.
          </p>
        </header>

        <div
          className="border-demo/30 bg-demo-suave text-demo flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs"
          role="note"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Estos textos son un borrador y todavia no los ha revisado el comite de etica. No los
            uses con personas reales hasta que lo hagan.
          </span>
        </div>

        {activos.map((c) => (
          <Card key={c.tipo}>
            <CardHeader>
              <CardTitle>
                {c.titulo}
                {c.obligatorio && (
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    (necesario para usar la camara)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-muted-foreground space-y-1.5 text-sm">
                {c.cuerpo.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={`consent-${c.tipo}`}
                  checked={elegidos[c.tipo]}
                  onCheckedChange={(v) => setElegidos({ ...elegidos, [c.tipo]: v })}
                />
                <Label htmlFor={`consent-${c.tipo}`}>Acepto</Label>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button onClick={continuar} disabled={!puedeContinuar || enviando} className="w-full">
          {enviando ? "Guardando..." : "Continuar"}
        </Button>
        {!puedeContinuar && (
          <p className="text-muted-foreground text-center text-xs">
            Sin aceptar el uso de la camara no se puede continuar.
          </p>
        )}
      </div>
    </div>
  );
}
