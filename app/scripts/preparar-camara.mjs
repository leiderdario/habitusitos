/**
 * Copia local de los recursos de MediaPipe, para que el modo camara funcione
 * SIN INTERNET.
 *
 * Se ejecuta con `npm run preparar-camara`. No es obligatorio: sin estos
 * archivos el detector cae al CDN de jsDelivr y funciona igual, siempre que haya
 * red. Se recomienda ejecutarlo antes de una presentacion: no conviene que una
 * demostracion dependa de la conexion de la sala.
 *
 * Los archivos NO se versionan (unos 50 MB entre WASM y modelo); estan en
 * .gitignore. Este script es la forma de recuperarlos.
 *
 * IMPORTANTE: los .wasm no se pueden renombrar. La libreria los resuelve por
 * nombre exacto, y por eso viven en public/ y no pasan por el bundler.
 */

import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN_WASM = join(RAIZ, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const DESTINO_WASM = join(RAIZ, "public", "wasm");
const DESTINO_MODELOS = join(RAIZ, "public", "modelos");
const MODELO = "pose_landmarker_lite.task";
const URL_MODELO =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

async function existe(ruta) {
  try {
    await stat(ruta);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await existe(ORIGEN_WASM))) {
    console.error(
      "No se encontro node_modules/@mediapipe/tasks-vision. Ejecuta antes: npm install",
    );
    process.exit(1);
  }

  await cp(ORIGEN_WASM, DESTINO_WASM, { recursive: true });
  console.log(`WASM copiado a public/wasm`);

  await mkdir(DESTINO_MODELOS, { recursive: true });
  const destinoModelo = join(DESTINO_MODELOS, MODELO);

  if (await existe(destinoModelo)) {
    const { size } = await stat(destinoModelo);
    console.log(`Modelo ya presente (${mb(size)} MB). Nada que descargar.`);
    return;
  }

  console.log(`Descargando ${MODELO} ...`);
  const respuesta = await fetch(URL_MODELO);
  if (!respuesta.ok) {
    console.error(
      `No se pudo descargar el modelo (HTTP ${respuesta.status}). ` +
        `El modo camara seguira funcionando contra el CDN si hay internet.`,
    );
    process.exit(1);
  }

  const datos = Buffer.from(await respuesta.arrayBuffer());
  await writeFile(destinoModelo, datos);
  console.log(`Modelo descargado (${mb(datos.length)} MB). Modo camara listo sin internet.`);
}

main().catch((e) => {
  console.error("Fallo la preparacion:", e.message);
  process.exit(1);
});
