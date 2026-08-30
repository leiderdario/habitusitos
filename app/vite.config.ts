import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// El mock es una SPA estatica pura: no hay servidor ni build de servidor. El
// producto final es una app de escritorio PyQt6; esto es solo el prototipo
// navegable. Ver ../docs/DE_MOCK_A_REAL.md.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // Los assets de MediaPipe (public/wasm y public/modelos) se sirven tal cual:
  // la libreria EXIGE que los .wasm no se renombren, asi que no pueden pasar
  // por el pipeline de assets con hash del bundler.
  assetsInclude: ["**/*.task"],
});
