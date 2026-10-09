/**
 * Cerrar sesion: el store debe vaciar la cuenta y soltar la sesion simulada, para
 * que quien entre despues en la misma pestana no vea datos de la cuenta anterior.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const cerrarSesionApi = vi.fn().mockResolvedValue(undefined);

vi.mock("@/datos/api/auth.api", () => ({ cerrarSesion: cerrarSesionApi }));
vi.mock("@/datos/supabase/cliente", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() } },
}));

const { useSesionUsuario } = await import("@/estado/sesion-usuario");
const { useSimulacion } = await import("@/estado/simulacion");

describe("cerrarSesion", () => {
  beforeEach(() => {
    cerrarSesionApi.mockClear();
    useSesionUsuario.setState({
      usuario: {
        id: "u1",
        correo: "a@example.com",
        nombre: "Ana",
        modo_uso: "personal",
        rol: "trabajador",
        organizacion_id: null,
        creado_en: "2026-01-01T00:00:00.000Z",
      },
    });
    useSimulacion.setState({ listo: true });
  });

  it("llama a la API, deja usuario en null y marca la simulacion como no cargada", async () => {
    await useSesionUsuario.getState().cerrarSesion();
    expect(cerrarSesionApi).toHaveBeenCalledOnce();
    expect(useSesionUsuario.getState().usuario).toBeNull();
    expect(useSimulacion.getState().listo).toBe(false);
    expect(useSimulacion.getState().corriendo).toBe(false);
  });

  it("si la API falla, conserva la cuenta (no finge haber salido)", async () => {
    cerrarSesionApi.mockRejectedValueOnce(new Error("red"));
    await expect(useSesionUsuario.getState().cerrarSesion()).rejects.toThrow("red");
    expect(useSesionUsuario.getState().usuario).not.toBeNull();
    expect(useSimulacion.getState().listo).toBe(true);
  });
});
