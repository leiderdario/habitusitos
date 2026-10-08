/**
 * Colores de la escena 3D leidos de los tokens de index.css.
 *
 * Aporte propio de Espinker. Three no entiende `oklch(...)`, asi que cada token
 * se pinta en un lienzo de 1x1 y se lee el pixel: el navegador hace la
 * conversion y la escena nunca escribe un color en crudo. Se recalcula cuando
 * cambia la clase `dark` del documento.
 */

import { useEffect, useState } from "react";
import { Color, SRGBColorSpace } from "three";

export interface ColoresColumna {
  hueso: Color;
  resalte: Color;
  luz: Color;
}

function leerToken(ctx: CanvasRenderingContext2D, nombre: string): Color {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(`--${nombre}`).trim();
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "black";
  ctx.fillStyle = valor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

function leerColores(): ColoresColumna {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1;
  lienzo.height = 1;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Sin contexto 2D para leer los colores del tema");
  return {
    hueso: leerToken(ctx, "columna-hueso"),
    resalte: leerToken(ctx, "columna-resalte"),
    luz: leerToken(ctx, "columna-luz"),
  };
}

export function useColoresColumna(): ColoresColumna {
  const [colores, setColores] = useState(leerColores);

  useEffect(() => {
    const observador = new MutationObserver(() => setColores(leerColores()));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observador.disconnect();
  }, []);

  return colores;
}
