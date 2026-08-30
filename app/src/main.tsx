import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import { App } from "./App";
import { aplicarTema, escucharTemaDelSistema, useInterfaz } from "@/estado/interfaz";

// El tema se aplica ANTES del primer render: sin esto, quien tiene el sistema en
// oscuro ve un destello blanco en cada carga.
aplicarTema(useInterfaz.getState().tema);
escucharTemaDelSistema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
