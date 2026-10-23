import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  preview: {
    host: "0.0.0.0",
    port: 3100,
    strictPort: true,
    allowedHosts: [".e2b.app"],
    proxy: {
      "/admin": { target: "http://127.0.0.1:3101", changeOrigin: false },
      "/_next": { target: "http://127.0.0.1:3101", changeOrigin: false },
      "/api": { target: "http://127.0.0.1:3101", changeOrigin: false },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3100,
    strictPort: true,
    allowedHosts: [".e2b.app"],
    proxy: {
      "/admin": { target: "http://127.0.0.1:3101", changeOrigin: false },
      "/_next": {
        target: "http://127.0.0.1:3101",
        changeOrigin: false,
        ws: true,
      },
      "/api": { target: "http://127.0.0.1:3101", changeOrigin: false },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
