import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 2 — Plan catalog test suite (SEPARATE from the agent-gateway and
 * Phase-1 suites). Run with: npm run test:plans
 * In-memory fake Prisma client; no network, no real DB.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/services/__tests__/plan-*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
