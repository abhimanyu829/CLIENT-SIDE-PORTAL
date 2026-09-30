import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/agent-gateway/**/*.test.ts"],
    setupFiles: ["lib/agent-gateway/tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
