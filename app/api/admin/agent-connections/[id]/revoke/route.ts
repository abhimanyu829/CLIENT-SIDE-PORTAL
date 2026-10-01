import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { GatewayError } from "@/lib/agent-gateway/shared/errors"
import { cancelApprovalsForConnection } from "@/lib/agent-gateway/approvals/request-service"
import { TriggerService } from "@/lib/agent-gateway/triggers/service"

/** Idempotent and terminal: revoking an already-revoked connection succeeds with no error. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  try {
    await getAgentConnectionService().revoke(id, admin.userId)
    // Phase 7: retire live approvals. Best-effort — a revoked connection
    // can never execute again (identity is re-checked on every call).
    await cancelApprovalsForConnection(id, "CONNECTION_REVOKED").catch(() => 0)
    // Phase 9: retire the connection's triggers. Best-effort as well — every
    // firing re-checks the connection and refuses (and revokes) on its own.
    await new TriggerService().revokeForConnection(id, admin.userId).catch(() => 0)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ success: false, error: "Unable to revoke connection" }, { status: 500 })
  }
}
