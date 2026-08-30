/**
 * Ajustes de la aplicacion.
 *
 * En el producto real esto no viaja por HTTP: son lecturas y escrituras de
 * QSettings a traves de `services/settings_service.py`. Se mantiene la misma
 * firma asincrona porque escribir en QSettings tambien puede fallar, y una API
 * sincrona obligaria a reescribir cada pantalla al descubrirlo.
 *
 *   leer()       -> SettingsService.load()
 *   guardar()    -> SettingsService.update(seccion, campo, valor)
 *   restaurar()  -> SettingsService.reset_to_defaults()
 */

import type { Ajustes } from "../fixtures/ajustes";
import { AJUSTES_POR_DEFECTO, PRESETS_PESOS } from "../fixtures/ajustes";
import { actualizar, almacen, persistenciaDegradada, reiniciar } from "../almacen";
import { fallar, resolver } from "../cliente";

/**
 * Los tipos se reexportan desde la frontera de datos.
 *
 * Asi ninguna pantalla necesita conocer la existencia de `datos/fixtures/*`, que
 * es codigo que desaparece cuando exista el backend real. Si una pantalla
 * importara el tipo desde la fixture, migrar obligaria a tocar la pantalla.
 */
export type {
  Ajustes,
  AjustesBaseline,
  AjustesCamara,
  AjustesDatos,
  AjustesDeteccion,
  AjustesGeneral,
  AjustesNotificaciones,
} from "../fixtures/ajustes";

export async function leerAjustes(): Promise<Ajustes> {
  return resolver("QSettings.load", () => almacen().ajustes, { factorLatencia: 0.3 });
}

export async function guardarAjustes(parcial: Partial<Ajustes>): Promise<Ajustes> {
  return resolver(
    "QSettings.update",
    () => {
      const previos = almacen().ajustes;
      const nuevos: Ajustes = {
        ...previos,
        ...parcial,
        // Fusion por seccion: guardar solo `camara` no puede borrar `deteccion`.
        general: { ...previos.general, ...parcial.general },
        camara: { ...previos.camara, ...parcial.camara },
        deteccion: { ...previos.deteccion, ...parcial.deteccion },
        notificaciones: { ...previos.notificaciones, ...parcial.notificaciones },
        datos: { ...previos.datos, ...parcial.datos },
        baseline: { ...previos.baseline, ...parcial.baseline },
      };
      actualizar({ ajustes: nuevos });

      if (persistenciaDegradada) {
        fallar(
          "fallo-base-datos",
          "No pudimos guardar tus ajustes.",
          "Continuar sin guardar",
        );
      }
      return nuevos;
    },
    { factorLatencia: 0.5 },
  );
}

export async function restaurarAjustes(): Promise<Ajustes> {
  return resolver("QSettings.reset", () => {
    actualizar({ ajustes: structuredClone(AJUSTES_POR_DEFECTO) });
    return almacen().ajustes;
  });
}

/**
 * Presets de sensibilidad.
 *
 * En el producto real seria un catalogo embebido en `settings_service.py`, no una
 * consulta remota, pero pasa por aqui igual: es un dato, y los datos entran por
 * la frontera.
 */
export async function listarPresetsPesos() {
  return resolver("SettingsService.weight_presets()", () => PRESETS_PESOS, {
    factorLatencia: 0.2,
  });
}

export async function leerOnboardingCompletado(): Promise<boolean> {
  return resolver("QSettings.get(has_completed_onboarding)", () =>
    almacen().onboardingCompletado,
  );
}

export async function marcarOnboardingCompletado(): Promise<void> {
  await resolver("QSettings.set(has_completed_onboarding)", () => {
    actualizar({ onboardingCompletado: true });
  });
}

/**
 * Devuelve todo al estado inicial. No existe en el producto real: es la
 * herramienta para encadenar demostraciones sin arrastrar el estado de la
 * anterior.
 */
export async function reiniciarDemostracion(): Promise<void> {
  await resolver("(solo prototipo) reset", () => {
    reiniciar();
  });
}
