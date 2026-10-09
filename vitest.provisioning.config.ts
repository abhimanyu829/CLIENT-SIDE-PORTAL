import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 5 — subscription provisioning suite (SEPARATE). Run:
 * npm run test:provisioning
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/services/__tests__/provisioning-*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})