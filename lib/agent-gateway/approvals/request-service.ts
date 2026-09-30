/**
 * lib/agent-gateway/approvals/request-service.ts
 *
 * The ONLY place AgentApprovalRequest rows are created or moved through their
 * lifecycle by the gateway side (human decisions live in decision-service.ts).
 *
 * Atomicity model (no new distributed-state system):
 *   - Every transition is a conditional `updateMany({ where: { id, status: <from> } })`
 *     and succeeds only if `count === 1`. Postgres row locking makes this a
 *     compare-and-set, so of N concurrent writers exactly one wins.
 *   - `activeBindingKey` is UNIQUE and set only while a request is PENDING or
 *     APPROVED. N concurrent identical agent requests therefore collapse
 *     onto ONE live approval (the losers hit P2002 and re-read the winner).
 *   - Consumption is a single conditional update that also re-checks the
 *     binding digest and expiry, so one APPROVED approval can be consumed at
 *     most once, only for its exact operation, and never after expiry.
 */
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { activeBindingKey } from "./binding"
import type { ApprovalStatus } from "./state-machine"
import { isExpired } from "./expiration"
import type { AutonomyLevel } from "../autonomy/types"

export interface ApprovalRequestRow {
  id: string
  publicRef: string
  connectionId: string
  capabilityId: string
  capabilityVersion: number
  resourceType: string | null
  resourceId: string | null
  environment: string
  riskTier: string
  inputDigest: string
  bindingDigest: string
  status: ApprovalStatus
  expiresAt: Date
  ownerId: string
  teamId: string | null
  createdAt: Date
}

export interface CreateApprovalRequestInput {
  requestId: string
  connectionId: string
  agentId: string | null
  ownerId: string
  teamId: string | null
  capabilityId: string
  capabilityVersion: number
  resourceType: string | null
  resourceId: string | null
  environment: string
  riskTier: string
  autonomyLevel: AutonomyLevel
  autonomyPolicyVersion: number | null
  authorizationPolicyRef: string
  inputDigest: string
  bindingDigest: string
  requiredApproverScope: string
  approvalMethod: string
  displaySummary: Record<string, unknown>
  expiresAt: Date
}

const ROW_SELECT = {
  id: true,
  publicRef: true,
  connectionId: true,
  capabilityId: true,
  capabilityVersion: true,
  resourceType: true,
  resourceId: true,
  environment: true,
  riskTier: true,
  inputDigest: true,
  bindingDigest: true,
  status: true,
  expiresAt: true,
  ownerId: true,
  teamId: true,
  createdAt: true,
} as const

/** Unpredictable, display-safe reference — never the DB id, never sequential. */
export function generatePublicRef(): string {
  return `apr_${randomBytes(16).toString("hex")}`
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

export async function findLiveApprovalByBinding(connectionId: string, bindingDigest: string): Promise<ApprovalRequestRow | null> {
  const row = await db.agentApprovalRequest.findUnique({
    where: { activeBindingKey: activeBindingKey(connectionId, bindingDigest) },
    select: ROW_SELECT,
  })
  return (row as ApprovalRequestRow | null) ?? null
}

/**
 * Atomically moves a live (PENDING/APPROVED) request to EXPIRED and releases
 * its binding key. Returns true if THIS call performed the transition.
 */
export async function expireApproval(id: string, now: Date): Promise<boolean> {
  const result = await db.agentApprovalRequest.updateMany({
    where: { id, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "EXPIRED", expiredAt: now, activeBindingKey: null, stepUpCodeHash: null },
  })
  return result.count === 1
}

/**
 * Returns the live request for this exact operation, creating one if none
 * exists. Idempotent: repeated identical requests resolve to the same row.
 * An expired live row is retired first and a fresh request created.
 */
export async function findOrCreateApprovalRequest(
  input: CreateApprovalRequestInput,
  now: Date
): Promise<{ request: ApprovalRequestRow; created: boolean }> {
  const existing = await findLiveApprovalByBinding(input.connectionId, input.bindingDigest)
  if (existing) {
    if (!isExpired(existing.expiresAt, now)) return { request: existing, created: false }
    await expireApproval(existing.id, now)
  }

  try {
    const created = await db.agentApprovalRequest.create({
      data: {
        ...input,
        displaySummary: input.displaySummary as object,
        publicRef: generatePublicRef(),
        activeBindingKey: activeBindingKey(input.connectionId, input.bindingDigest),
        status: "PENDING",
      },
      select: ROW_SELECT,
    })
    return { request: created as ApprovalRequestRow, created: true }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    // A concurrent identical request won the race — return the winner.
    const winner = await findLiveApprovalByBinding(input.connectionId, input.bindingDigest)
    if (!winner) throw err
    return { request: winner, created: false }
  }
}

/**
 * Finds a live APPROVED/PENDING request for the same connection + capability
 * + resource whose binding differs from the live request's binding. Used to
 * report APPROVAL_BINDING_MISMATCH / APPROVAL_POLICY_CHANGED precisely.
 */
export async function findSiblingApproval(
  connectionId: string,
  capabilityId: string,
  resourceId: string | null,
  excludeBindingDigest: string
): Promise<ApprovalRequestRow | null> {
  const row = await db.agentApprovalRequest.findFirst({
    where: {
      connectionId,
      capabilityId,
      resourceId,
      status: { in: ["APPROVED", "PENDING"] },
      NOT: { bindingDigest: excludeBindingDigest },
    },
    orderBy: { createdAt: "desc" },
    select: ROW_SELECT,
  })
  return (row as ApprovalRequestRow | null) ?? null
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; code: "APPROVAL_NOT_FOUND" | "APPROVAL_EXPIRED" | "APPROVAL_REJECTED" | "APPROVAL_CANCELLED" | "APPROVAL_ALREADY_CONSUMED" | "APPROVAL_BINDING_MISMATCH" | "APPROVAL_REQUIRED" }

/**
 * Single-use, binding-checked, expiry-checked consumption. The WHERE clause
 * carries every condition, so the check and the state change are one atomic
 * step — two concurrent consumers can never both succeed.
 */
export async function consumeApproval(id: string, liveBindingDigest: string, now: Date): Promise<ConsumeResult> {
  const result = await db.agentApprovalRequest.updateMany({
    where: { id, status: "APPROVED", bindingDigest: liveBindingDigest, expiresAt: { gt: now } },
    data: { status: "CONSUMED", consumedAt: now, activeBindingKey: null },
  })
  if (result.count === 1) return { ok: true }

  // Lost or invalid — explain precisely without changing anything else.
  const row = await db.agentApprovalRequest.findUnique({ where: { id }, select: { status: true, bindingDigest: true, expiresAt: true } })
  if (!row) return { ok: false, code: "APPROVAL_NOT_FOUND" }
  if (row.bindingDigest !== liveBindingDigest) return { ok: false, code: "APPROVAL_BINDING_MISMATCH" }
  switch (row.status) {
    case "CONSUMED":
      return { ok: false, code: "APPROVAL_ALREADY_CONSUMED" }
    case "REJECTED":
      return { ok: false, code: "APPROVAL_REJECTED" }
    case "CANCELLED":
      return { ok: false, code: "APPROVAL_CANCELLED" }
    case "EXPIRED":
      return { ok: false, code: "APPROVAL_EXPIRED" }
    case "PENDING":
      return { ok: false, code: "APPROVAL_REQUIRED" }
    default:
      if (isExpired(row.expiresAt, now)) {
        await expireApproval(id, now)
        return { ok: false, code: "APPROVAL_EXPIRED" }
      }
      return { ok: false, code: "APPROVAL_ALREADY_CONSUMED" }
  }
}

/**
 * The most recent REJECTED request for this exact operation whose validity
 * window has not yet passed. While it exists, an identical retry is answered
 * with APPROVAL_REJECTED instead of silently opening a new request.
 */
export async function findRecentRejection(connectionId: string, bindingDigest: string, now: Date): Promise<ApprovalRequestRow | null> {
  const row = await db.agentApprovalRequest.findFirst({
    where: { connectionId, bindingDigest, status: "REJECTED", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: ROW_SELECT,
  })
  return (row as ApprovalRequestRow | null) ?? null
}

/** Atomically cancels one live request. Returns true if THIS call cancelled it. */
export async function cancelApproval(id: string, reason: string, now: Date): Promise<boolean> {
  const result = await db.agentApprovalRequest.updateMany({
    where: { id, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason, activeBindingKey: null, stepUpCodeHash: null },
  })
  return result.count === 1
}

/**
 * Cancels every live request for a connection — called when the connection
 * is suspended or revoked so a later reactivation can never resurrect an
 * approval granted under the previous lifecycle.
 */
export async function cancelApprovalsForConnection(connectionId: string, reason: string, now: Date = new Date()): Promise<number> {
  const result = await db.agentApprovalRequest.updateMany({
    where: { connectionId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason, activeBindingKey: null, stepUpCodeHash: null },
  })
  return result.count
}
