/**
 * Cliente de la capa de datos.
 *
 * Es la FRONTERA del mock. Todo lo que una pantalla necesita saber pasa por
 * aqui, con la misma forma que tendra cuando exista el software real: una
 * llamada asincrona que puede tardar y puede fallar.
 *
 * Cuando el desarrollador construya el producto en PyQt6, este archivo se
 * reemplaza por consultas a SQLite y los `*.api.ts` conservan su firma. Ese es
 * el punto: las pantallas no se reescriben. Ver ../../docs/DE_MOCK_A_REAL.md.
 */

import { MODO_DATOS, config } from "@/config/app.config";
import { ErrorApp } from "@/dominio/tipos";
import type { CodigoError } from "@/dominio/tipos";
import { crearAleatorio } from "./semilla";

/** Generador propio para la latencia: no debe consumir del de las fixtures, o
 *  cambiar el numero de llamadas alteraria los datos generados. */
const rndLatencia = crearAleatorio(config.SEMILLA + 1);

/**
 * Latencia artificial. Sin ella la demostracion se siente falsa: nada tarda
 * nunca, y el cliente no ve los estados de carga que el producto real SI va a
 * tener. Es determinista a proposito.
 */
export function latencia(factor = 1): Promise<void> {
  const { min, max } = config.LATENCIA_MOCK_MS;
  const ms = (min + rndLatencia() * (max - min)) * factor;
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Resuelve una operacion de datos.
 *
 * @param ruta    La ruta REST que esta operacion tendra en el producto real. Se
 *                documenta aqui para que la migracion sea mecanica.
 * @param handler Que devolver en modo mock.
 */
export async function resolver<T>(
  ruta: string,
  handler: () => T | Promise<T>,
  opciones: { factorLatencia?: number } = {},
): Promise<T> {
  if (MODO_DATOS === "http") {
    // Falla ruidosamente en vez de fingir. Un modo http a medias que devuelve
    // datos simulados en silencio es la peor forma posible de descubrir que la
    // integracion no estaba hecha.
    throw new ErrorApp(
      "no-implementado",
      `El modo de datos "http" todavia no existe. Ruta solicitada: ${ruta}.`,
      "Ver README, seccion \"Como pasar de mock a producto real\".",
    );
  }
  await latencia(opciones.factorLatencia);
  return handler();
}

/** Falla como fallaria el backend. La interfaz nunca debe ser el unico guardian. */
export function fallar(codigo: CodigoError, mensaje: string, accion?: string): never {
  throw new ErrorApp(codigo, mensaje, accion);
}

/**
 * Catalogo de errores en espanol, con su accion sugerida.
 *
 * Cubre la matriz de la seccion 10 del prompt maestro. La regla es que ningun
 * error termina en un callejon sin salida: todos ofrecen algo que hacer, y
 * ninguno muestra una traza tecnica al usuario final.
 */
export const CATALOGO_ERRORES: Record<
  CodigoError,
  { titulo: string; mensaje: string; accion: string }
> = {
  "camara-no-encontrada": {
    titulo: "No encontramos ninguna camara",
    mensaje:
      "No hay una camara conectada o Windows no la reconoce. Habitusitos necesita una para medir tu postura.",
    accion: "Conectar una camara y reintentar",
  },
  "camara-ocupada": {
    titulo: "Otra aplicacion esta usando la camara",
    mensaje:
      "Es probable que sea una videollamada. Cierra esa aplicacion y vuelve a intentarlo.",
    accion: "Reintentar",
  },
  "camara-desconectada": {
    titulo: "Se perdio la conexion con la camara",
    mensaje:
      "La camara dejo de responder a mitad de la sesion. Tus datos hasta este momento estan guardados.",
    accion: "Reanudar seguimiento",
  },
  "permiso-denegado": {
    titulo: "No nos diste permiso para usar la camara",
    mensaje:
      "Sin permiso no podemos medir tu postura. Recuerda que el video nunca se guarda ni sale de tu equipo.",
    accion: "Volver a pedir permiso",
  },
  "hardware-lento": {
    titulo: "Bajamos la calidad para no cargar tu equipo",
    mensaje:
      "Tu computador esta procesando mas lento de lo esperado, asi que reducimos la resolucion de 1280x720 a 640x480. La medicion sigue funcionando.",
    accion: "Entendido",
  },
  "iluminacion-deficiente": {
    titulo: "Hay poca luz para verte bien",
    mensaje:
      "Estamos mejorando el contraste automaticamente, pero con esta iluminacion la medicion puede ser menos precisa.",
    accion: "Ver recomendaciones de iluminacion",
  },
  "fallo-base-datos": {
    titulo: "No pudimos guardar tu historial",
    mensaje:
      "El disco puede estar lleno o sin permisos de escritura. Habitusitos sigue funcionando y midiendo, pero esta sesion no quedara guardada.",
    accion: "Continuar sin guardar historial",
  },
  "fallo-exportacion": {
    titulo: "No pudimos exportar el archivo",
    mensaje:
      "La carpeta de destino no acepta escritura. Tus datos siguen intactos: no se perdio nada.",
    accion: "Elegir otra carpeta",
  },
  "sin-deteccion": {
    titulo: "No te veo en camara",
    mensaje:
      "Pausamos la sesion. No cuenta como tiempo de mala postura ni rompe tu racha. Se reanuda sola cuando vuelvas.",
    accion: "Entendido",
  },
  "no-implementado": {
    titulo: "Funcion no disponible en la demostracion",
    mensaje: "Esta parte existira en el producto final.",
    accion: "Volver",
  },
};

/** Traduce cualquier excepcion a un mensaje presentable. Nunca una traza cruda. */
export function mensajeDeError(e: unknown): {
  titulo: string;
  mensaje: string;
  accion: string;
} {
  if (e instanceof ErrorApp) return CATALOGO_ERRORES[e.codigo];
  return {
    titulo: "Algo no salio como esperabamos",
    mensaje:
      "Ocurrio un problema inesperado. Habitusitos sigue funcionando; si se repite, revisa la seccion de ayuda.",
    accion: "Reintentar",
  };
}
