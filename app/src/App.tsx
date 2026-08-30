import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";
import { Marco } from "@/componentes/layout/marco";
import { PantallaPanelHoy } from "@/funcionalidades/panel-hoy/pantalla";
import { PantallaHistorial } from "@/funcionalidades/historial/pantalla";
import { PantallaBenchmark } from "@/funcionalidades/benchmark/pantalla";
import { PantallaAjustes } from "@/funcionalidades/ajustes/pantalla";
import { PantallaAyuda } from "@/funcionalidades/ayuda/pantalla";
import { PantallaOnboarding } from "@/funcionalidades/onboarding/pantalla";

/**
 * Rutas del prototipo.
 *
 * El onboarding va FUERA del marco: en el producto real es un asistente modal
 * que corre antes de que exista la ventana principal, y presentarlo dentro de la
 * barra lateral daria una idea equivocada de como se ve la primera ejecucion.
 */
export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/bienvenida" element={<PantallaOnboarding />} />
        <Route element={<Marco />}>
          <Route index element={<PantallaPanelHoy />} />
          <Route path="historial" element={<PantallaHistorial />} />
          <Route path="benchmark" element={<PantallaBenchmark />} />
          <Route path="ajustes" element={<PantallaAjustes />} />
          <Route path="ayuda" element={<PantallaAyuda />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

