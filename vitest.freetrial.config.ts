import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 6 — Free Forever + trial suite (SEPARATE). Run:
 * npm run test:freetrial
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/services/__tests__/free-trial-*.test.ts",
      "lib/services/__tests__/free-enrollment.test.ts",
      "lib/services/__tests__/trial-*.test.ts",
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
