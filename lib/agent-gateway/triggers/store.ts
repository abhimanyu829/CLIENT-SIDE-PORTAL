/**
 * lib/agent-gateway/triggers/store.ts
 *
 * The only module that reads or writes AgentTrigger / AgentTriggerRun rows.
 * Human edits are optimistic (WHERE version = expected); runtime changes are
 * conditional on status / schedule position; concurrency slots are unique
 * columns, so every race is decided by the database.
 */
import { randomBytes } from "crypto"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type { AgentTriggerRow, AgentTriggerRunRow, TriggerRunStatus, TriggerStatus, TriggerType } from "./types"

export function generateTriggerRef(): string {
  return `trg_${randomBytes(16).toString("hex")}`
}

export function generateRunRef(): string {
  return `trr_${randomBytes(16).toString("hex")}`
}

export const TRIGGER_REF_PATTERN = /^trg_[0-9a-f]{32}$/

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

// ── Triggers ──────────────────────────────────────────────────────────────

export async function createTriggerRow(data: Prisma.AgentTriggerUncheckedCreateInput): Promise<AgentTriggerRow> {
  return (await db.agentTrigger.create({ data })) as AgentTriggerRow
}

export async function findTriggerById(id: string): Promise<AgentTriggerRow | null> {
  return ((await db.agentTrigger.findUnique({ where: { id } })) as AgentTriggerRow | null) ?? null
}

export async function findTriggerByRef(publicRef: string): Promise<AgentTriggerRow | null> {
  return ((await db.agentTrigger.findUnique({ where: { publicRef } })) as AgentTriggerRow | null) ?? null
}

/** Optimistic update of a human edit. Returns false on a version or status mismatch. */
export async function updateTriggerVersioned(
  id: string,
  expectedVersion: number,
  allowedStatuses: readonly TriggerStatus[],
  data: Prisma.AgentTriggerUncheckedUpdateManyInput
): Promise<boolean> {
  const result = await db.agentTrigger.updateMany({
    where: { id, version: expectedVersion, status: { in: [...allowedStatuses] } },
    data: { ...data, version: expectedVersion + 1 },
  })
  return result.count === 1
}

/** Runtime transition (no version check; bumps the version so a concurrent human edit sees a conflict). */
export async function transitionTriggerStatus(id: string, from: readonly TriggerStatus[], to: TriggerStatus, data: Prisma.AgentTriggerUncheckedUpdateManyInput = {}): Promise<boolean> {
  const result = await db.agentTrigger.updateMany({
    where: { id, status: { in: [...from] } },
    data: { ...data, status: to, version: { increment: 1 } },
  })
  return result.count === 1
}

/** Claims one schedule occurrence: succeeds only for the caller that still sees the same nextRunAt. */
export async function advanceSchedule(id: string, expectedNextRunAt: Date, nextRunAt: Date | null, scheduledFor: Date): Promise<boolean> {
  const result = await db.agentTrigger.updateMany({
    where: { id, status: "ACTIVE", nextRunAt: expectedNextRunAt },
    data: { nextRunAt, lastScheduledFor: scheduledFor },
  })
  return result.count === 1
}

export async function listDueSchedules(now: Date, take: number): Promise<AgentTriggerRow[]> {
  return (await db.agentTrigger.findMany({
    where: { type: "SCHEDULE", status: "ACTIVE", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take,
  })) as AgentTriggerRow[]
}

export async function listActiveEventTriggers(eventType: string, take = 200): Promise<AgentTriggerRow[]> {
  return (await db.agentTrigger.findMany({ where: { type: "EVENT", status: "ACTIVE", eventType }, orderBy: { createdAt: "asc" }, take })) as AgentTriggerRow[]
}

export async function listExpiredTriggers(now: Date, take: number): Promise<AgentTriggerRow[]> {
  return (await db.agentTrigger.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] }, expiresAt: { lte: now } }, orderBy: { createdAt: "asc" }, take })) as AgentTriggerRow[]
}

export type TriggerOutcomeKind = "SUCCESS" | "FAILURE" | "NEUTRAL"

/** Bookkeeping only (no version bump: it is not a configuration change). */
export async function recordTriggerOutcome(id: string, kind: TriggerOutcomeKind, now: Date): Promise<void> {
  const data: Prisma.AgentTriggerUncheckedUpdateManyInput =
    kind === "SUCCESS"
      ? { lastTriggeredAt: now, lastSuccessAt: now }
      : kind === "FAILURE"
        ? { lastTriggeredAt: now, lastFailureAt: now, failureCount: { increment: 1 } }
        : { lastTriggeredAt: now }
  await db.agentTrigger.updateMany({ where: { id }, data })
}

// ── Runs ──────────────────────────────────────────────────────────────────

export interface CreateRunData {
  triggerId: string
  deliveryKey: string
  source: TriggerType
  status: TriggerRunStatus
  resourceId?: string | null
  scheduledFor?: Date | null
  bodyDigest?: string | null
  errorCode?: string | null
  completedAt?: Date | null
}

/** Throws P2002 when this delivery was already recorded (dedup). */
export async function createRun(data: CreateRunData): Promise<AgentTriggerRunRow> {
  return (await db.agentTriggerRun.create({ data: { ...data, publicRef: generateRunRef() } })) as AgentTriggerRunRow
}

export async function findRunByDelivery(triggerId: string, deliveryKey: string): Promise<AgentTriggerRunRow | null> {
  return ((await db.agentTriggerRun.findUnique({ where: { triggerId_deliveryKey: { triggerId, deliveryKey } } })) as AgentTriggerRunRow | null) ?? null
}

export async function findRunById(id: string): Promise<AgentTriggerRunRow | null> {
  return ((await db.agentTriggerRun.findUnique({ where: { id } })) as AgentTriggerRunRow | null) ?? null
}

export async function finishRun(id: string, status: TriggerRunStatus, now: Date, data: { taskId?: string | null; errorCode?: string | null; releaseSlot?: boolean } = {}): Promise<void> {
  await db.agentTriggerRun.updateMany({
    where: { id },
    data: {
      status,
      completedAt: now,
      ...(data.taskId !== undefined ? { taskId: data.taskId } : {}),
      ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
      ...(data.releaseSlot ? { activeSlotKey: null, pendingSlotKey: null, activeSince: null } : {}),
    },
  })
}

/** Transient task-creation failures a re-delivery may retry (same run, same task idempotency key). */
export const REARMABLE_RUN_ERRORS = ["QUEUE_UNAVAILABLE", "TASK_CREATION_FAILED"] as const

/** Re-opens a run that failed transiently, so a re-delivery retries it instead of being a duplicate. */
export async function rearmRun(runId: string): Promise<boolean> {
  const result = await db.agentTriggerRun.updateMany({
    where: { id: runId, status: "FAILED", errorCode: { in: [...REARMABLE_RUN_ERRORS] } },
    data: { status: "PENDING", errorCode: null, completedAt: null },
  })
  return result.count === 1
}

/** Takes the trigger's single "active" slot for this run. False if another run holds it. */
export async function claimActiveSlot(runId: string, triggerId: string, now: Date): Promise<boolean> {
  try {
    const result = await db.agentTriggerRun.updateMany({ where: { id: runId, activeSlotKey: null }, data: { activeSlotKey: triggerId, activeSince: now } })
    return result.count === 1
  } catch (err) {
    if (isUniqueViolation(err)) return false
    throw err
  }
}

/** Takes the trigger's single "pending" slot (QUEUE_ONE). False if one is already pending. */
export async function claimPendingSlot(runId: string, triggerId: string): Promise<boolean> {
  try {
    const result = await db.agentTriggerRun.updateMany({ where: { id: runId, pendingSlotKey: null }, data: { pendingSlotKey: triggerId } })
    return result.count === 1
  } catch (err) {
    if (isUniqueViolation(err)) return false
    throw err
  }
}

/** Moves a pending run into the active slot in one statement. False if the slot is taken. */
export async function promotePendingRun(runId: string, triggerId: string, now: Date): Promise<boolean> {
  try {
    const result = await db.agentTriggerRun.updateMany({
      where: { id: runId, pendingSlotKey: triggerId },
      data: { pendingSlotKey: null, activeSlotKey: triggerId, activeSince: now },
    })
    return result.count === 1
  } catch (err) {
    if (isUniqueViolation(err)) return false
    throw err
  }
}

export async function findActiveSlotHolder(triggerId: string): Promise<AgentTriggerRunRow | null> {
  return ((await db.agentTriggerRun.findUnique({ where: { activeSlotKey: triggerId } })) as AgentTriggerRunRow | null) ?? null
}

export async function releaseActiveSlot(runId: string, triggerId: string): Promise<boolean> {
  const result = await db.agentTriggerRun.updateMany({ where: { id: runId, activeSlotKey: triggerId }, data: { activeSlotKey: null, activeSince: null } })
  return result.count === 1
}

/** Drops a waiting (QUEUE_ONE) run and frees its pending slot. */
export async function dropPendingRun(runId: string, triggerId: string, now: Date, errorCode: string): Promise<boolean> {
  const result = await db.agentTriggerRun.updateMany({
    where: { id: runId, pendingSlotKey: triggerId, status: "PENDING" },
    data: { pendingSlotKey: null, status: "DROPPED", errorCode, completedAt: now },
  })
  return result.count === 1
}

export async function listPendingRuns(take: number): Promise<AgentTriggerRunRow[]> {
  return (await db.agentTriggerRun.findMany({ where: { NOT: { pendingSlotKey: null } }, orderBy: { receivedAt: "asc" }, take })) as AgentTriggerRunRow[]
}

export async function listRunsForTrigger(triggerId: string, take: number, before?: Date): Promise<AgentTriggerRunRow[]> {
  return (await db.agentTriggerRun.findMany({
    where: { triggerId, ...(before ? { receivedAt: { lt: before } } : {}) },
    orderBy: { receivedAt: "desc" },
    take,
  })) as AgentTriggerRunRow[]
}
