/**
 * Guarda de consentimiento (Fase 8).
 *
 * Sin el consentimiento obligatorio vigente (hoy: camara) no se monta la aplicacion:
 * se redirige a /consentimiento. Se consulta al montar, asi que un cambio de version
 * del texto (`VERSION_CONSENTIMIENTOS`) vuelve a pedirlo sin tocar nada mas.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { consentimientosFaltantes } from "@/dominio/consentimientos";
import { leerConsentimientosVigentes } from "@/datos/api/consentimientos.api";
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { Cargando, EstadoError } from "@/componentes/comunes/avisos";

export function ExigeConsentimiento({ children }: { children: ReactNode }) {
  const usuario = useSesionUsuario((s) => s.usuario);
  const [faltan, setFaltan] = useState<boolean | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!usuario) return;
    leerConsentimientosVigentes(usuario.id)
      .then((v) => setFaltan(consentimientosFaltantes(v).length > 0))
      .catch(setError);
  }, [usuario]);

  if (error) return <EstadoError error={error} onReintentar={() => window.location.reload()} />;
  if (faltan === null) return <Cargando texto="Verificando tus consentimientos..." />;
  if (faltan) return <Navigate to="/consentimiento" replace />;
  return <>{children}</>;
}
