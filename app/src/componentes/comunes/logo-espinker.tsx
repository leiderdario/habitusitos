/**
 * Logotipo de Espinker: una columna en S con cuatro vertebras.
 *
 * Aporte propio de Espinker. Usa `currentColor` para heredar el color del
 * contenedor: ningun hex crudo, y cambia solo con el tema. El fondo azul con
 * borde inferior de madera es el mismo que se aprobo en la maqueta de la paleta.
 */

import { cn } from "@/lib/utils";

export function LogoEspinker({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground border-madera flex size-8 shrink-0 items-center justify-center rounded-lg border-b-[3px]",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="size-[1.1rem]"
      >
        <path d="M12 3c-2 3 2 5 0 8s2 5 0 8" />
        <path d="M9 5h6M9.5 9.5h5M9 14h6M9.5 18.5h5" />
      </svg>
    </span>
  );
}
