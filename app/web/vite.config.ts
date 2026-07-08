import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4001",
    },
    // app/shared-types/ lives outside this project's root (app/web/) —
    // allow the dev server to read it. Only affects `vite dev`'s file-serving
    // guard; `vite build` resolves modules normally regardless.
    fs: {
      allow: [".."],
    },
  },
});
