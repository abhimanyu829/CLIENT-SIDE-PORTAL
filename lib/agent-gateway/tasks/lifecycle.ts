/**
 * lib/agent-gateway/tasks/lifecycle.ts
 *
 * Lifecycle steps shared by the worker and by maintenance (sweep /
 * reconcile), so both apply exactly the same rules:
 *   - time rules (queue timeout, execution timeout, overall deadline)
 *   - failure handling (retry decision from the task's retry class)
 *   - retry scheduling (FAILED -> RETRY_QUEUED + one delayed job)
 *
 * Every step is a conditional transition: whoever loses a race simply does
 * nothing, so concurrent workers, sweeps and cancels can never double-act.
 */
import { gatewayLogger } from "../observability/request-log"
import { transitionTask } from "./store"
import { backoffMs, decideAfterFailure } from "./retry-policy"
import { jobIdFor } from "./ids"
import type { TaskEngineConfig } from "./config"
import type { TaskJobPayload, TaskQueuePort } from "./queue"
import { recordTaskEvent, type TaskEventFields, type TaskEventName } from "./observability"
import type { AgentTaskRow, AgentTaskStatus } from "./types"

export interface LifecycleDeps {
  queue: TaskQueuePort
  config: TaskEngineConfig
  clock: () => Date
}

export function payloadFor(task: AgentTaskRow, attempt: number): TaskJobPayload {
  return {
    taskId: task.id,
    attempt,
    capabilityId: task.capabilityId,
    capabilityVersion: task.capabilityVersion,
    adapterId: task.adapterId,
    environment: task.environment,
    idempotencyRef: task.idempotencyKey ?? null,
  }
}

export function eventFields(task: AgentTaskRow, extra: Partial<TaskEventFields> = {}): TaskEventFields {
  return {
    taskId: task.id,
    taskRef: task.taskRef,
    requestId: task.requestId,
    connectionId: task.connectionId,
    capabilityId: task.capabilityId,
    capabilityVersion: task.capabilityVersion,
    status: task.status,
    attempt: task.attempts,
    errorCode: task.errorCode,
    ...extra,
  }
}

export function emit(event: TaskEventName, task: AgentTaskRow, extra: Partial<TaskEventFields> = {}): void {
  recordTaskEvent(event, eventFields(task, extra))
}

export interface DueTimeTransition {
  to: "EXPIRED" | "TIMED_OUT"
  errorCode: "TASK_EXPIRED" | "TASK_TIMEOUT"
}

const ms = (d: Date | null | undefined): number | null => (d ? new Date(d).getTime() : null)

/**
 * Pure: which time rule (if any) applies at `now`. The overall deadline is
 * exclusive — dispatch is allowed only while now < expiresAt.
 */
export function dueTimeTransition(task: AgentTaskRow, config: TaskEngineConfig, now: Date): DueTimeTransition | null {
  const t = now.getTime()
  const deadlinePassed = t >= new Date(task.expiresAt).getTime()
  switch (task.status) {
    case "QUEUED":
    case "RETRY_QUEUED": {
      const queued = ms(task.queuedAt) ?? ms(task.createdAt) ?? t
      if (deadlinePassed || t - queued >= config.queueTimeoutMs) return { to: "EXPIRED", errorCode: "TASK_EXPIRED" }
      return null
    }
    case "STARTING":
      return deadlinePassed ? { to: "EXPIRED", errorCode: "TASK_EXPIRED" } : null
    case "RUNNING":
    case "CANCELLING": {
      const started = ms(task.attemptStartedAt)
      if (deadlinePassed || (started !== null && t - started >= config.executionTimeoutMs)) return { to: "TIMED_OUT", errorCode: "TASK_TIMEOUT" }
      return null
    }
    default:
      return null
  }
}

/** Applies a due time rule. Returns true if THIS call changed the task. */
export async function applyDueTimeTransition(task: AgentTaskRow, config: TaskEngineConfig, now: Date): Promise<boolean> {
  const due = dueTimeTransition(task, config, now)
  if (!due) return false
  const ok = await transitionTask(task.id, {
    from: task.status as AgentTaskStatus,
    to: due.to,
    attempts: task.attempts,
    now,
    data: { errorCode: due.errorCode },
  })
  if (ok) emit(due.to === "EXPIRED" ? "task.expired" : "task.timed_out", { ...task, status: due.to, errorCode: due.errorCode })
  return ok
}

export interface AttemptFailure {
  /** True when the adapter was never invoked for this attempt. */
  preDispatch: boolean
  transient: boolean
  detailCode: string
}

/**
 * Records a failed attempt of `task` (STARTING / RUNNING / CANCELLING at
 * attempt `task.attempts`) and schedules the next attempt when the retry
 * class allows it. A CANCELLING task is never retried.
 */
export async function failAttempt(task: AgentTaskRow, failure: AttemptFailure, deps: LifecycleDeps): Promise<void> {
  const now = deps.clock()
  const decision =
    task.status === "CANCELLING"
      ? ({ retry: false, errorCode: "EXECUTION_FAILED" } as const)
      : decideAfterFailure({
          retryClass: task.retryClass,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          transient: failure.transient,
          preDispatch: failure.preDispatch,
        })

  if (!decision.retry) {
    const ok = await transitionTask(task.id, {
      from: task.status as AgentTaskStatus,
      to: "FAILED",
      attempts: task.attempts,
      now,
      data: { retryScheduled: false, errorCode: decision.errorCode, errorDetailCode: failure.detailCode },
    })
    if (ok) emit("task.failed", { ...task, status: "FAILED", errorCode: decision.errorCode }, { detailCode: failure.detailCode })
    return
  }

  const failed = await transitionTask(task.id, {
    from: task.status as AgentTaskStatus,
    to: "FAILED",
    attempts: task.attempts,
    now,
    data: { retryScheduled: true, errorCode: null, errorDetailCode: failure.detailCode },
  })
  if (!failed) return
  await scheduleRetry({ ...task, status: "FAILED", retryScheduled: true }, deps)
}

/**
 * FAILED (retry scheduled) -> RETRY_QUEUED, then one delayed job for the next
 * attempt. If the enqueue fails the task stays RETRY_QUEUED; reconciliation
 * re-enqueues it, or the queue timeout expires it. Never runs it twice: the
 * next claim is conditional on the attempt number.
 */
export async function scheduleRetry(task: AgentTaskRow, deps: LifecycleDeps): Promise<boolean> {
  const now = deps.clock()
  const queued = await transitionTask(task.id, { from: "FAILED", to: "RETRY_QUEUED", attempts: task.attempts, now })
  if (!queued) return false
  const next = task.attempts + 1
  emit("task.retrying", { ...task, status: "RETRY_QUEUED" }, { attempt: next })
  try {
    await deps.queue.enqueue(payloadFor(task, next), { jobId: jobIdFor(task.id, next), delayMs: backoffMs(task.attempts) })
  } catch {
    gatewayLogger.warn({ taskId: task.id, taskRef: task.taskRef, attempt: next }, "agent_gateway_task_retry_enqueue_deferred")
  }
  return true
}
