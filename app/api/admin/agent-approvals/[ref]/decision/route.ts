/**
 * app/api/admin/agent-approvals/[ref]/decision/route.ts
 *
 * Phase 7 — the human decision. APPROVE requires: SUPER_ADMIN session, the
 * exact binding digest the human was shown, and the SMS step-up code.
 * REJECT requires the session and the binding digest only.
 * The approver identity always comes from the server-resolved session —
 * never from the request body.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireHumanApprover } from "@/lib/agent-gateway/approvals/human-session"
import { decideApproval } from "@/lib/agent-gateway/approvals/decision-service"
import { approvalErrorResponse, isValidPublicRef } from "@/lib/agent-gateway/approvals/http"
import { ApprovalError } from "@/lib/agent-gateway/approvals/errors"

const decisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    confirmedBindingDigest: z.string().regex(/^[0-9a-f]{64}$/),
    stepUpCode: z.string().regex(/^\d{6}$/).optional(),
    reasonCode: z.string().max(64).regex(/^[A-Z0-9_]+$/).optional(),
  })
  .strict()

export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  try {
    const approver = await requireHumanApprover(req)
    const { ref } = await params
    if (!isValidPublicRef(ref)) throw new ApprovalError("APPROVAL_NOT_FOUND", "Approval request not found.")
    const parsed = decisionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, code: "INVALID_INPUT", error: "Invalid approval decision payload." }, { status: 400 })
    }
    const result = await decideApproval({ publicRef: ref, approver, ...parsed.data })
    return NextResponse.json({ success: true, status: result.status })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}
