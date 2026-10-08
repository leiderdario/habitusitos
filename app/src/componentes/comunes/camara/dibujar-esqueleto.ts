/**
 * Dibujo del esqueleto sobre el video.
 *
 * Heredado de BatesPosture a traves de la vista de camara y movido aqui sin
 * cambios de logica al dividir vista-camara.tsx (Espinker, Fase 4): era una
 * funcion de 130 lineas dentro de un componente de 600. Funcion pura sobre un
 * contexto 2D: no toca React.
 */

import { config } from "@/config/app.config";
import type { Landmark } from "@/dominio/tipos";

/** Conexiones que forman el esqueleto visible. Indices de BlazePose / MediaPipe Pose. */
const CONEXIONES: readonly [number, number][] = [
  [11, 12], // hombro izquierdo - hombro derecho
  [11, 13], // hombro izq - codo izq
  [13, 15], // codo izq - muneca izq
  [12, 14], // hombro der - codo der
  [14, 16], // codo der - muneca der
  [11, 23], // hombro izq - cadera izq
  [12, 24], // hombro der - cadera der
  [23, 24], // cadera izq - cadera der
  [7, 8],   // oreja izq - oreja der
];

export function dibujarEsqueletoIndividual(
  ctx: CanvasRenderingContext2D,
  lms: Landmark[],
  color: string,
  width: number,
  height: number,
  etiqueta?: string,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  const umbral = config.UMBRAL_VISIBILIDAD_LANDMARK;

  // Conexiones estandar
  for (const [a, b] of CONEXIONES) {
    const pa = lms[a];
    const pb = lms[b];
    if (!pa || !pb || (pa.visibility ?? 1) < umbral || (pb.visibility ?? 1) < umbral) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }

  const hombroIzq = lms[11];
  const hombroDer = lms[12];
  const orejaIzq = lms[7];
  const orejaDer = lms[8];
  const caderaIzq = lms[23];
  const caderaDer = lms[24];
  const bocaIzq = lms[9];
  const bocaDer = lms[10];
  const nariz = lms[0];

  // Conexiones anatomicas sintetizadas: Cadena de Cuello (C7, C4, C1) y Columna
  if (
    hombroIzq &&
    hombroDer &&
    (hombroIzq.visibility ?? 1) >= umbral &&
    (hombroDer.visibility ?? 1) >= umbral
  ) {
    const cuelloBaseX = (hombroIzq.x + hombroDer.x) / 2;
    const cuelloBaseY = (hombroIzq.y + hombroDer.y) / 2;

    let cuelloTopeX = cuelloBaseX;
    let cuelloTopeY = cuelloBaseY - 0.12;

    if (
      orejaIzq &&
      orejaDer &&
      (orejaIzq.visibility ?? 1) >= umbral &&
      (orejaDer.visibility ?? 1) >= umbral
    ) {
      const orejasX = (orejaIzq.x + orejaDer.x) / 2;
      const orejasY = (orejaIzq.y + orejaDer.y) / 2;

      if (bocaIzq && bocaDer && (bocaIzq.visibility ?? 1) >= umbral && (bocaDer.visibility ?? 1) >= umbral) {
        const bocaX = (bocaIzq.x + bocaDer.x) / 2;
        const bocaY = (bocaIzq.y + bocaDer.y) / 2;
        cuelloTopeX = orejasX * 0.65 + bocaX * 0.35;
        cuelloTopeY = orejasY * 0.65 + bocaY * 0.35;
      } else if (nariz && (nariz.visibility ?? 1) >= umbral) {
        cuelloTopeX = orejasX * 0.7 + nariz.x * 0.3;
        cuelloTopeY = orejasY * 0.7 + nariz.y * 0.3;
      } else {
        cuelloTopeX = orejasX;
        cuelloTopeY = orejasY;
      }
    }

    const cuelloMedioX = (cuelloBaseX + cuelloTopeX) / 2;
    const cuelloMedioY = (cuelloBaseY + cuelloTopeY) / 2;

    // Trazo del cuello completo: Base (C7) -> Centro (C4) -> Tope (C1)
    ctx.beginPath();
    ctx.moveTo(cuelloBaseX * width, cuelloBaseY * height);
    ctx.lineTo(cuelloMedioX * width, cuelloMedioY * height);
    ctx.lineTo(cuelloTopeX * width, cuelloTopeY * height);
    ctx.stroke();

    // Trazo de hombros a base del cuello
    ctx.beginPath();
    ctx.moveTo(hombroIzq.x * width, hombroIzq.y * height);
    ctx.lineTo(cuelloBaseX * width, cuelloBaseY * height);
    ctx.lineTo(hombroDer.x * width, hombroDer.y * height);
    ctx.stroke();

    // Trazo de columna
    if (
      caderaIzq &&
      caderaDer &&
      (caderaIzq.visibility ?? 1) >= umbral &&
      (caderaDer.visibility ?? 1) >= umbral
    ) {
      const pelvisX = (caderaIzq.x + caderaDer.x) / 2;
      const pelvisY = (caderaIzq.y + caderaDer.y) / 2;
      ctx.beginPath();
      ctx.moveTo(cuelloBaseX * width, cuelloBaseY * height);
      ctx.lineTo(pelvisX * width, pelvisY * height);
      ctx.stroke();
    }

    // Dibujar los 3 puntos del cuello
    ctx.beginPath();
    ctx.arc(cuelloBaseX * width, cuelloBaseY * height, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cuelloMedioX * width, cuelloMedioY * height, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cuelloTopeX * width, cuelloTopeY * height, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Puntos del cuerpo
  for (const indice of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
    const p = lms[indice];
    if (!p || (p.visibility ?? 1) < umbral) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Etiqueta identificadora si se provee
  if (etiqueta && nariz && (nariz.visibility ?? 1) >= umbral) {
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(etiqueta, nariz.x * width - 30, Math.max(20, nariz.y * height - 16));
  }
}
