/**
 * lib/agent-gateway/tasks/state-machine.ts
 *
 * The task lifecycle. Same shape as the Phase 2 connection and Phase 7
 * approval state machines: an explicit legal-transition table, and the store
 * performs every transition as ONE conditional update (`WHERE status IN
 * (<from>) AND attempts = <n>`), so concurrent writers (worker vs cancel vs
 * sweep) can never both move a task out of the same state.
 *
 *   QUEUED       -> STARTING | CANCELLED | EXPIRED | FAILED
 *   STARTING     -> RUNNING  | CANCELLED | EXPIRED | FAILED
 *   RUNNING      -> SUCCEEDED | FAILED | CANCELLING | TIMED_OUT
 *   CANCELLING   -> CANCELLED | SUCCEEDED | FAILED | TIMED_OUT
 *   FAILED       -> RETRY_QUEUED            (only while retryScheduled)
 *   RETRY_QUEUED -> STARTING | CANCELLED | EXPIRED | FAILED
 *
 * Terminal: SUCCEEDED, CANCELLED, EXPIRED, TIMED_OUT, and FAILED without a
 * scheduled retry. There is no path out of a terminal state.
 *
 * A retry re-enters through STARTING (not straight to RUNNING) so the
 * worker-time re-verification runs before EVERY attempt, retries included.
 */
import type { AgentTaskStatus } from "./types"

const LEGAL_TRANSITIONS: Record<AgentTaskStatus, readonly AgentTaskStatus[]> = {
  QUEUED: ["STARTING", "CANCELLED", "EXPIRED", "FAILED"],
  STARTING: ["RUNNING", "CANCELLED", "EXPIRED", "FAILED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLING", "TIMED_OUT"],
  CANCELLING: ["CANCELLED", "SUCCEEDED", "FAILED", "TIMED_OUT"],
  FAILED: ["RETRY_QUEUED"],
  RETRY_QUEUED: ["STARTING", "CANCELLED", "EXPIRED", "FAILED"],
  SUCCEEDED: [],
  CANCELLED: [],
  EXPIRED: [],
  TIMED_OUT: [],
}

/** States from which no transition is ever possible. FAILED is terminal only without a scheduled retry. */
export const ALWAYS_TERMINAL_TASK_STATUSES: readonly AgentTaskStatus[] = ["SUCCEEDED", "CANCELLED", "EXPIRED", "TIMED_OUT"]

/** States that are waiting for a worker (claimable). */
export const PENDING_TASK_STATUSES: readonly AgentTaskStatus[] = ["QUEUED", "RETRY_QUEUED"]

/** States in which an attempt is in progress. */
export const ACTIVE_TASK_STATUSES: readonly AgentTaskStatus[] = ["STARTING", "RUNNING", "CANCELLING"]

export function isLegalTaskTransition(from: AgentTaskStatus, to: AgentTaskStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminalTask(status: AgentTaskStatus, retryScheduled: boolean): boolean {
  if (ALWAYS_TERMINAL_TASK_STATUSES.includes(status)) return true
  return status === "FAILED" && !retryScheduled
}

export class IllegalTaskTransitionError extends Error {
  readonly code = "ILLEGAL_TASK_TRANSITION"
  constructor(readonly from: string, readonly to: string) {
    super(`Illegal task transition ${from} -> ${to}.`)
    this.name = "IllegalTaskTransitionError"
  }
}

export function assertLegalTaskTransition(from: AgentTaskStatus, to: AgentTaskStatus): void {
  if (!isLegalTaskTransition(from, to)) throw new IllegalTaskTransitionError(from, to)
}
