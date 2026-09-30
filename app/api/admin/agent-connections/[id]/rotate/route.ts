import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { GatewayError } from "@/lib/agent-gateway/shared/errors"

/**
 * Returns the new credential EXACTLY ONCE — same one-time-display rule as
 * connection creation (Phase 2 spec §9/§19). Not idempotent (see
 * connection-service.ts's rotateCredential docstring for the explicit
 * rationale) — every call produces a genuinely new credential.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  try {
    const result = await getAgentConnectionService().rotateCredential(id, admin.userId)
    return NextResponse.json({ success: true, credential: result.credential })
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ success: false, error: "Unable to rotate credential" }, { status: 500 })
  }
}
