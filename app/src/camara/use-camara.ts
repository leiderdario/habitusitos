/**
 * Hook del modo camara real.
 *
 * Encapsula todo lo que puede salir mal con una webcam para que las pantallas no
 * tengan que saberlo: permisos denegados, dispositivo ocupado, desconexion a
 * mitad de sesion, o simplemente que no haya camara.
 *
 * CONTRATO: este hook NUNCA rompe la aplicacion. Si algo falla, expone el error
 * traducido y el motor de simulacion sigue corriendo en modo simulado. El modo
 * camara es un extra demostrativo, no un requisito para presentar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CodigoError, FramePose } from "@/dominio/tipos";
import type { Detector } from "./detector-pose";
import { crearDetector } from "./detector-pose";

export type EstadoCamara =
  | "inactiva"
  | "cargando-modelo"
  | "pidiendo-permiso"
  | "activa"
  | "error";

interface useCamara {
  estado: EstadoCamara;
  error: CodigoError | null;
  origenRecursos: "local" | "cdn" | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Ultima pose completa detectada (landmarks y worldLandmarks). null si no hay persona en el frame. */
  pose: FramePose | null;
  encender(): Promise<void>;
  apagar(): void;
}

/** Traduce el error del navegador a un codigo del catalogo en espanol. */
function traducirFalloDeMedios(e: unknown): CodigoError {
  const nombre = e instanceof DOMException ? e.name : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") return "permiso-denegado";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "camara-no-encontrada";
  }
  if (nombre === "NotReadableError" || nombre === "AbortError") return "camara-ocupada";
  return "camara-no-encontrada";
}

export function useCamara(muestrasPorSegundo: number): useCamara {
  const [estado, setEstado] = useState<EstadoCamara>("inactiva");
  const [error, setError] = useState<CodigoError | null>(null);
  const [pose, setPose] = useState<FramePose | null>(null);
  const [origenRecursos, setOrigenRecursos] = useState<"local" | "cdn" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const flujoRef = useRef<MediaStream | null>(null);
  const temporizadorRef = useRef<number | null>(null);

  const apagar = useCallback(() => {
    if (temporizadorRef.current !== null) {
      clearInterval(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    flujoRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoRef.current = null;
    detectorRef.current?.cerrar();
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPose(null);
    setEstado("inactiva");
    setError(null);
  }, []);

  const encender = useCallback(async () => {
    setError(null);
    try {
      setEstado("cargando-modelo");
      const detector = await crearDetector();
      detectorRef.current = detector;
      setOrigenRecursos(detector.origen);

      setEstado("pidiendo-permiso");
      const flujo = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      flujoRef.current = flujo;

      const video = videoRef.current;
      if (!video) throw new Error("El elemento de video no esta montado");
      video.srcObject = flujo;
      await video.play();

      // Si el usuario desconecta la camara a mitad de sesion, el track termina.
      // Sin esto la interfaz se quedaria congelada mostrando el ultimo frame,
      // que es peor que decir la verdad.
      flujo.getVideoTracks()[0]?.addEventListener("ended", () => {
        setError("camara-desconectada");
        setEstado("error");
        apagar();
      });

      setEstado("activa");

      const intervalo = Math.round(1000 / Math.max(1, muestrasPorSegundo));
      temporizadorRef.current = window.setInterval(() => {
        const v = videoRef.current;
        const d = detectorRef.current;
        if (!v || !d || v.readyState < 2) return;
        setPose(d.detectar(v, performance.now()));
      }, intervalo);
    } catch (e) {
      setError(traducirFalloDeMedios(e));
      setEstado("error");
      apagar();
      setEstado("error");
    }
  }, [apagar, muestrasPorSegundo]);

  // Liberar la camara al desmontar. Sin esto el LED de la webcam se queda
  // encendido, que es la queja de usabilidad numero uno documentada contra este
  // tipo de aplicaciones.
  useEffect(() => apagar, [apagar]);

  return { estado, error, origenRecursos, videoRef, pose, encender, apagar };
}
