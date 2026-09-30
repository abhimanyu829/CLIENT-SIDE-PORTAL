import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { GatewayError } from "@/lib/agent-gateway/shared/errors"
import { cancelApprovalsForConnection } from "@/lib/agent-gateway/approvals/request-service"

/** Idempotent: suspending an already-suspended connection succeeds with no error. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  try {
    await getAgentConnectionService().suspend(id, admin.userId)
    // Phase 7: retire live approvals. Best-effort here — a suspended
    // connection cannot execute, and reactivation cancels again (mandatory).
    await cancelApprovalsForConnection(id, "CONNECTION_SUSPENDED").catch(() => 0)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ success: false, error: "Unable to suspend connection" }, { status: 500 })
  }
}
