/**
 * lib/agent-gateway/mcp/config.ts
 *
 * Phase 5 — MCP-specific configuration. Follows the exact fail-fast zod
 * pattern already established by lib/agent-gateway/config.ts (Phase 1) —
 * a deliberately separate module so the MCP layer never widens or
 * depends on the main app's env schema, and the main app is unaffected
 * if MCP config is absent (the endpoint simply reports disabled).
 *
 * No secret value is ever logged or returned from any diagnostic here.
 */
import { z } from "zod"

const mcpConfigSchema = z.object({
  /** Master switch. Defaults to disabled — the MCP endpoint is opt-in, same convention as AGENT_GATEWAY_ENABLED. */
  AGENT_GATEWAY_MCP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  /**
   * Upper bound on the number of tools/list results per page, and on the
   * size of any single tool's projected input/output schema — descriptive
   * limits only, not a security control. Defaults chosen generously since
   * the Phase 3 manifest is small; documented, not arbitrary.
   */
  AGENT_GATEWAY_MCP_MAX_TOOLS_PER_PAGE: z.coerce.number().int().positive().optional().default(100),
})

export type McpConfig = z.infer<typeof mcpConfigSchema>

let cached: McpConfig | null = null

/**
 * Lazily parsed (not at module load) so importing this file never crashes
 * the host Next.js process — an invalid/missing MCP config degrades to
 * disabled behavior at the route boundary instead of a hard throw, same
 * precedent as lib/agent-gateway/config.ts.
 */
export function getMcpConfig(): McpConfig {
  if (cached) return cached
  const parsed = mcpConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    cached = mcpConfigSchema.parse({ AGENT_GATEWAY_MCP_ENABLED: "0" })
    return cached
  }
  cached = parsed.data
  return cached
}

/** Test-only: clears the memoized config so tests can re-parse under different env vars. */
export function __resetMcpConfigForTests(): void {
  cached = null
}
