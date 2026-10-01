/**
 * lib/agent-gateway/mcp/content-result.ts
 *
 * Phase 12 — how a successful result is handed to an agent over MCP.
 *
 *   content[0]        the result as JSON text (unchanged from Phase 5)
 *   content[1]        a plain-language content notice when the result can
 *                     contain third-party text, carries injection signals
 *                     or had credentials removed — placed in the content
 *                     so it reaches the model, not only the client
 *   structuredContent the result (validated against the output schema by
 *                     the SDK)
 *   _meta             machine-readable content-trust annotation
 *
 * The notice is guidance for the model; it is not a security control. What
 * an agent may do never depends on it (see phase-12/03-prompt-injection.md).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { contentNotice, contentTrustMeta, type ContentFindings } from "../security/content-guard"

/** Used when no findings are available: assume third-party content, no signals. */
const UNKNOWN_CONTENT: ContentFindings = {
  trust: "THIRD_PARTY_CONTENT",
  redactions: { count: 0, fields: [], kinds: [] },
  injection: { signals: [], fields: [], truncated: false },
}

export function toolSuccessResult(payload: Record<string, unknown>, findings: ContentFindings | undefined | null): CallToolResult {
  const effective = findings ?? UNKNOWN_CONTENT
  const content: CallToolResult["content"] = [{ type: "text", text: JSON.stringify(payload) }]
  const notice = contentNotice(effective)
  if (notice) content.push({ type: "text", text: notice })
  return { content, structuredContent: payload, isError: false, _meta: contentTrustMeta(effective) }
}
