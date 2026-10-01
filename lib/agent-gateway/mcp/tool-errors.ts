/**
 * lib/agent-gateway/mcp/tool-errors.ts
 *
 * Phase 14 (finding P14-F1) — stable, non-reflecting tool errors for the
 * failures the MCP SDK produces itself, before a gateway tool callback runs:
 *
 *   - argument validation against the tool's input schema
 *     ("Input validation error: ... received '<the agent's value>' ...");
 *   - unknown / disabled tool ("Tool <the agent's name> not found");
 *   - output validation.
 *
 * The SDK message echoes agent-supplied values and key names verbatim
 * (credential-shaped strings, injection payloads, control characters) back
 * into the model's context and the client's transcript. The gateway's own
 * errors never do that ("CODE: message" with fixed text), so these are
 * mapped onto the same contract here.
 *
 * Mechanism: McpServer builds every such result through its
 * `createToolError(message)` method (SDK 1.31.0, exact-pinned; the Phase 14
 * fuzz and the p14-tool-errors test fail if that ever changes). Gateway
 * callbacks never throw to the SDK — they return their own results — so
 * only SDK-originated failures pass through this function.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

const STABLE = {
  INVALID_INPUT: "INVALID_INPUT: The arguments do not match this tool's input schema.",
  CAPABILITY_NOT_FOUND: "CAPABILITY_NOT_FOUND: The requested tool is not available.",
  INTERNAL_ERROR: "INTERNAL_ERROR: The tool call could not be completed.",
} as const

/** Maps an SDK tool-error message to the gateway's stable error text. Never returns any part of the input. */
export function stableToolErrorText(sdkMessage: string): string {
  if (/Input validation error/i.test(sdkMessage)) return STABLE.INVALID_INPUT
  if (/^(?:MCP error -?\d+: )?Tool [\s\S]* (?:not found|disabled)$/.test(sdkMessage)) return STABLE.CAPABILITY_NOT_FOUND
  return STABLE.INTERNAL_ERROR
}

/** Installs the stable error mapping on one per-request McpServer. */
export function installStableToolErrors(server: McpServer): void {
  const target = server as unknown as { createToolError?: (message: string) => CallToolResult }
  if (typeof target.createToolError !== "function") {
    throw new Error("MCP SDK no longer exposes createToolError; the stable tool-error mapping must be re-implemented before upgrading.")
  }
  target.createToolError = (message: string): CallToolResult => ({
    content: [{ type: "text", text: stableToolErrorText(String(message)) }],
    isError: true,
  })
}
