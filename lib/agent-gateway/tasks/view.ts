/**
 * lib/agent-gateway/tasks/view.ts
 *
 * The agent-facing projection of a task row. Never includes the stored
 * input, digests, internal ids, idempotency scope or approval id.
 */
import type { AgentTaskRow, AgentTaskView } from "./types"

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null)

export function toTaskView(row: AgentTaskRow): AgentTaskView {
  const view: AgentTaskView = {
    taskRef: row.taskRef,
    capabilityId: row.capabilityId,
    capabilityVersion: row.capabilityVersion,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    retryScheduled: row.retryScheduled,
    createdAt: new Date(row.createdAt).toISOString(),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    cancelledAt: iso(row.cancelledAt),
    finishedAt: iso(row.finishedAt),
    expiresAt: new Date(row.expiresAt).toISOString(),
    errorCode: row.errorCode ?? null,
    origin: row.triggerId ? "TRIGGER" : "AGENT",
  }
  if (row.status === "TIMED_OUT") {
    view.note = "The task deadline was reached. The underlying service call may still have completed; its result was discarded."
  }
  return view
}
