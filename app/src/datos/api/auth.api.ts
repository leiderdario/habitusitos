/**
 * Autenticacion y perfil de cuenta.
 *
 * A diferencia del resto de `datos/api/*`, esto NO pasa por `resolver()` de
 * `datos/cliente.ts`: esa funcion simula latencia sobre fixtures y hace que el
 * modo "http" falle a proposito porque no habia nada real detras todavia.
 * Aqui si hay algo real desde el dia uno (Supabase) -- envolverlo en el mismo
 * mecanismo seria fingir que tambien es mock.
 *
 * Los errores de Supabase se traducen a `ErrorApp` para que la interfaz los
 * presente igual que a cualquier otro error (ver `datos/cliente.ts::CATALOGO_ERRORES`).
 */

import { supabase } from "../supabase/cliente";
import { ErrorApp } from "@/dominio/tipos";
import type { ModoUso, Usuario } from "@/dominio/tipos";
import { registrarEvento } from "./registro.api";

export interface DatosRegistro {
  correo: string;
  contrasena: string;
  nombre: string;
  modoUso: ModoUso;
}

export interface CredencialesCorreo {
  correo: string;
  contrasena: string;
}

async function leerPerfil(id: string): Promise<Usuario> {
  const { data, error } = await supabase.from("usuarios").select("*").eq("id", id).single();
  if (error || !data) {
    throw new ErrorApp(
      "sesion-requerida",
      "No encontramos tu perfil.",
      "Iniciar sesion de nuevo",
    );
  }
  return data as Usuario;
}

export async function registrarse(datos: DatosRegistro): Promise<Usuario> {
  const { data, error } = await supabase.auth.signUp({
    email: datos.correo,
    password: datos.contrasena,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      throw new ErrorApp("correo-ya-registrado", error.message);
    }
    throw new ErrorApp("credenciales-invalidas", error.message);
  }
  if (!data.user) {
    throw new ErrorApp("credenciales-invalidas", "No se pudo crear la cuenta.");
  }

  const { error: errorPerfil } = await supabase.from("usuarios").insert({
    id: data.user.id,
    nombre: datos.nombre,
    modo_uso: datos.modoUso,
  });
  if (errorPerfil) {
    throw new ErrorApp("fallo-base-datos", errorPerfil.message);
  }

  await registrarEvento({ usuario_id: data.user.id, tipo: "login_exitoso", detalle: "registro" });
  return leerPerfil(data.user.id);
}

export async function iniciarSesionConCorreo(credenciales: CredencialesCorreo): Promise<Usuario> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credenciales.correo,
    password: credenciales.contrasena,
  });

  if (error || !data.user) {
    // Sin usuario_id: todavia no hay sesion. La policy de insert de
    // eventos_log permite explicitamente este caso. Sin detalle: el correo
    // intentado es dato personal (a veces de quien no tiene cuenta) y la base
    // lo rechaza desde 0006.
    await registrarEvento({ usuario_id: null, tipo: "login_fallido" });
    throw new ErrorApp("credenciales-invalidas", error?.message ?? "Credenciales invalidas.");
  }

  await registrarEvento({ usuario_id: data.user.id, tipo: "login_exitoso" });
  return leerPerfil(data.user.id);
}

/**
 * Segundo metodo de login: codigo de acceso de organizacion, para un equipo
 * compartido de oficina sin pedir credenciales personales. Requiere que
 * "Anonymous sign-ins" este activado en el proyecto de Supabase (Authentication
 * > Sign In / Up) -- viene desactivado por defecto en proyectos nuevos.
 */
export async function iniciarSesionConCodigoOrganizacion(codigo: string): Promise<Usuario> {
  const { data: sesionAnonima, error: errorAnonimo } = await supabase.auth.signInAnonymously();
  if (errorAnonimo || !sesionAnonima.user) {
    throw new ErrorApp(
      "credenciales-invalidas",
      errorAnonimo?.message ?? "No se pudo iniciar la sesion de oficina.",
    );
  }

  const { error: errorCodigo } = await supabase.rpc("unirse_con_codigo_organizacion", {
    p_codigo: codigo,
  });
  if (errorCodigo) {
    await supabase.auth.signOut();
    throw new ErrorApp("codigo-organizacion-invalido", errorCodigo.message);
  }

  await registrarEvento({
    usuario_id: sesionAnonima.user.id,
    tipo: "login_exitoso",
    detalle: "codigo_organizacion",
  });
  return leerPerfil(sesionAnonima.user.id);
}

/**
 * access_token de la sesion actual, para autenticarse ante el vision-node. El nodo lo
 * valida contra Supabase y comprueba que la cuenta sea de su organizacion. Solo viaja
 * por el WebSocket (nunca en una URL).
 */
export async function obtenerTokenSesion(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function cerrarSesion(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  await registrarEvento({ usuario_id: data.user?.id ?? null, tipo: "logout" });
  await supabase.auth.signOut();
}

/** null si no hay sesion activa (nunca lanza por ese motivo). */
export async function sesionActual(): Promise<Usuario | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  try {
    return await leerPerfil(data.user.id);
  } catch {
    return null;
  }
}
