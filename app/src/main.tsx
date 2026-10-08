import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import { App } from "./App";
import { aplicarTema, useInterfaz } from "@/estado/interfaz";
import { useSesionUsuario } from "@/estado/sesion-usuario";

// El tema se aplica ANTES del primer render: sin esto, quien tiene el sistema en
// oscuro ve un destello blanco en cada carga.
aplicarTema(useInterfaz.getState().tema);

// Resuelve si hay sesion ANTES del primer render tiene sentido para el tema
// (sincrono); para la sesion no se puede, porque consulta a Supabase. Arranca
// aqui para que la consulta ya este en curso cuando <RutaProtegida> la lea.
void useSesionUsuario.getState().inicializar();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
