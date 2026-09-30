import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { GatewayError } from "@/lib/agent-gateway/shared/errors"

/** Idempotent and terminal: revoking an already-revoked connection succeeds with no error. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  try {
    await getAgentConnectionService().revoke(id, admin.userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ success: false, error: "Unable to revoke connection" }, { status: 500 })
  }
}
