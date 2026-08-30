/**
 * Deteccion de pose en el navegador con MediaPipe Tasks Vision.
 *
 * POR QUE ESTA LIBRERIA Y NO OTRA (verificado el 2026-07-31):
 *  - `@mediapipe/tasks-vision` 1.0.0 es estable y tiene compilaciones nocturnas
 *    al dia. `@tensorflow-models/pose-detection` lleva congelado desde agosto de
 *    2023 (v2.1.3, ultimo cambio funcional): no es una alternativa viva.
 *  - Devuelve los 33 landmarks de BlazePose, LOS MISMOS que usa el software
 *    Python. La trazabilidad importa mas que el rendimiento: las siete metricas
 *    de la seccion 4.4 se demuestran aqui sin reescribir la matematica ni tener
 *    que justificar un cambio de modelo ante el jurado.
 *  - No requiere clave de API, cuenta ni registro. Todo corre en el dispositivo:
 *    encaja con la promesa de privacidad de la seccion 8.4.
 *
 * NOTA PARA EL DESARROLLADOR DEL PRODUCTO REAL: en Python hay que usar
 * `mediapipe.tasks.python.vision.PoseLandmarker`, no `mediapipe.solutions.pose`.
 * La API legacy perdio soporte en marzo de 2023 y fue ELIMINADA de los wheels a
 * partir de 0.10.31 — el paquete paso de 35.6 MB a 10.3 MB. El pin
 * `mediapipe==0.10.21` del proyecto original es un techo permanente, no una
 * preferencia. Ver ../../docs/INVESTIGACION_2026.md, hallazgo 1.
 */

import type { FramePose } from "@/dominio/tipos";

/**
 * Rutas de los recursos.
 *
 * Se prefieren las copias locales (`public/wasm`, `public/modelos`) para que la
 * demostracion funcione sin internet — el dia de la sustentacion no puede
 * depender de un CDN. Si no estan, se cae al CDN con la version FIJADA: `@latest`
 * ya se publico una vez sin la carpeta `wasm` (issue 5647 de MediaPipe).
 *
 * Los .wasm no se pueden renombrar: la libreria los resuelve por nombre. Por eso
 * viven en `public/` y no pasan por el pipeline de assets con hash del bundler.
 */
const VERSION_FIJADA = "1.0.0";
const RUTA_WASM_LOCAL = "/wasm";
const RUTA_MODELO_LOCAL = "/modelos/pose_landmarker_lite.task";
const RUTA_WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_FIJADA}/wasm`;
const RUTA_MODELO_CDN =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

export interface Detector {
  detectar(video: HTMLVideoElement, tMs: number): FramePose | null;
  cerrar(): void;
  /** De donde salieron los recursos. Se muestra en la interfaz: si esta usando
   *  el CDN, la demostracion depende de la red y hay que saberlo antes. */
  origen: "local" | "cdn";
}

async function existeLocal(ruta: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // En despliegues web (Vercel, etc.), los binarios pesados (WASM/modelos) no estan en Git
  // y cualquier ruta no encontrada devuelve index.html (SPA). Por ello, en la web siempre
  // se carga directamente desde el CDN fijado.
  const esLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".local");

  if (!esLocalhost) return false;

  try {
    const r = await fetch(ruta, { method: "HEAD" });
    if (!r.ok) return false;
    const tipo = r.headers.get("content-type");
    if (tipo && tipo.toLowerCase().includes("text/html")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea el detector. Lanza si no se pudo: el llamador cae a modo simulado.
 *
 * La carga es pesada (~11 MB de WASM + ~5.8 MB de modelo), asi que solo se hace
 * cuando el usuario activa el modo camara de forma explicita. Nunca al arrancar.
 */
export async function crearDetector(): Promise<Detector> {
  // Import dinamico: sin esto, los ~11 MB de la libreria entrarian en el bundle
  // inicial y el prototipo tardaria en abrir aunque nadie use la camara.
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");

  const intentarCrear = async (usarLocal: boolean): Promise<Detector> => {
    const origen: "local" | "cdn" = usarLocal ? "local" : "cdn";
    const rutaWasm = usarLocal ? RUTA_WASM_LOCAL : RUTA_WASM_CDN;
    const rutaModelo = usarLocal ? RUTA_MODELO_LOCAL : RUTA_MODELO_CDN;

    const vision = await FilesetResolver.forVisionTasks(rutaWasm);

    let landmarker: Awaited<ReturnType<typeof PoseLandmarker.createFromOptions>>;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: rutaModelo,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    } catch (eGpu) {
      console.warn("GPU WebGL no disponible para MediaPipe, cayendo a CPU:", eGpu);
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: rutaModelo,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    }

    let ultimoTiempo = -1;

    return {
      origen,
      detectar(video, tMs) {
        // `detectForVideo` exige timestamps estrictamente crecientes. Repetir uno
        // lanza, y una excepcion por frame tumbaria el bucle entero.
        if (tMs <= ultimoTiempo) return null;
        ultimoTiempo = tMs;

        try {
          const resultado = landmarker.detectForVideo(video, tMs);
          const puntos = resultado.landmarks?.[0];
          const puntosMundo = resultado.worldLandmarks?.[0];
          if (!puntos || puntos.length < 25) return null;

          return {
            landmarks: puntos.map((p: { x: number; y: number; z: number; visibility?: number }) => ({
              x: p.x,
              y: p.y,
              z: p.z,
              visibility: p.visibility ?? 1,
            })),
            // worldLandmarks es null si el modelo no lo devolvio esta vez: nunca se
            // inventa un vector 3D a partir de coordenadas proyectivas.
            worldLandmarks:
              puntosMundo && puntosMundo.length >= 25
                ? puntosMundo.map((p: { x: number; y: number; z: number; visibility?: number }) => ({
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    visibility: p.visibility ?? 1,
                  }))
                : null,
          };
        } catch {
          // Mismo contrato que el pipeline del proyecto original: un frame
          // problematico nunca detiene el bucle de camara.
          return null;
        }
      },
      cerrar() {
        try {
          landmarker.close();
        } catch {
          /* cerrar dos veces no es un error que valga la pena propagar */
        }
      },
    };
  };

  const hayLocal = await existeLocal(RUTA_MODELO_LOCAL);
  if (hayLocal) {
    try {
      return await intentarCrear(true);
    } catch {
      return await intentarCrear(false);
    }
  }

  return await intentarCrear(false);
}

/** Pares de landmarks a unir para dibujar el esqueleto sobre el video. */
export const CONEXIONES: [number, number][] = [
  [7, 8], // oreja a oreja
  [11, 12], // hombro a hombro
  [11, 23], // hombro izq a cadera izq
  [12, 24], // hombro der a cadera der
  [23, 24], // cadera a cadera
  [0, 7], // nariz a oreja izq
  [0, 8], // nariz a oreja der
  [11, 13],
  [13, 15], // brazo izq: hombro-codo-muneca
  [12, 14],
  [14, 16], // brazo der: hombro-codo-muneca
];
