import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/agent-gateway/**/*.test.ts"],
    setupFiles: ["lib/agent-gateway/tests/setup.ts"],
    // Phase 5's MCP integration tests spin up a real McpServer + real
    // Streamable HTTP transport per test case (see mcp-server-integration.test.ts,
    // mcp-route-handler.test.ts) — under full-suite parallel load the
    // default 5000ms default occasionally isn't enough. Phase 14 adds
    // CPU-heavy simulation / fuzz suites that run in parallel with the
    // module-reset-heavy Phase 8 worker suites (1-2s alone, >10s under that
    // load), so the ceiling is 30s. Still far short of masking a real hang.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
