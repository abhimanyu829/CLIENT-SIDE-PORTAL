/**
 * app/api/admin/agent-approvals/[ref]/cancel/route.ts
 *
 * Phase 7 — a human cancels a live (PENDING or APPROVED-but-unconsumed)
 * approval. Cancelling can only reduce what the agent may do.
 */
import { NextResponse } from "next/server"
import { requireHumanApprover } from "@/lib/agent-gateway/approvals/human-session"
import { cancelApprovalByHuman } from "@/lib/agent-gateway/approvals/decision-service"
import { approvalErrorResponse, isValidPublicRef } from "@/lib/agent-gateway/approvals/http"
import { ApprovalError } from "@/lib/agent-gateway/approvals/errors"

export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  try {
    const approver = await requireHumanApprover(req)
    const { ref } = await params
    if (!isValidPublicRef(ref)) throw new ApprovalError("APPROVAL_NOT_FOUND", "Approval request not found.")
    await cancelApprovalByHuman(ref, approver)
    return NextResponse.json({ success: true, status: "CANCELLED" })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}
