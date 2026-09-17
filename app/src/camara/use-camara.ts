/**
 * Hook del modo camara real y camara de oficina.
 *
 * Encapsula todo lo que puede salir mal con una webcam o con la conexion de oficina
 * para que las pantallas no tengan que saberlo: permisos denegados, dispositivo ocupado,
 * caida de conexion WebSocket, o simplemente que no haya camara.
 *
 * CONTRATO: este hook NUNCA rompe la aplicacion. Si algo falla, expone el error
 * traducido y el motor de simulacion sigue corriendo en modo simulado.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CodigoError, FramePose } from "@/dominio/tipos";
import { useSimulacion } from "@/estado/simulacion";
import type { Detector } from "./detector-pose";
import { crearDetector } from "./detector-pose";

export type EstadoCamara =
  | "inactiva"
  | "cargando-modelo"
  | "pidiendo-permiso"
  | "activa"
  | "error";

export type FuenteCamara = "webcam" | "oficina";

export interface DispositivoVideoInfo {
  deviceId: string;
  label: string;
}

interface useCamara {
  estado: EstadoCamara;
  error: CodigoError | null;
  origenRecursos: "local" | "cdn" | "oficina" | null;
  fuenteActiva: FuenteCamara;
  setFuenteActiva(fuente: FuenteCamara): void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Ultima pose completa detectada (landmarks y worldLandmarks). null si no hay persona en el frame. */
  pose: FramePose | null;
  encender(fuente?: FuenteCamara, idDispositivo?: string): Promise<void>;
  apagar(): void;

  // Selección de cámara web personal
  dispositivosVideo: DispositivoVideoInfo[];
  idDispositivoSeleccionado: string | null;
  seleccionarDispositivo(deviceId: string): Promise<void>;

  // Selección de fuente de oficina
  cambiarFuenteOficina(nuevaFuente: number | string): void;
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
  const [origenRecursos, setOrigenRecursos] = useState<"local" | "cdn" | "oficina" | null>(null);
  const [fuenteActiva, setFuenteActiva] = useState<FuenteCamara>("webcam");
  const [dispositivosVideo, setDispositivosVideo] = useState<DispositivoVideoInfo[]>([]);
  const [idDispositivoSeleccionado, setIdDispositivoSeleccionado] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const flujoRef = useRef<MediaStream | null>(null);
  const temporizadorRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const actualizarListaDispositivos = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Cámara ${index + 1}`,
        }));
      setDispositivosVideo(videoDevices);
      if (videoDevices.length > 0) {
        setIdDispositivoSeleccionado((prev) => {
          if (prev && videoDevices.some((vd) => vd.deviceId === prev)) return prev;
          return videoDevices[0].deviceId;
        });
      }
    } catch (err) {
      console.warn("No se pudieron listar las cámaras del sistema:", err);
    }
  }, []);

  useEffect(() => {
    void actualizarListaDispositivos();
    const handleDeviceChange = () => {
      void actualizarListaDispositivos();
    };
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [actualizarListaDispositivos]);

  const apagar = useCallback(() => {
    if (temporizadorRef.current !== null) {
      clearInterval(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    if (heartbeatRef.current !== null) {
      clearTimeout(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (wsRef.current !== null) {
      wsRef.current.close();
      wsRef.current = null;
    }
    useSimulacion.getState().actualizarConexionVisionNode({ tipo: "inactivo" });
    flujoRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoRef.current = null;
    detectorRef.current?.cerrar();
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPose(null);
    setEstado("inactiva");
    setError(null);
  }, []);

  const encender = useCallback(
    async (fuenteSolicitada?: FuenteCamara, idDispositivoSolicitado?: string) => {
      const fuente = fuenteSolicitada ?? fuenteActiva;
      const deviceIdActivo = idDispositivoSolicitado ?? idDispositivoSeleccionado;
      setError(null);
      apagar();

      if (fuente === "oficina") {
        // Modo oficina: conexion WebSocket al vision-node local (Paso 6)
        setFuenteActiva("oficina");
        setEstado("cargando-modelo");
        setOrigenRecursos("oficina");
        useSimulacion.getState().actualizarConexionVisionNode({ tipo: "conectando" });
        const wsUrl = (import.meta.env.VITE_VISION_WS_URL as string | undefined) || "ws://127.0.0.1:8765";

        const reiniciarHeartbeat = () => {
          if (heartbeatRef.current !== null) {
            clearTimeout(heartbeatRef.current);
          }
          heartbeatRef.current = window.setTimeout(() => {
            console.warn("Heartbeat de vision-node expirado (>5s sin telemetria)");
            useSimulacion.getState().actualizarConexionVisionNode({
              tipo: "desconectado",
              motivo: "Timeout de telemetria (>5s sin datos)",
            });
          }, 5000);
        };

        try {
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            setEstado("activa");
            useSimulacion.getState().actualizarConexionVisionNode({ tipo: "conectado_sin_personas" });
            reiniciarHeartbeat();
            // Solicitar fuentes al conectar
            ws.send(JSON.stringify({ accion: "listar_camaras" }));
          };

          ws.onmessage = (event) => {
            reiniciarHeartbeat();
            try {
              const data = JSON.parse(event.data);

              if (data.tipo === "info_fuentes") {
                useSimulacion.getState().actualizarFuentesOficina(
                  data.fuente_actual,
                  Array.isArray(data.camaras_locales) ? data.camaras_locales : [],
                );
              }

              if (data.tipo === "personas_detectadas" && Array.isArray(data.personas)) {
                useSimulacion.getState().empujarLotePersonasOficina(data.personas);

                const count = data.personas.length;
                const estadoConexion = useSimulacion.getState().estadoConexionVisionNode;

                if (count > 0) {
                  if (
                    estadoConexion.tipo !== "conectado_con_personas" ||
                    estadoConexion.cantidad !== count
                  ) {
                    useSimulacion.getState().actualizarConexionVisionNode({
                      tipo: "conectado_con_personas",
                      cantidad: count,
                    });
                  }
                  setPose({
                    landmarks: data.personas[0].keypoints,
                    worldLandmarks: data.personas[0].keypoints,
                  });
                } else {
                  if (estadoConexion.tipo !== "conectado_sin_personas") {
                    useSimulacion.getState().actualizarConexionVisionNode({
                      tipo: "conectado_sin_personas",
                    });
                  }
                  setPose(null);
                }
              }
            } catch (err) {
              console.warn("Error procesando telemetria WebSocket de vision-node:", err);
            }
          };

          ws.onerror = (e) => {
            console.warn("Fallo de conexion con el servicio vision-node:", e);
            if (heartbeatRef.current !== null) {
              clearTimeout(heartbeatRef.current);
              heartbeatRef.current = null;
            }
            useSimulacion.getState().actualizarConexionVisionNode({ tipo: "desconectado" });
            setError("servidor-desconectado");
            setEstado("error");
          };

          ws.onclose = () => {
            if (heartbeatRef.current !== null) {
              clearTimeout(heartbeatRef.current);
              heartbeatRef.current = null;
            }
            if (wsRef.current === ws) {
              useSimulacion.getState().actualizarConexionVisionNode({ tipo: "desconectado" });
              setEstado("inactiva");
            }
          };
        } catch (e) {
          console.error("No se pudo iniciar el cliente WebSocket de oficina:", e);
          if (heartbeatRef.current !== null) {
            clearTimeout(heartbeatRef.current);
            heartbeatRef.current = null;
          }
          useSimulacion.getState().actualizarConexionVisionNode({ tipo: "desconectado" });
          setError("servidor-desconectado");
          setEstado("error");
        }
        return;
      }

      // Modo personal webcam (MediaPipe local)
      setFuenteActiva("webcam");
      useSimulacion.getState().actualizarConexionVisionNode({ tipo: "inactivo" });
      try {
        setEstado("cargando-modelo");
        const detector = await crearDetector();
        detectorRef.current = detector;
        setOrigenRecursos(detector.origen);

        setEstado("pidiendo-permiso");
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
        };
        if (deviceIdActivo) {
          videoConstraints.deviceId = { exact: deviceIdActivo };
        }

        const flujo = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        flujoRef.current = flujo;
        // Re-escanear para actualizar etiquetas descriptivas otorgado el permiso
        void actualizarListaDispositivos();

        const video = videoRef.current;
        if (!video) throw new Error("El elemento de video no esta montado");

        video.srcObject = flujo;

        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.onloadeddata = () => resolve();
            window.setTimeout(resolve, 800);
          }
        });

        try {
          await video.play();
        } catch (err) {
          console.warn("video.play() diferido por politica del navegador:", err);
        }

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
          if (!v || !d || v.readyState < 2 || v.videoWidth === 0) return;
          const resPose = d.detectar(v, performance.now());
          setPose(resPose);
        }, intervalo);
      } catch (e) {
        console.error("Error al activar la camara:", e);
        setError(traducirFalloDeMedios(e));
        setEstado("error");
        apagar();
      }
    },
    [actualizarListaDispositivos, apagar, fuenteActiva, idDispositivoSeleccionado, muestrasPorSegundo],
  );

  const seleccionarDispositivo = useCallback(
    async (deviceId: string) => {
      setIdDispositivoSeleccionado(deviceId);
      if (fuenteActiva === "webcam" && estado === "activa") {
        await encender("webcam", deviceId);
      }
    },
    [encender, estado, fuenteActiva],
  );

  const cambiarFuenteOficina = useCallback((nuevaFuente: number | string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          accion: "cambiar_fuente",
          fuente: nuevaFuente,
        }),
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      apagar();
    };
  }, [apagar]);

  return {
    estado,
    error,
    origenRecursos,
    fuenteActiva,
    setFuenteActiva,
    videoRef,
    pose,
    encender,
    apagar,
    dispositivosVideo,
    idDispositivoSeleccionado,
    seleccionarDispositivo,
    cambiarFuenteOficina,
  };
}
