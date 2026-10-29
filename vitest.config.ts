import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@contracts": path.resolve(__dirname, "./contracts/src"),
      "@server": path.resolve(__dirname, "./server/src"),
      "@client": path.resolve(__dirname, "./client/src"),
    },
  },
});
