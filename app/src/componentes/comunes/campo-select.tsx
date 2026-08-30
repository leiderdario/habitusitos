/**
 * Desplegable con etiqueta, ayuda y resolucion del texto visible.
 *
 * DOS RAZONES PARA QUE ESTE COMPONENTE EXISTA:
 *
 * 1. La primitiva muestra el VALOR crudo en el disparador, no la etiqueta. Sin
 *    esto, un ajuste de "Modelo de deteccion" se ve como "0" en vez de "Ligero
 *    (mas rapido)", que no significa nada para nadie.
 *
 * 2. Los valores numericos de configuracion se ofrecen como opciones ETIQUETADAS
 *    y no como campos libres (seccion 9.3 del prompt maestro): nadie que no haya
 *    escrito el algoritmo sabe que implica poner el muestreo en 17.
 */

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OpcionSelect {
  valor: string;
  texto: string;
}

interface Props {
  id: string;
  etiqueta: string;
  ayuda?: ReactNode;
  valor: string;
  opciones: readonly OpcionSelect[];
  onCambio(valor: string): void;
}

export function CampoSelect({ id, etiqueta, ayuda, valor, opciones, onCambio }: Props) {
  const seleccionada = opciones.find((o) => o.valor === valor);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {etiqueta}
      </Label>
      <Select
        value={valor}
        // La primitiva puede emitir null al deseleccionar; el llamador solo
        // maneja valores reales, asi que se filtra aqui y no en cada uso.
        onValueChange={(v) => {
          if (v !== null) onCambio(String(v));
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{seleccionada?.texto ?? valor}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {ayuda && <p className="text-muted-foreground text-xs text-balance">{ayuda}</p>}
    </div>
  );
}
