/**
 * Autenticacion: iniciar sesion (dos metodos) y crear cuenta.
 *
 * El modo de uso (personal/oficina) se decide al registrarse con correo, y
 * gobierna que pantallas y layout se montan mas adelante (Fase 3) -- no es un
 * ajuste cosmetico. El codigo de organizacion es el segundo metodo de login,
 * pensado para un equipo compartido: fuerza modo "oficina" sin pedir
 * credenciales personales.
 */

import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampoSelect } from "@/componentes/comunes/campo-select";
import { EstadoError } from "@/componentes/comunes/avisos";
import { AVISO_DEMO, APP } from "@/config/app.config";
import type { ModoUso } from "@/dominio/tipos";
import { useSesionUsuario } from "@/estado/sesion-usuario";

const OPCIONES_MODO_USO = [
  { valor: "personal", texto: "Personal — monitoreo individual" },
  { valor: "oficina", texto: "Oficina — varios puestos de trabajo" },
] as const;

export function PantallaAutenticacion() {
  const navigate = useNavigate();
  const ubicacion = useLocation();
  const destino = (ubicacion.state as { desde?: Location })?.desde?.pathname ?? "/bienvenida";

  const iniciarSesionConCorreo = useSesionUsuario((s) => s.iniciarSesionConCorreo);
  const iniciarSesionConCodigoOrganizacion = useSesionUsuario(
    (s) => s.iniciarSesionConCodigoOrganizacion,
  );
  const registrarse = useSesionUsuario((s) => s.registrarse);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function manejar(accion: () => Promise<void>) {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      navigate(destino, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">{APP.nombre}</h1>
          <p className="text-muted-foreground text-sm">Monitor de postura</p>
        </div>

        <Tabs defaultValue="ingresar">
          <TabsList className="w-full">
            <TabsTrigger value="ingresar">Iniciar sesion</TabsTrigger>
            <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="ingresar" className="mt-4">
            <FormularioIngreso
              enviando={enviando}
              onCorreo={(correo, contrasena) =>
                manejar(() => iniciarSesionConCorreo({ correo, contrasena }))
              }
              onCodigo={(codigo) => manejar(() => iniciarSesionConCodigoOrganizacion(codigo))}
            />
          </TabsContent>

          <TabsContent value="registro" className="mt-4">
            <FormularioRegistro
              enviando={enviando}
              onRegistrar={(datos) => manejar(() => registrarse(datos))}
            />
          </TabsContent>
        </Tabs>

        {error != null && <EstadoError error={error} />}

        <p className="text-muted-foreground text-center text-xs">{AVISO_DEMO}</p>
      </div>
    </div>
  );
}

function FormularioIngreso({
  enviando,
  onCorreo,
  onCodigo,
}: {
  enviando: boolean;
  onCorreo(correo: string, contrasena: string): void;
  onCodigo(codigo: string): void;
}) {
  return (
    <Tabs defaultValue="correo">
      <TabsList variant="line" className="w-full">
        <TabsTrigger value="correo">Correo y contrasena</TabsTrigger>
        <TabsTrigger value="codigo">Codigo de oficina</TabsTrigger>
      </TabsList>

      <TabsContent value="correo" className="mt-4">
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            onCorreo(String(datos.get("correo")), String(datos.get("contrasena")));
          }}
        >
          <CampoTexto id="correo-ingreso" nombre="correo" etiqueta="Correo" tipo="email" />
          <CampoTexto
            id="contrasena-ingreso"
            nombre="contrasena"
            etiqueta="Contrasena"
            tipo="password"
          />
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Verificando..." : "Iniciar sesion"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="codigo" className="mt-4">
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            onCodigo(String(datos.get("codigo")));
          }}
        >
          <CampoTexto
            id="codigo-organizacion"
            nombre="codigo"
            etiqueta="Codigo de acceso de tu oficina"
            tipo="text"
          />
          <p className="text-muted-foreground text-xs text-balance">
            Pide este codigo a la persona responsable de tu oficina. Pensado para un computador
            compartido en la sala: no pide tus credenciales personales.
          </p>
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Verificando..." : "Entrar con el codigo"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}

function FormularioRegistro({
  enviando,
  onRegistrar,
}: {
  enviando: boolean;
  onRegistrar(datos: {
    correo: string;
    contrasena: string;
    nombre: string;
    modoUso: ModoUso;
  }): void;
}) {
  const [modoUso, setModoUso] = useState<ModoUso>("personal");

  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        onRegistrar({
          correo: String(datos.get("correo")),
          contrasena: String(datos.get("contrasena")),
          nombre: String(datos.get("nombre")),
          modoUso,
        });
      }}
    >
      <CampoTexto id="nombre-registro" nombre="nombre" etiqueta="Nombre" tipo="text" />
      <CampoTexto id="correo-registro" nombre="correo" etiqueta="Correo" tipo="email" />
      <CampoTexto
        id="contrasena-registro"
        nombre="contrasena"
        etiqueta="Contrasena"
        tipo="password"
      />
      <CampoSelect
        id="modo-uso-registro"
        etiqueta="Como vas a usarla"
        valor={modoUso}
        opciones={OPCIONES_MODO_USO}
        onCambio={(v) => setModoUso(v as ModoUso)}
      />
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
    </form>
  );
}

function CampoTexto({
  id,
  nombre,
  etiqueta,
  tipo,
}: {
  id: string;
  nombre: string;
  etiqueta: string;
  tipo: "email" | "password" | "text";
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={nombre} type={tipo} required autoComplete="on" />
    </div>
  );
}
