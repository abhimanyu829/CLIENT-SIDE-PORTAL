/**
 * app/api/agent-gateway/mcp/route.ts
 *
 * Phase 5 — the dedicated remote MCP endpoint. Reserved by Phase 1's
 * `app/api/agent-gateway/route.ts` top comment as the intended Phase 5
 * mount point; implemented here, not invented as a new path.
 *
 * This route does NOT expose the entire Next.js application as MCP, does
 * NOT expose every API route, and does NOT auto-convert routes into
 * tools — only explicitly Phase-3-registered, `AGENT_AVAILABLE` /
 * `ACTIVE` capabilities become MCP tools (see
 * lib/agent-gateway/mcp/tool-projection.ts).
 *
 * GET/DELETE are handled for MCP protocol correctness (the Streamable
 * HTTP spec defines GET for the SSE stream and DELETE for session
 * termination) — the underlying transport itself rejects GET/DELETE
 * appropriately in stateless mode; this route does not special-case
 * that behavior, it delegates to the same `handleMcpRequest()` pipeline
 * for every method so Phase 1's auth/rate-limiting always runs first
 * regardless of method.
 */
import { handleMcpRequest } from "@/lib/agent-gateway/mcp/route-handler"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}
