/**
 * lib/agent-gateway/recovery/store.ts — the ONLY reader/writer of AgentRecovery.
 * Every state change is one conditional updateMany on (id, status, version).
 */
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import type { RecoveryClass } from "./spec"

export type RecoveryStatus = "REQUESTED" | "EXECUTING" | "APPROVAL_REQUIRED" | "SUCCEEDED" | "FAILED" | "MANUAL_RECOVERY_REQUIRED"

export interface AgentRecoveryRow {
  id: string
  publicRef: string
  sourceEventId: string
  connectionId: string
  ownerId: string
  capabilityId: string
  capabilityVersion: number
  recoveryClass: RecoveryClass
  recoveryCapabilityId: string | null
  recoveryCapabilityVersion: number | null
  status: RecoveryStatus
  attempts: number
  version: number
  reason: string | null
  recommendation: string | null
  residualEffects: string | null
  approvalRef: string | null
  errorCode: string | null
  requestedById: string
  requestedAt: Date
  completedAt: Date | null
}

export const RECOVERY_REF_PATTERN = /^rcv_[0-9a-f]{32}$/

export function newRecoveryRef(): string {
  return `rcv_${randomBytes(16).toString("hex")}`
}

export async function findRecoveryBySourceEvent(sourceEventId: string): Promise<AgentRecoveryRow | null> {
  return ((await db.agentRecovery.findUnique({ where: { sourceEventId } })) as AgentRecoveryRow | null) ?? null
}

export async function findRecoveryByRef(publicRef: string): Promise<AgentRecoveryRow | null> {
  if (!RECOVERY_REF_PATTERN.test(publicRef)) return null
  return ((await db.agentRecovery.findUnique({ where: { publicRef } })) as AgentRecoveryRow | null) ?? null
}

export async function createRecovery(data: Omit<AgentRecoveryRow, "id" | "attempts" | "version" | "requestedAt" | "approvalRef" | "errorCode" | "completedAt"> & { completedAt?: Date | null }): Promise<AgentRecoveryRow> {
  return (await db.agentRecovery.create({ data: { ...data, attempts: 0, version: 1 } })) as AgentRecoveryRow
}

/** Conditional transition. True only when this caller made the change. */
export async function transitionRecovery(
  id: string,
  expected: { status: RecoveryStatus | RecoveryStatus[]; version: number },
  data: Partial<Pick<AgentRecoveryRow, "status" | "approvalRef" | "errorCode" | "completedAt" | "recommendation">> & { attempts?: { increment: number } }
): Promise<boolean> {
  const statuses = Array.isArray(expected.status) ? expected.status : [expected.status]
  const result = await db.agentRecovery.updateMany({
    where: { id, status: { in: statuses }, version: expected.version },
    data: { ...data, version: { increment: 1 } },
  })
  return result.count === 1
}

export async function listRecoveries(skip: number, take: number): Promise<{ rows: AgentRecoveryRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    db.agentRecovery.findMany({ orderBy: { requestedAt: "desc" }, skip, take }),
    db.agentRecovery.count(),
  ])
  return { rows: rows as AgentRecoveryRow[], total }
}
