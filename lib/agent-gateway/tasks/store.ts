/**
 * lib/agent-gateway/tasks/store.ts
 *
 * The ONLY module that reads or writes AgentTask rows. Postgres (via the
 * existing Prisma client) is the source of truth for task state; BullMQ only
 * carries references.
 *
 * Every state change is `transitionTask()`: one conditional `updateMany`
 * whose WHERE carries the expected status(es) and attempt number, so the
 * check and the change are a single statement. Success means count === 1.
 */
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { assertLegalTaskTransition, isTerminalTask } from "./state-machine"
import type { AgentTaskRow, AgentTaskStatus } from "./types"

export type CreateTaskData = Omit<
  Prisma.AgentTaskUncheckedCreateInput,
  "id" | "status" | "attempts" | "retryScheduled" | "createdAt" | "updatedAt"
>

export async function createTask(data: CreateTaskData): Promise<AgentTaskRow> {
  return (await db.agentTask.create({ data: { ...data, status: "QUEUED", attempts: 0, retryScheduled: false } })) as AgentTaskRow
}

export async function findTaskById(id: string): Promise<AgentTaskRow | null> {
  return ((await db.agentTask.findUnique({ where: { id } })) as AgentTaskRow | null) ?? null
}

/** Owner-scoped lookup: a task is visible only to the connection AND owner that created it. */
export async function findOwnedTask(taskRef: string, connectionId: string, ownerId: string): Promise<AgentTaskRow | null> {
  const row = (await db.agentTask.findUnique({ where: { taskRef } })) as AgentTaskRow | null
  if (!row || row.connectionId !== connectionId || row.ownerId !== ownerId) return null
  return row
}

export async function findTaskByIdempotencyScope(scope: string): Promise<AgentTaskRow | null> {
  return ((await db.agentTask.findUnique({ where: { idempotencyScope: scope } })) as AgentTaskRow | null) ?? null
}

export async function findTaskByActiveOperationKey(key: string): Promise<AgentTaskRow | null> {
  return ((await db.agentTask.findUnique({ where: { activeOperationKey: key } })) as AgentTaskRow | null) ?? null
}

export interface TransitionSpec {
  from: AgentTaskStatus | readonly AgentTaskStatus[]
  to: AgentTaskStatus
  /** Expected CURRENT attempt number (optimistic guard against stale workers). */
  attempts?: number
  now: Date
  /** Additional fields written in the same update. */
  data?: Partial<{
    attempts: number
    retryScheduled: boolean
    startedAt: Date
    errorCode: string | null
    errorDetailCode: string | null
    result: Prisma.InputJsonValue
    idempotencyScope: string | null
  }>
}

function timestampsFor(to: AgentTaskStatus, now: Date, retryScheduled: boolean): Record<string, unknown> {
  switch (to) {
    // attemptStartedAt marks the claim (STARTING) and is reset when the
    // attempt actually starts running (execution-timeout reference).
    case "STARTING":
    case "RUNNING":
      return { attemptStartedAt: now }
    case "CANCELLING":
      return { cancelRequestedAt: now }
    case "SUCCEEDED":
      return { completedAt: now, finishedAt: now }
    case "FAILED":
      return retryScheduled ? { failedAt: now } : { failedAt: now, finishedAt: now }
    case "CANCELLED":
      return { cancelledAt: now, finishedAt: now }
    case "EXPIRED":
    case "TIMED_OUT":
      return { finishedAt: now }
    case "RETRY_QUEUED":
      return { queuedAt: now, retryScheduled: false }
    default:
      return {}
  }
}

/**
 * Atomically moves a task from one of `from` to `to`. Returns true only if
 * THIS call performed the transition. Illegal transitions are programming
 * errors and throw before touching storage.
 */
export async function transitionTask(taskId: string, spec: TransitionSpec): Promise<boolean> {
  const fromList = (Array.isArray(spec.from) ? spec.from : [spec.from]) as AgentTaskStatus[]
  for (const from of fromList) assertLegalTaskTransition(from, spec.to)

  const retryScheduled = spec.data?.retryScheduled ?? false
  const terminal = isTerminalTask(spec.to, retryScheduled)
  const data: Record<string, unknown> = {
    status: spec.to,
    ...timestampsFor(spec.to, spec.now, retryScheduled),
    ...(spec.data ?? {}),
  }
  // The in-flight dedupe key is released exactly when the task can no longer run.
  if (terminal) data.activeOperationKey = null
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key]

  const where: Record<string, unknown> = { id: taskId, status: { in: fromList } }
  if (spec.attempts !== undefined) where.attempts = spec.attempts
  // A final FAILED task can never be re-queued: only one whose retry is scheduled.
  if (spec.to === "RETRY_QUEUED") where.retryScheduled = true

  const result = await db.agentTask.updateMany({ where: where as Prisma.AgentTaskWhereInput, data: data as Prisma.AgentTaskUpdateManyMutationInput })
  return result.count === 1
}

export async function listTasks(where: Prisma.AgentTaskWhereInput, take: number): Promise<AgentTaskRow[]> {
  return (await db.agentTask.findMany({ where, orderBy: { createdAt: "asc" }, take })) as AgentTaskRow[]
}

/** Retention: drop stored results of terminal tasks finished before `before`. */
export async function clearResultsFinishedBefore(before: Date, now: Date): Promise<number> {
  // Only SUCCEEDED tasks ever store a result.
  const result = await db.agentTask.updateMany({
    where: { status: "SUCCEEDED", finishedAt: { lt: before }, resultRemovedAt: null },
    data: { result: Prisma.DbNull, resultRemovedAt: now },
  })
  return result.count
}

/** Retention: delete terminal task rows finished before `before`. Non-terminal rows never have finishedAt. */
export async function deleteTasksFinishedBefore(before: Date): Promise<number> {
  const result = await db.agentTask.deleteMany({ where: { finishedAt: { lt: before } } })
  return result.count
}
