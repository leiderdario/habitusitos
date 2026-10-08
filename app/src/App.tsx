import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";
import { Marco } from "@/componentes/layout/marco";
import { ExigeConsentimiento } from "@/componentes/layout/exige-consentimiento";
import { RutaProtegida } from "@/componentes/layout/ruta-protegida";
import { RutaRol } from "@/componentes/layout/ruta-rol";
import { PantallaAutenticacion } from "@/funcionalidades/autenticacion/pantalla";
import { PantallaPanelPersonal } from "@/funcionalidades/panel-personal/pantalla";
import { PantallaPanelOficina } from "@/funcionalidades/panel-oficina/pantalla";
import { PantallaAntecedentes } from "@/funcionalidades/antecedentes/pantalla";
import { PantallaHistorial } from "@/funcionalidades/historial/pantalla";
import { PantallaAjustes } from "@/funcionalidades/ajustes/pantalla";
import { PantallaAyuda } from "@/funcionalidades/ayuda/pantalla";
import { PantallaConsentimiento } from "@/funcionalidades/consentimiento/pantalla";
import { PantallaEquipo } from "@/funcionalidades/equipo/pantalla";
import { PantallaOnboarding } from "@/funcionalidades/onboarding/pantalla";
import { Cargando } from "@/componentes/comunes/avisos";
import { useSesionUsuario } from "@/estado/sesion-usuario";

/**
 * Rutas del prototipo.
 *
 * /ingresar queda fuera de <RutaProtegida> por definicion (es a donde ella
 * misma redirige). El onboarding tambien va FUERA del marco: en el producto
 * real es un asistente modal que corre antes de que exista la ventana
 * principal, y presentarlo dentro de la barra lateral daria una idea
 * equivocada de como se ve la primera ejecucion -- pero SI exige sesion,
 * porque ya pide datos de cuenta (Fase 1) y de salud (Fase 2).
 *
 * `/` monta un componente DISTINTO segun `Usuario.modo_uso` -- no la misma
 * pantalla con un flag (pedido explicito del usuario). La decision vive aqui,
 * no dentro de cada pantalla.
 */
function PanelSegunModo() {
  const usuario = useSesionUsuario((s) => s.usuario);
  if (!usuario) return <Cargando texto="Cargando tu cuenta..." />;
  return usuario.modo_uso === "oficina" ? <PantallaPanelOficina /> : <PantallaPanelPersonal />;
}

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/ingresar" element={<PantallaAutenticacion />} />
        <Route
          path="/bienvenida"
          element={
            <RutaProtegida>
              <PantallaOnboarding />
            </RutaProtegida>
          }
        />
        <Route
          path="/consentimiento"
          element={
            <RutaProtegida>
              <PantallaConsentimiento />
            </RutaProtegida>
          }
        />
        <Route
          element={
            <RutaProtegida>
              <ExigeConsentimiento>
                <Marco />
              </ExigeConsentimiento>
            </RutaProtegida>
          }
        >
          <Route index element={<PanelSegunModo />} />
          <Route path="historial" element={<PantallaHistorial />} />
          <Route path="antecedentes" element={<PantallaAntecedentes />} />
          <Route
            path="equipo"
            element={
              <RutaRol rol="rrhh_jefe">
                <PantallaEquipo />
              </RutaRol>
            }
          />
          <Route path="ajustes" element={<PantallaAjustes />} />
          <Route path="ayuda" element={<PantallaAyuda />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

