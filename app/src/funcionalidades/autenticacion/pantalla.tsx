/**
 * Autenticacion: iniciar sesion (dos metodos) y crear cuenta.
 *
 * El modo de uso (personal/oficina) se decide al registrarse con correo, y
 * gobierna que pantallas y layout se montan mas adelante (Fase 3) -- no es un
 * ajuste cosmetico. El codigo de organizacion es el segundo metodo de login,
 * pensado para un equipo compartido: fuerza modo "oficina" sin pedir
 * credenciales personales.
 *
 * Distribucion (docs/PLAN_REDISENO_ESPINKER.md, Fase 3): a partir de 1024 px, el
 * 55 % izquierdo es el panel con la columna 3D interactiva y el 45 % derecho el
 * formulario. Por debajo, solo el formulario.
 */

import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampoSelect } from "@/componentes/comunes/campo-select";
import { EstadoError } from "@/componentes/comunes/avisos";
import { FondoColumna } from "@/componentes/comunes/columna-3d/fondo-columna";
import { LogoEspinker } from "@/componentes/comunes/logo-espinker";
import { SelectorTema } from "@/componentes/layout/selector-tema";
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
    <div className="bg-background grid min-h-dvh lg:grid-cols-[55fr_45fr]">
      <aside className="bg-panel text-sobre-panel relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
        <FondoColumna />
        {/* El texto no intercepta el puntero: la columna de debajo sigue respondiendo. */}
        <div className="pointer-events-none relative max-w-[30ch] space-y-2">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            Tu espalda trabaja contigo todo el día.
          </p>
          <p className="text-panel-suave text-sm text-balance">
            {APP.nombre} te avisa a tiempo cuando la postura empieza a cansarte.
          </p>
        </div>
        <p className="text-panel-suave relative text-[6px] leading-3 italic">
          Modelo 3D:{" "}
          <a
            href="https://github.com/Z-Anatomy/Models-of-human-anatomy"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Z-Anatomy
          </a>{" "}
          y BodyParts3D · CC BY-SA 4.0
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-16 sm:px-8">
        <SelectorTema className="absolute top-4 right-4" />

        <div className="w-full max-w-[440px] space-y-4">
          {/* Marco de madera de bordes gruesos: el mismo que rodea a la camara. */}
          <div className="border-madera-suave bg-madera-suave rounded-[1.75rem] border-[6px]">
            <div className="bg-card space-y-6 rounded-[1.375rem] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <LogoEspinker className="size-11 rounded-xl" />
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{APP.nombre}</h1>
                  <p className="text-muted-foreground text-sm">Cuida tu postura mientras trabajas</p>
                </div>
              </div>

              <Tabs defaultValue="ingresar">
                <TabsList className="h-10 w-full">
                  <TabsTrigger value="ingresar">Iniciar sesión</TabsTrigger>
                  <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
                </TabsList>

                <TabsContent value="ingresar" className="mt-5">
                  <FormularioIngreso
                    enviando={enviando}
                    onCorreo={(correo, contrasena) =>
                      manejar(() => iniciarSesionConCorreo({ correo, contrasena }))
                    }
                    onCodigo={(codigo) => manejar(() => iniciarSesionConCodigoOrganizacion(codigo))}
                  />
                </TabsContent>

                <TabsContent value="registro" className="mt-5">
                  <FormularioRegistro
                    enviando={enviando}
                    onRegistrar={(datos) => manejar(() => registrarse(datos))}
                  />
                </TabsContent>
              </Tabs>

              {error != null && <EstadoError error={error} />}
            </div>
          </div>

          <p className="text-muted-foreground text-center text-xs">{AVISO_DEMO}</p>
        </div>
      </main>
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
  // El codigo de oficina es el camino menos frecuente: un enlace debajo del
  // formulario en vez de un segundo nivel de pestanas que compite con el primero.
  const [metodo, setMetodo] = useState<"correo" | "codigo">("correo");

  return (
    <div className="space-y-4">
      {metodo === "correo" ? (
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            onCorreo(String(datos.get("correo")), String(datos.get("contrasena")));
          }}
        >
          <CampoTexto
            id="correo-ingreso"
            nombre="correo"
            etiqueta="Correo"
            tipo="email"
            autocompletar="email"
          />
          <CampoTexto
            id="contrasena-ingreso"
            nombre="contrasena"
            etiqueta="Contraseña"
            tipo="password"
            autocompletar="current-password"
          />
          <Button type="submit" size="lg" className="h-10 w-full" disabled={enviando}>
            {enviando ? "Verificando..." : "Iniciar sesión"}
          </Button>
        </form>
      ) : (
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
            etiqueta="Código de acceso de tu oficina"
            tipo="text"
            autocompletar="off"
          />
          <p className="text-muted-foreground text-xs text-balance">
            Pide este código a la persona responsable de tu oficina. Pensado para un computador
            compartido en la sala: no pide tus credenciales personales.
          </p>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={enviando}>
            {enviando ? "Verificando..." : "Entrar con el código"}
          </Button>
        </form>
      )}

      <Button
        type="button"
        variant="link"
        className="w-full"
        onClick={() => setMetodo(metodo === "correo" ? "codigo" : "correo")}
      >
        {metodo === "correo"
          ? "Entrar con el código de tu oficina"
          : "Entrar con correo y contraseña"}
      </Button>
    </div>
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
      <CampoTexto id="nombre-registro" nombre="nombre" etiqueta="Nombre" tipo="text" autocompletar="name" />
      <CampoTexto id="correo-registro" nombre="correo" etiqueta="Correo" tipo="email" autocompletar="email" />
      <CampoTexto
        id="contrasena-registro"
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autocompletar="new-password"
      />
      <CampoSelect
        id="modo-uso-registro"
        etiqueta="Cómo vas a usarla"
        valor={modoUso}
        opciones={OPCIONES_MODO_USO}
        onCambio={(v) => setModoUso(v as ModoUso)}
      />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={enviando}>
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
  autocompletar,
}: {
  id: string;
  nombre: string;
  etiqueta: string;
  tipo: "email" | "password" | "text";
  autocompletar: string;
}) {
  const [visible, setVisible] = useState(false);
  const esContrasena = tipo === "password";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <div className="relative">
        <Input
          id={id}
          name={nombre}
          type={esContrasena && visible ? "text" : tipo}
          required
          autoComplete={autocompletar}
          className={esContrasena ? "h-10 pr-10" : "h-10"}
        />
        {esContrasena && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </Button>
        )}
      </div>
    </div>
  );
}
