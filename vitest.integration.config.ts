import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Opt-in integration suites that need real local infrastructure (Phase 8:
 * BullMQ against a local Redis-compatible server such as Memurai). They are
 * never part of the default `vitest run`, whose include pattern only matches
 * `*.test.ts`. Run with:
 *
 *   npx vitest run -c vitest.integration.config.ts
 *
 * The suites connect ONLY to an explicit loopback URL
 * (AGENT_GATEWAY_IT_REDIS_URL, default redis://127.0.0.1:6379) — never to
 * the application's REDIS_URL — and use a unique key prefix per run that
 * they delete afterwards.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/agent-gateway/**/*.integration.ts"],
    setupFiles: ["lib/agent-gateway/tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
