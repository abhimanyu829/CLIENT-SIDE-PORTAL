import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 3 — Entitlement Engine test suite (SEPARATE from gateway, Phase-1 and
 * Phase-2 suites). Run with: npm run test:entitlements
 * In-memory fake Prisma client; no network, no real DB.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/services/__tests__/entitlement-*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
