import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 10 — Billing reconciliation suite (SEPARATE). Run:
 * npm run test:reconciliation
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/services/__tests__/reconciliation-*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})