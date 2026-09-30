/**
 * lib/agent-gateway/tasks/observability.ts
 *
 * Task lifecycle hooks through the EXISTING Phase 1 observability surface
 * only: the pino `gatewayLogger`, the audit hook and the in-process metrics.
 * This is not the Phase 11 audit ledger.
 *
 * Never recorded: capability input, results, credentials, tokens, secrets.
 * A failure here never affects task state.
 */
import { gatewayLogger } from "../observability/request-log"
import { getAuditHook } from "../observability/audit-hook"
import { incrementMetric, type GatewayMetricsSnapshot } from "../observability/metrics"

export type TaskEventName =
  | "task.created"
  | "task.queued"
  | "task.started"
  | "task.retrying"
  | "task.succeeded"
  | "task.failed"
  | "task.cancellation_requested"
  | "task.cancelled"
  | "task.expired"
  | "task.timed_out"
  | "task.security_violation"

export interface TaskEventFields {
  taskId: string
  taskRef: string
  requestId: string
  connectionId: string
  capabilityId: string
  capabilityVersion: number
  status: string
  attempt: number
  errorCode?: string | null
  detailCode?: string | null
  durationMs?: number
  jobId?: string
}

const METRIC_BY_EVENT: Record<TaskEventName, keyof GatewayMetricsSnapshot> = {
  "task.created": "agent_task_created_total",
  "task.queued": "agent_task_queued_total",
  "task.started": "agent_task_started_total",
  "task.retrying": "agent_task_retrying_total",
  "task.succeeded": "agent_task_succeeded_total",
  "task.failed": "agent_task_failed_total",
  "task.cancellation_requested": "agent_task_cancellation_requested_total",
  "task.cancelled": "agent_task_cancelled_total",
  "task.expired": "agent_task_expired_total",
  "task.timed_out": "agent_task_timed_out_total",
  "task.security_violation": "agent_task_security_violation_total",
}

const WARN_EVENTS: readonly TaskEventName[] = ["task.failed", "task.expired", "task.timed_out", "task.security_violation"]

export function recordTaskEvent(event: TaskEventName, fields: TaskEventFields): void {
  try {
    const log = { event, ...fields }
    if (WARN_EVENTS.includes(event)) gatewayLogger.warn(log, "agent_gateway_task_event")
    else gatewayLogger.info(log, "agent_gateway_task_event")
    incrementMetric(METRIC_BY_EVENT[event])
    void getAuditHook()
      .record({
        requestId: fields.requestId,
        timestamp: new Date(),
        component: "agent-task",
        outcome: event === "task.security_violation" ? "DENIED" : WARN_EVENTS.includes(event) ? "ERROR" : "SUCCESS",
        connectionId: fields.connectionId,
        route: event,
        errorCode: fields.errorCode ?? undefined,
        latencyMs: fields.durationMs,
      })
      .catch(() => undefined)
  } catch {
    // Observability must never change task behaviour.
  }
}
