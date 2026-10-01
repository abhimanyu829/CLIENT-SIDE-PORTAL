/**
 * app/api/agent-gateway/health/route.ts
 *
 * Public health/readiness endpoint for the gateway. Deliberately NOT
 * routed through the authenticated pipeline (transport/http-boundary.ts)
 * — health checks must be reachable without a credential, per standard
 * practice, and the payload itself is designed to leak nothing sensitive
 * regardless (see lib/agent-gateway/health.ts).
 */
import { NextResponse } from "next/server"
import { getGatewayHealth } from "@/lib/agent-gateway/health"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const payload = await getGatewayHealth()
  const status = payload.status === "ok" || payload.gateway === "disabled" ? 200 : 503
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } })
}
