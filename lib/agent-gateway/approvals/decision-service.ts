/**
 * lib/agent-gateway/approvals/decision-service.ts
 *
 * The HUMAN side of the approval engine: the independent human approval
 * verifier. This module is only ever called from human-authenticated admin
 * routes (Clerk session + requireSuperAdmin()). There is no gateway route,
 * MCP tool or agent capability that reaches it.
 *
 * Why an out-of-band step-up code is required to APPROVE:
 *   An agent driving the desktop through Cua can operate a browser in which
 *   an admin is already signed in. To the backend, a Cua click and a human
 *   click in that session are indistinguishable. A Clerk session + button
 *   press is therefore NOT proof that a human decided. Approval additionally
 *   requires a one-time code sent by SMS (the EXISTING lib/otp.ts generator
 *   and lib/twilio.ts sender) to the approver's VERIFIED phone — a channel
 *   outside the desktop that Cua controls. The code is bound to this request
 *   and this approver, stored only as a hash, valid for 5 minutes, and
 *   limited to 5 attempts.
 *
 * Rejecting needs no step-up: rejection can only make the system safer.
 */
import { createHash } from "crypto"
import { db } from "@/lib/db"
import { generateOtp } from "@/lib/otp"
import { sendSms } from "@/lib/twilio"
import { constantTimeEqual, sha256Hex } from "../shared/crypto"
import { ApprovalError } from "./errors"
import { STEP_UP_TTL_MS, isExpired } from "./expiration"
import { expireApproval } from "./request-service"

import { APPROVAL_METHOD_STEP_UP, APPROVER_SCOPE_SUPER_ADMIN } from "./constants"

export { APPROVAL_METHOD_STEP_UP, APPROVER_SCOPE_SUPER_ADMIN }
const MAX_STEP_UP_ATTEMPTS = 5

/** Server-resolved human approver — built only from a verified admin session. */
export interface HumanApprover {
  userId: string
  role: string
  /** Any stable reference to the human session; it is hashed before storage. */
  sessionReference: string
}

export type StepUpSender = (to: string, body: string) => Promise<boolean>

function hashCode(approvalId: string, approverId: string, code: string): string {
  // Bound to request + approver: a code issued for one request/approver can
  // never validate another.
  return createHash("sha256").update(`abhibhi.approval-step-up.v1\n${approvalId}\n${approverId}\n${code}`).digest("hex")
}

function assertApproverScope(approver: HumanApprover, requiredScope: string): void {
  if (!approver.userId || !approver.sessionReference) {
    throw new ApprovalError("HUMAN_APPROVAL_INVALID", "A verified human session is required.")
  }
  if (requiredScope !== APPROVER_SCOPE_SUPER_ADMIN || approver.role !== APPROVER_SCOPE_SUPER_ADMIN) {
    throw new ApprovalError("HUMAN_APPROVER_UNAUTHORIZED", "You are not authorized to decide this approval.")
  }
}

async function loadForDecision(publicRef: string) {
  const row = await db.agentApprovalRequest.findUnique({ where: { publicRef } })
  if (!row) throw new ApprovalError("APPROVAL_NOT_FOUND", "Approval request not found.")
  return row
}

function assertPending(status: string): void {
  if (status === "PENDING") return
  if (status === "EXPIRED") throw new ApprovalError("APPROVAL_EXPIRED", "This approval request has expired.")
  if (status === "CANCELLED") throw new ApprovalError("APPROVAL_CANCELLED", "This approval request was cancelled.")
  throw new ApprovalError("APPROVAL_ALREADY_DECIDED", "This approval request has already been decided.")
}

/**
 * Issues a fresh out-of-band code to the approver's verified phone. Only the
 * code's hash is stored. Re-issuing replaces the previous code.
 */
export async function startApprovalStepUp(
  publicRef: string,
  approver: HumanApprover,
  now: Date = new Date(),
  sender: StepUpSender = sendSms
): Promise<{ deliveredTo: string; expiresAt: Date }> {
  const request = await loadForDecision(publicRef)
  assertApproverScope(approver, request.requiredApproverScope)
  assertPending(request.status)
  if (isExpired(request.expiresAt, now)) {
    await expireApproval(request.id, now)
    throw new ApprovalError("APPROVAL_EXPIRED", "This approval request has expired.")
  }

  const user = await db.user.findUnique({ where: { id: approver.userId }, select: { phone: true, phoneVerified: true } })
  if (!user?.phone || !user.phoneVerified) {
    throw new ApprovalError("STEP_UP_DELIVERY_FAILED", "A verified phone number is required on your account to approve agent operations.")
  }

  const code = generateOtp()
  const expiresAt = new Date(Math.min(now.getTime() + STEP_UP_TTL_MS, request.expiresAt.getTime()))
  const updated = await db.agentApprovalRequest.updateMany({
    where: { id: request.id, status: "PENDING" },
    data: {
      stepUpCodeHash: hashCode(request.id, approver.userId, code),
      stepUpApproverId: approver.userId,
      stepUpExpiresAt: expiresAt,
      stepUpAttempts: 0,
    },
  })
  if (updated.count !== 1) throw new ApprovalError("APPROVAL_ALREADY_DECIDED", "This approval request has already been decided.")

  const delivered = await sender(
    user.phone,
    `Abhibhi agent approval code: ${code}. Approves "${request.capabilityId}" (${request.environment}). Expires in 5 minutes. Never share this code.`
  )
  if (!delivered) {
    await db.agentApprovalRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { stepUpCodeHash: null } })
    throw new ApprovalError("STEP_UP_DELIVERY_FAILED", "The approval code could not be delivered.")
  }

  const masked = user.phone.length > 4 ? `***${user.phone.slice(-4)}` : "***"
  return { deliveredTo: masked, expiresAt }
}

export interface DecideApprovalInput {
  publicRef: string
  decision: "APPROVE" | "REJECT"
  approver: HumanApprover
  /** The binding digest shown to the human — must match the stored one exactly. */
  confirmedBindingDigest: string
  /** Required for APPROVE. */
  stepUpCode?: string
  reasonCode?: string
}

/**
 * Validates the human decision and performs PENDING -> APPROVED/REJECTED as
 * one atomic step, recording exactly one AgentApprovalDecision.
 */
export async function decideApproval(input: DecideApprovalInput, now: Date = new Date()): Promise<{ status: "APPROVED" | "REJECTED" }> {
  const request = await loadForDecision(input.publicRef)
  assertApproverScope(input.approver, request.requiredApproverScope)
  assertPending(request.status)

  if (isExpired(request.expiresAt, now)) {
    await expireApproval(request.id, now)
    throw new ApprovalError("APPROVAL_EXPIRED", "This approval request has expired.")
  }
  if (!constantTimeEqual(input.confirmedBindingDigest, request.bindingDigest)) {
    throw new ApprovalError("HUMAN_APPROVAL_INVALID", "The confirmed operation does not match this approval request.")
  }

  if (input.decision === "APPROVE") {
    if (!input.stepUpCode || !/^\d{6}$/.test(input.stepUpCode)) {
      throw new ApprovalError("STEP_UP_REQUIRED", "Enter the approval code sent to your verified phone.")
    }
    if (!request.stepUpCodeHash || request.stepUpApproverId !== input.approver.userId || !request.stepUpExpiresAt) {
      throw new ApprovalError("STEP_UP_REQUIRED", "Request an approval code first.")
    }
    if (request.stepUpAttempts >= MAX_STEP_UP_ATTEMPTS) {
      throw new ApprovalError("STEP_UP_LOCKED", "Too many incorrect codes. Request a new code.")
    }
    if (isExpired(request.stepUpExpiresAt, now)) {
      throw new ApprovalError("STEP_UP_INVALID", "The approval code has expired. Request a new code.")
    }
    const presented = hashCode(request.id, input.approver.userId, input.stepUpCode)
    if (!constantTimeEqual(presented, request.stepUpCodeHash)) {
      await db.agentApprovalRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: { stepUpAttempts: { increment: 1 } },
      })
      throw new ApprovalError("STEP_UP_INVALID", "The approval code is incorrect.")
    }
  }

  const approving = input.decision === "APPROVE"
  const outcome = await db.$transaction(async (tx) => {
    const moved = await tx.agentApprovalRequest.updateMany({
      where: {
        id: request.id,
        status: "PENDING",
        expiresAt: { gt: now },
        bindingDigest: request.bindingDigest,
        // An approval can only succeed with the exact code hash just
        // verified — a concurrent re-issue invalidates this attempt.
        ...(approving ? { stepUpCodeHash: request.stepUpCodeHash } : {}),
      },
      data: approving
        ? { status: "APPROVED", approvedAt: now, stepUpCodeHash: null, stepUpExpiresAt: null }
        : { status: "REJECTED", rejectedAt: now, stepUpCodeHash: null, stepUpExpiresAt: null, activeBindingKey: null },
    })
    if (moved.count !== 1) return null

    await tx.agentApprovalDecision.create({
      data: {
        approvalRequestId: request.id,
        decision: approving ? "APPROVED" : "REJECTED",
        approverUserId: input.approver.userId,
        approverRole: input.approver.role,
        approverSessionRef: sha256Hex(`abhibhi.approver-session.v1\n${input.approver.sessionReference}`),
        approvalMethod: approving ? APPROVAL_METHOD_STEP_UP : "HUMAN_SESSION",
        scopeDigest: request.bindingDigest,
        reasonCode: input.reasonCode ?? null,
      },
    })
    return approving ? ("APPROVED" as const) : ("REJECTED" as const)
  })

  if (!outcome) {
    // Lost a race (cancelled/expired/decided concurrently). Re-read for a precise answer.
    const fresh = await db.agentApprovalRequest.findUnique({ where: { id: request.id }, select: { status: true } })
    assertPending(fresh?.status ?? "CANCELLED")
    throw new ApprovalError("APPROVAL_ALREADY_DECIDED", "This approval request changed while you were deciding. Reload and try again.")
  }
  return { status: outcome }
}

/** A human cancels a live request (PENDING or APPROVED-but-unconsumed). */
export async function cancelApprovalByHuman(publicRef: string, approver: HumanApprover, now: Date = new Date()): Promise<void> {
  const request = await loadForDecision(publicRef)
  assertApproverScope(approver, request.requiredApproverScope)
  const result = await db.agentApprovalRequest.updateMany({
    where: { id: request.id, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: "HUMAN_CANCELLED", activeBindingKey: null, stepUpCodeHash: null },
  })
  if (result.count === 1) return
  // Nothing was cancelled — report the real terminal state, never silent success.
  const fresh = await db.agentApprovalRequest.findUnique({ where: { id: request.id }, select: { status: true } })
  const status = fresh?.status ?? "CANCELLED"
  if (status === "EXPIRED") throw new ApprovalError("APPROVAL_EXPIRED", "This approval request has expired.")
  if (status === "CANCELLED") throw new ApprovalError("APPROVAL_CANCELLED", "This approval request was already cancelled.")
  if (status === "CONSUMED") throw new ApprovalError("APPROVAL_ALREADY_CONSUMED", "This approval was already used.")
  throw new ApprovalError("APPROVAL_ALREADY_DECIDED", "This approval request has already been decided.")
}
