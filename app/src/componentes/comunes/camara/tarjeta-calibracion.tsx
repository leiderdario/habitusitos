/**
 * Estado de la calibracion personal, en una linea bajo la barra de controles.
 *
 * Aporte propio de Espinker (Fase 4): hasta ahora era un bloque con texto y
 * boton debajo del video. El boton paso a la barra de controles, junto al resto,
 * y aqui solo queda la explicacion de en que punto esta la calibracion.
 */

import type { CalibracionPostural } from "@/dominio/tipos";
import { estaCalibrada } from "./calibracion";

export function TarjetaCalibracion({
  calibracion,
  camaraActiva,
}: {
  calibracion: CalibracionPostural;
  camaraActiva: boolean;
}) {
  const conAngulo = calibracion.vectorArriba !== null;
  const calibrada = estaCalibrada(calibracion);

  const texto = calibrada
    ? conAngulo
      ? "Calibrado: Espinker ajustó la distancia y la inclinación respecto a tu cámara."
      : "Calibrado: Espinker ajustó la distancia natural de tu cabeza frente a la cámara."
    : camaraActiva
      ? "Siéntate como te sientas siempre y pulsa «Marca tu postura normal» para calibrar el ángulo y la distancia."
      : "En cuanto la cámara detecte tu rostro y tu cuerpo, podrás marcar tu postura de referencia.";

  return <p className="text-muted-foreground text-center text-xs text-balance">{texto}</p>;
}
