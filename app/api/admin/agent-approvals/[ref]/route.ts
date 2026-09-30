/**
 * app/api/admin/agent-approvals/[ref]/route.ts
 *
 * Phase 7 — display-safe view of one approval request (redacted summary,
 * binding digest to confirm). Viewing never changes state.
 */
import { NextResponse } from "next/server"
import { requireHumanApprover } from "@/lib/agent-gateway/approvals/human-session"
import { getApprovalView } from "@/lib/agent-gateway/approvals/query-service"
import { approvalErrorResponse, isValidPublicRef } from "@/lib/agent-gateway/approvals/http"
import { ApprovalError } from "@/lib/agent-gateway/approvals/errors"

export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  try {
    await requireHumanApprover(req)
    const { ref } = await params
    if (!isValidPublicRef(ref)) throw new ApprovalError("APPROVAL_NOT_FOUND", "Approval request not found.")
    const approval = await getApprovalView(ref)
    if (!approval) throw new ApprovalError("APPROVAL_NOT_FOUND", "Approval request not found.")
    return NextResponse.json({ success: true, approval })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}
