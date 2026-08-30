import path from "node:path";
import { defineConfig } from "vitest/config";

// Los tests cubren la capa `dominio/` (logica pura, sin React) y la regla de
// arquitectura. No hay tests de componentes: esto es un mock visual, y un test
// de render aqui daria una falsa sensacion de cobertura.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
