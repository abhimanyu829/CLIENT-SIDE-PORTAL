/**
 * app/api/admin/agent-approvals/[ref]/step-up/route.ts
 *
 * Phase 7 — sends the out-of-band approval code (existing lib/otp.ts +
 * lib/twilio.ts) to the approving SUPER_ADMIN's verified phone. The code is
 * never returned in the response and never logged.
 */
import { NextResponse } from "next/server"
import { requireHumanApprover } from "@/lib/agent-gateway/approvals/human-session"
import { startApprovalStepUp } from "@/lib/agent-gateway/approvals/decision-service"
import { approvalErrorResponse, isValidPublicRef } from "@/lib/agent-gateway/approvals/http"
import { ApprovalError } from "@/lib/agent-gateway/approvals/errors"

export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  try {
    const approver = await requireHumanApprover(req)
    const { ref } = await params
    if (!isValidPublicRef(ref)) throw new ApprovalError("APPROVAL_NOT_FOUND", "Approval request not found.")
    const result = await startApprovalStepUp(ref, approver)
    return NextResponse.json({ success: true, deliveredTo: result.deliveredTo, expiresAt: result.expiresAt.toISOString() })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}
