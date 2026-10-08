import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Phase 1 — Subscriptions domain test suite (SEPARATE from the agent-gateway
 * suite in vitest.config.ts). Run with: npm run test:subscriptions
 *
 * These tests use in-memory fakes for the Prisma client — no real database,
 * no network. They cover the subscription FOUNDATION only (state machine,
 * foundation service, domain separation, security, concurrency, failure)
 * plus guard behaviour of the existing subscription-service.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/services/__tests__/subscription-*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
