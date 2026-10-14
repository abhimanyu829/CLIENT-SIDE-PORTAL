import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Legal-consent + cookie-consent gate test suite (SEPARATE from the
 * agent-gateway suite in vitest.config.ts and the subscription suites).
 * Run with: npm run test:consent
 *
 * Node environment, in-memory fakes for Prisma/Clerk — no real DB, no network.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/consent/__tests__/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
