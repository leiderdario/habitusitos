/**
 * Generador de sonido sutil y claro para alertas de postura usando Web Audio API.
 *
 * No depende de archivos externos .mp3/.wav que puedan fallar en la red o
 * requerir descargas. Sintetiza un doble tono armónico suave (chime sutil pero
 * distintivo) diseñado para avisar sin sobresaltar ni resultar molesto.
 */

let contextoAudio: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!contextoAudio) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        contextoAudio = new AudioCtx();
      }
    }
    if (contextoAudio && contextoAudio.state === "suspended") {
      void contextoAudio.resume();
    }
    return contextoAudio;
  } catch {
    return null;
  }
}

/**
 * Reproduce un chime de alerta postural sutil pero notorio.
 * Frecuencias armónicas: 587.33 Hz (Re5 / D5) seguido de 880.00 Hz (La5 / A5).
 */
export function reproducirSonidoAlerta(volumen = 0.28): void {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;

    const ahora = ctx.currentTime;

    // Ganancia principal para controlar volumen y decaimiento
    const gananciaMaster = ctx.createGain();
    gananciaMaster.gain.setValueAtTime(0.001, ahora);
    gananciaMaster.connect(ctx.destination);

    // Tono 1: Base armónica suave (D5 ~587 Hz)
    const osc1 = ctx.createOscillator();
    const ganancia1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ahora);
    osc1.connect(ganancia1);
    ganancia1.connect(gananciaMaster);

    // Tono 2: Resonancia superior brillante (A5 ~880 Hz) con ligero desfase
    const osc2 = ctx.createOscillator();
    const ganancia2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, ahora + 0.08);
    osc2.connect(ganancia2);
    ganancia2.connect(gananciaMaster);

    // Envolvente de volumen: ataque rápido pero suave y decaimiento natural
    gananciaMaster.gain.setValueAtTime(0.001, ahora);
    gananciaMaster.gain.exponentialRampToValueAtTime(volumen, ahora + 0.02);

    // Tono 1 decae suavemente
    ganancia1.gain.setValueAtTime(1.0, ahora);
    ganancia1.gain.exponentialRampToValueAtTime(0.2, ahora + 0.15);

    // Tono 2 entra en t+0.08s y decae
    ganancia2.gain.setValueAtTime(0.001, ahora);
    ganancia2.gain.setValueAtTime(0.85, ahora + 0.08);
    ganancia2.gain.exponentialRampToValueAtTime(0.001, ahora + 0.45);

    // Decaimiento maestro final
    gananciaMaster.gain.exponentialRampToValueAtTime(0.001, ahora + 0.5);

    osc1.start(ahora);
    osc1.stop(ahora + 0.5);
    osc2.start(ahora + 0.08);
    osc2.stop(ahora + 0.5);
  } catch (error) {
    // Si el navegador bloquea el audio o no hay hardware, no rompemos el flujo
    console.warn("No se pudo reproducir el sonido de alerta:", error);
  }
}
