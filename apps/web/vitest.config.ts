import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "../worker/tests/**/*.spec.ts"],
    exclude: ["tests/**/*.integration.test.ts"],
    globals: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ai-comms-agent/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@ai-comms-agent/db": path.resolve(__dirname, "../../packages/db/src"),
    },
  },
});
