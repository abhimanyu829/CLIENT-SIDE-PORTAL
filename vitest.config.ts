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
    // default 5000ms default occasionally isn't enough. 10s is still well
    // short of ever masking a real hang.
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
