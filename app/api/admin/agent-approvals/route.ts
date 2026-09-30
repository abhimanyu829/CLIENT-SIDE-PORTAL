/**
 * app/api/admin/agent-approvals/route.ts
 *
 * Phase 7 — lists pending agent approval requests for human review.
 * SUPER_ADMIN only (existing requireSuperAdmin via requireHumanApprover);
 * requests carrying an agent credential are refused.
 */
import { NextResponse } from "next/server"
import { requireHumanApprover } from "@/lib/agent-gateway/approvals/human-session"
import { listPendingApprovals } from "@/lib/agent-gateway/approvals/query-service"
import { approvalErrorResponse } from "@/lib/agent-gateway/approvals/http"

export async function GET(req: Request) {
  try {
    await requireHumanApprover(req)
    const approvals = await listPendingApprovals()
    return NextResponse.json({ success: true, approvals })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}
