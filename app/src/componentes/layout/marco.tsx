/**
 * Marco de la aplicacion: barra lateral + franja de bandeja + contenido.
 *
 * La navegacion siempre esta en el mismo sitio y el destino actual siempre esta
 * resaltado (WCAG 2.2 y consistencia basica). Cada elemento lleva icono Y texto:
 * una navegacion solo de iconos obliga a adivinar.
 */

import { useEffect } from "react";
import { NavLink, Outlet } from "react-router";
import {
  Activity,
  CalendarRange,
  HeartPulse,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { APP } from "@/config/app.config";
import { useInterfaz } from "@/estado/interfaz";
import { useSimulacion } from "@/estado/simulacion";
import { useSesionUsuario } from "@/estado/sesion-usuario";
import { LogoEspinker } from "@/componentes/comunes/logo-espinker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MenuCuenta } from "./menu-cuenta";
import { FranjaBandeja, NotificacionesEscritorio } from "./franja-bandeja";

interface ItemNavegacion {
  a: string;
  icono: typeof Activity;
  texto: string;
  exacto?: boolean;
}

const NAVEGACION: ItemNavegacion[] = [
  { a: "/", icono: Activity, texto: "Panel de hoy", exacto: true },
  { a: "/historial", icono: CalendarRange, texto: "Historial" },
  { a: "/antecedentes", icono: HeartPulse, texto: "Antecedentes" },
  { a: "/ajustes", icono: Settings, texto: "Ajustes" },
  { a: "/ayuda", icono: LifeBuoy, texto: "Ayuda y errores" },
];

const ITEM_EQUIPO: ItemNavegacion = { a: "/equipo", icono: Users, texto: "Equipo" };

/** "Equipo" solo aparece para el rol RRHH. Es comodidad: la proteccion real esta en la base. */
function useNavegacion() {
  const rol = useSesionUsuario((s) => s.usuario?.rol);
  return rol === "rrhh_jefe"
    ? [...NAVEGACION.slice(0, 3), ITEM_EQUIPO, ...NAVEGACION.slice(3)]
    : NAVEGACION;
}


export function Marco() {
  const abierta = useInterfaz((s) => s.barraLateralAbierta);
  const alternar = useInterfaz((s) => s.alternarBarraLateral);
  const cargarSesion = useSimulacion((s) => s.cargar);
  const navegacion = useNavegacion();

  // La sesion se hidrata aqui y no en el panel: la franja de bandeja aparece en
  // todas las rutas, asi que entrar directo a /historial tambien debe mostrar el
  // estado real y no una sesion en cero.
  useEffect(() => {
    void cargarSesion();
  }, [cargarSesion]);

  return (
    <div className="bg-background flex min-h-dvh">
      <a
        href="#contenido"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Saltar al contenido
      </a>

      <aside
        className={cn(
          "border-border bg-card sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
          abierta ? "w-60" : "w-[4.5rem]",
        )}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <LogoEspinker />
          {abierta && (
            <span className="truncate font-semibold tracking-tight">{APP.nombre}</span>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-2" aria-label="Navegacion principal">
          {navegacion.map(({ a, icono: Icono, texto, exacto }) => (
            <NavLink
              key={a}
              to={a}
              end={exacto}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  "hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground",
                )
              }
              title={abierta ? undefined : texto}
            >
              <Icono className="size-4 shrink-0" aria-hidden />
              {abierta && <span className="truncate">{texto}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-border space-y-2 border-t p-2">
          <MenuCuenta expandido={abierta} />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={alternar}
            aria-label={abierta ? "Contraer barra lateral" : "Expandir barra lateral"}
          >
            {abierta ? (
              <>
                <PanelLeftClose className="size-4" aria-hidden />
                Contraer
              </>
            ) : (
              <PanelLeftOpen className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <FranjaBandeja />
        <NavegacionMovil />
        <main id="contenido" className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <NotificacionesEscritorio />
    </div>
  );
}

/** En pantallas pequenas la navegacion pasa a una fila con desplazamiento. */
function NavegacionMovil() {
  const navegacion = useNavegacion();
  return (
    <nav
      className="border-border flex gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden"
      aria-label="Navegacion principal"
    >
      {navegacion.map(({ a, icono: Icono, texto, exacto }) => (
        <NavLink
          key={a}
          to={a}
          end={exacto}
          className={({ isActive }) =>
            cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs whitespace-nowrap",
              isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground",
            )
          }
        >
          <Icono className="size-3.5" aria-hidden />
          {texto}
        </NavLink>
      ))}
      <MenuCuenta compacto />
    </nav>
  );
}
