import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:3001",
      "/healthz": "http://localhost:3001",
    },
  },
  resolve: {
    alias: {
      "@contracts": path.resolve(__dirname, "../contracts/src"),
    },
  },
});
