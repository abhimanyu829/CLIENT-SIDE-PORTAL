/**
 * app/api/agent-gateway/route.ts
 *
 * External entry point for the Abhibhi Agent Gateway (Phase 1).
 *
 * Reserved path shape for Phase 5's MCP Streamable HTTP mount point is
 * `/api/agent-gateway/mcp` (or equivalent) — NOT implemented here. This
 * route only mounts the Phase 1 pipeline (transport/http-boundary.ts),
 * which today always resolves to NOT_FOUND past authentication+rate
 * limiting, since no capability/route is registered yet.
 *
 * This route is entirely additive — it does not modify, wrap, or sit in
 * front of any existing app/api/** route. proxy.ts's matcher already
 * covers `/api/:path*`, so general rate limiting/Clerk middleware still
 * runs first at the edge exactly as it does for every other API route;
 * this handler adds the gateway-specific pipeline on top for this one
 * path only.
 */
import { handleGatewayRequest } from "@/lib/agent-gateway/transport/http-boundary"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  return handleGatewayRequest(request)
}

export async function GET(request: Request): Promise<Response> {
  return handleGatewayRequest(request)
}
