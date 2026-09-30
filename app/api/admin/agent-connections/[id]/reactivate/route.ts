import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { GatewayError } from "@/lib/agent-gateway/shared/errors"
import { cancelApprovalsForConnection } from "@/lib/agent-gateway/approvals/request-service"

/**
 * Requires an authorized human admin — per Phase 2 spec §21, "the AI
 * cannot reactivate itself." This route is unreachable by the machine
 * credential itself: it is gated by requireSuperAdmin(), the EXISTING
 * human-session authorization path, entirely separate from the gateway's
 * machine-authentication pipeline.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  try {
    // Phase 7: approvals granted before the suspension must never survive
    // into the new lifecycle. Done BEFORE reactivation so a failure here
    // leaves the connection suspended (fail closed).
    await cancelApprovalsForConnection(id, "CONNECTION_REACTIVATED")
    await getAgentConnectionService().reactivate(id, admin.userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ success: false, error: "Unable to reactivate connection" }, { status: 500 })
  }
}
