/**
 * Cuenta activa + boton "Cerrar sesion".
 *
 * Aporte propio de Espinker (el login existia, pero una vez dentro no habia forma
 * de salir ni de cambiar de cuenta). Vive en el marco porque debe estar en todas
 * las rutas. Al cerrar, el store pone `usuario` en null y <RutaProtegida> redirige
 * a /ingresar; aqui no se navega a mano.
 */

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { Button } from "@/components/ui/button";

interface Props {
  /** false = barra lateral contraida: solo icono. */
  expandido?: boolean;
  /** Variante compacta para la navegacion movil. */
  compacto?: boolean;
}

export function MenuCuenta({ expandido = true, compacto = false }: Props) {
  const usuario = useSesionUsuario((s) => s.usuario);
  const cerrarSesion = useSesionUsuario((s) => s.cerrarSesion);
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      await cerrarSesion();
    } finally {
      setSaliendo(false);
    }
  }

  if (compacto) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground shrink-0 text-xs"
        onClick={salir}
        disabled={saliendo}
      >
        <LogOut className="size-3.5" aria-hidden />
        Cerrar sesión
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      {expandido && usuario && (
        <div className="px-2.5 py-1" data-testid="cuenta-activa">
          <p className="truncate text-sm font-medium">{usuario.nombre}</p>
          {usuario.correo && (
            <p className="text-muted-foreground truncate text-xs">{usuario.correo}</p>
          )}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={salir}
        disabled={saliendo}
        aria-label="Cerrar sesión"
        title={expandido ? undefined : "Cerrar sesión"}
      >
        <LogOut className="size-4" aria-hidden />
        {expandido && "Cerrar sesión"}
      </Button>
    </div>
  );
}
