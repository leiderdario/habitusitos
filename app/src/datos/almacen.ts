/**
 * Almacen en memoria del prototipo, con persistencia en localStorage.
 *
 * Hace el papel de la base de datos SQLite del producto real. NADIE fuera de
 * `datos/api/*` importa este archivo — la regla se verifica en
 * src/arquitectura.test.ts.
 *
 * En el producto real esto no existe: lo reemplaza `data/database.py` con SQLite
 * en modo WAL. Lo que si debe sobrevivir es el patron de degradacion con gracia
 * de `escribir()`: si la persistencia falla, la aplicacion sigue funcionando sin
 * historial en vez de caerse (prompt maestro seccion 4.3 y 10).
 */

import { config } from "@/config/app.config";
import type { Ajustes } from "./fixtures/ajustes";
import { AJUSTES_POR_DEFECTO } from "./fixtures/ajustes";

export interface EstadoAlmacen {
  version: 1;
  onboardingCompletado: boolean;
  ajustes: Ajustes;
  /** Instante en que se reseteo el baseline manualmente, si ocurrio. */
  baselineReseteadoEn: string | null;
}

function estadoSemilla(): EstadoAlmacen {
  return {
    version: 1,
    onboardingCompletado: false,
    ajustes: structuredClone(AJUSTES_POR_DEFECTO),
    baselineReseteadoEn: null,
  };
}

let estado: EstadoAlmacen | null = null;

/** true cuando la persistencia fallo. La interfaz lo avisa UNA vez y sigue. */
export let persistenciaDegradada = false;

function hidratar(): EstadoAlmacen | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(config.CLAVE_ALMACENAMIENTO);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as EstadoAlmacen;
    // Verificacion minima de forma: un esquema viejo debe caer a la semilla en
    // vez de romper la aplicacion a mitad de una demostracion.
    if (datos.version !== 1 || typeof datos.ajustes !== "object") return null;
    // Se fusiona sobre los valores por defecto para que anadir un ajuste nuevo
    // no deje `undefined` en un estado guardado con la version anterior.
    return {
      ...estadoSemilla(),
      ...datos,
      ajustes: { ...structuredClone(AJUSTES_POR_DEFECTO), ...datos.ajustes },
    };
  } catch {
    return null;
  }
}

export function almacen(): EstadoAlmacen {
  if (estado) return estado;
  estado = hidratar() ?? estadoSemilla();
  return estado;
}

/**
 * Persiste el estado. Nunca lanza.
 *
 * Cuota llena, modo privado del navegador o almacenamiento deshabilitado: se
 * marca la degradacion y se sigue. Perder los ajustes es molesto; perder la
 * sesion de demostracion frente al cliente es inaceptable.
 */
export function escribir(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      config.CLAVE_ALMACENAMIENTO,
      JSON.stringify(almacen()),
    );
    persistenciaDegradada = false;
  } catch {
    persistenciaDegradada = true;
  }
}

export function actualizar(cambio: Partial<EstadoAlmacen>): EstadoAlmacen {
  estado = { ...almacen(), ...cambio };
  escribir();
  return estado;
}

/** Vuelve al estado inicial. Es el boton de "siguiente demostracion". */
export function reiniciar(): EstadoAlmacen {
  estado = estadoSemilla();
  try {
    window.localStorage.removeItem(config.CLAVE_ALMACENAMIENTO);
  } catch {
    /* si no se puede borrar, el estado en memoria ya volvio a la semilla */
  }
  return estado;
}
