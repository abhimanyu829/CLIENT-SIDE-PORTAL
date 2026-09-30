/**
 * lib/agent-gateway/approvals/query-service.ts
 *
 * Read-only views of approval requests for the human approval UI. Only
 * display-safe fields are selected: never step-up code hashes, never the
 * raw agent input (only the redacted displaySummary), never the internal id.
 */
import { db } from "@/lib/db"
import { isExpired } from "./expiration"

const VIEW_SELECT = {
  publicRef: true,
  status: true,
  connectionId: true,
  agentId: true,
  ownerId: true,
  teamId: true,
  capabilityId: true,
  capabilityVersion: true,
  resourceType: true,
  resourceId: true,
  environment: true,
  riskTier: true,
  autonomyLevel: true,
  bindingDigest: true,
  displaySummary: true,
  requiredApproverScope: true,
  approvalMethod: true,
  createdAt: true,
  expiresAt: true,
  approvedAt: true,
  rejectedAt: true,
  consumedAt: true,
  cancelledAt: true,
  expiredAt: true,
} as const

export type ApprovalView = Awaited<ReturnType<typeof getApprovalView>>

export async function getApprovalView(publicRef: string, now: Date = new Date()) {
  const row = await db.agentApprovalRequest.findUnique({ where: { publicRef }, select: VIEW_SELECT })
  if (!row) return null
  // Display-time expiry: a live row past its deadline is shown as EXPIRED
  // (the state transition itself happens on the next gate/decision touch).
  const effectiveStatus = (row.status === "PENDING" || row.status === "APPROVED") && isExpired(row.expiresAt, now) ? "EXPIRED" : row.status
  return { ...row, effectiveStatus }
}

export async function listPendingApprovals(now: Date = new Date(), take = 100) {
  return db.agentApprovalRequest.findMany({
    where: { status: "PENDING", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      publicRef: true,
      capabilityId: true,
      environment: true,
      riskTier: true,
      connectionId: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
      expiresAt: true,
    },
  })
}
