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
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { registrarEvento } from "@/datos/api/registro.api";
import { obtenerTokenSesion } from "@/datos/api/auth.api";
import { vaciarHistorialPendiente } from "@/datos/api/historial.api";
import type { Detector } from "./detector-pose";
import { crearDetector } from "./detector-pose";

/** Fire-and-forget: el log de auditoria nunca debe bloquear ni romper el
 *  encendido/apagado real de la camara (contrato de este hook, ver cabecera). */
function registrarEventoCamara(tipo: "camara_iniciada" | "camara_detenida") {
  void registrarEvento({ usuario_id: useSesionUsuario.getState().usuario?.id ?? null, tipo });
}

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
  /** Se incrementa en cada `apagar()`: un encendido en vuelo que vea otro valor sabe que
   *  lo cancelaron y descarta lo que haya creado (el modelo tarda lo bastante para que ocurra). */
  const tokenEncendidoRef = useRef(0);

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
    tokenEncendidoRef.current += 1;
    // Refs, no el estado de React: esta funcion tiene deps [] y el estado
    // cerrado seria el del primer render. Los refs siempre reflejan el valor
    // actual, y es justo la senal de "de verdad habia algo encendido".
    const estabaEncendida = flujoRef.current !== null || wsRef.current !== null;
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
    useSimulacion.getState().fijarTicketVideoOficina(null);
    flujoRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoRef.current = null;
    detectorRef.current?.cerrar();
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPose(null);
    setEstado("inactiva");
    setError(null);
    if (estabaEncendida) {
      registrarEventoCamara("camara_detenida");
      void vaciarHistorialPendiente();
    }
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

          // El nodo no habla con nadie hasta recibir este mensaje con el token de Supabase.
          ws.onopen = () => {
            void obtenerTokenSesion().then((tokenSesion) => {
              if (wsRef.current !== ws) return;
              if (!tokenSesion) {
                ws.close();
                useSimulacion.getState().actualizarConexionVisionNode({
                  tipo: "desconectado",
                  motivo: "Inicia sesion para conectarte al nodo de oficina",
                });
                setError("servidor-desconectado");
                setEstado("error");
                return;
              }
              ws.send(JSON.stringify({ accion: "autenticar", token: tokenSesion }));
            });
          };

          ws.onmessage = (event) => {
            reiniciarHeartbeat();
            try {
              const data = JSON.parse(event.data);

              if (data.tipo === "autenticado") {
                useSimulacion
                  .getState()
                  .fijarTicketVideoOficina(typeof data.ticket_video === "string" ? data.ticket_video : null);
                setEstado("activa");
                registrarEventoCamara("camara_iniciada");
                useSimulacion.getState().actualizarConexionVisionNode({ tipo: "conectado_sin_personas" });
                ws.send(JSON.stringify({ accion: "listar_camaras" }));
              }

              if (data.tipo === "info_fuentes") {
                useSimulacion.getState().actualizarFuentesOficina(
                  data.fuente_actual,
                  [
                    ...(Array.isArray(data.camaras_locales) ? data.camaras_locales : []),
                    ...(Array.isArray(data.fuentes_configuradas) ? data.fuentes_configuradas : []),
                  ],
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

          ws.onclose = (evento) => {
            if (heartbeatRef.current !== null) {
              clearTimeout(heartbeatRef.current);
              heartbeatRef.current = null;
            }
            if (wsRef.current === ws) {
              useSimulacion.getState().fijarTicketVideoOficina(null);
              // 4401 = el nodo rechazo el token o la cuenta no es de su organizacion.
              const noAutorizado = evento.code === 4401;
              useSimulacion.getState().actualizarConexionVisionNode({
                tipo: "desconectado",
                motivo: noAutorizado ? "Tu cuenta no tiene acceso a este nodo de oficina" : undefined,
              });
              if (noAutorizado) {
                setError("servidor-desconectado");
                setEstado("error");
              } else {
                setEstado("inactiva");
              }
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
      const token = tokenEncendidoRef.current;
      try {
        performance.mark("camara:inicio");
        setEstado("pidiendo-permiso");
        // El modelo (~17 MB) y el permiso de camara son independientes: se piden a la vez
        // para que el tiempo total sea el del mas lento y no la suma. El permiso va
        // primero en la cola de eventos porque es el que espera una persona.
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
        };
        if (deviceIdActivo) {
          videoConstraints.deviceId = { exact: deviceIdActivo };
        }
        const promesaFlujo = navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        const promesaDetector = crearDetector();
        // Si una de las dos falla, la otra puede quedar sin esperar: sin esto, su
        // rechazo posterior seria un "unhandled rejection" y el flujo quedaria encendido.
        promesaFlujo.then(
          (f) => {
            if (token !== tokenEncendidoRef.current) f.getTracks().forEach((p) => p.stop());
          },
          () => {},
        );
        promesaDetector.then(
          (d) => {
            if (token !== tokenEncendidoRef.current) d.cerrar();
          },
          () => {},
        );

        const flujo = await promesaFlujo;
        performance.mark("camara:permiso-concedido");
        if (token !== tokenEncendidoRef.current) return;
        flujoRef.current = flujo;

        const video = videoRef.current;
        if (!video) throw new Error("El elemento de video no esta montado");
        video.srcObject = flujo;

        setEstado("cargando-modelo");
        const detector = await promesaDetector;
        performance.mark("camara:modelo-listo");
        if (token !== tokenEncendidoRef.current) return;
        detectorRef.current = detector;
        setOrigenRecursos(detector.origen);
        // Re-escanear para actualizar etiquetas descriptivas otorgado el permiso
        void actualizarListaDispositivos();

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

        performance.mark("camara:primer-frame-listo");
        setEstado("activa");
        registrarEventoCamara("camara_iniciada");

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
