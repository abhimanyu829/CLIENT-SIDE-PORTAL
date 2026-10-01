/**
 * lib/agent-gateway/tasks/observability.ts
 *
 * Task lifecycle hooks through the EXISTING Phase 1 observability surface:
 * the pino `gatewayLogger`, the audit hook and the in-process metrics.
 *
 * Phase 11: every lifecycle event is also appended to the audit ledger
 * (TASK category; a payload/job mismatch as SECURITY) and counted in the
 * labelled metrics. Queue latency is observed when an attempt starts.
 *
 * Never recorded: capability input, results, credentials, tokens, secrets.
 * A failure here never affects task state.
 */
import { gatewayLogger } from "../observability/request-log"
import { getAuditHook } from "../observability/audit-hook"
import { incrementMetric, type GatewayMetricsSnapshot } from "../observability/metrics"
import { countMetric, observeMetric } from "../observability/agent-metrics"
import { recordAudit } from "../audit-ledger/recorder"
import type { AuditAction, AuditOutcome } from "../audit-ledger/types"

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
  // Phase 11 — ledger context, filled from the task row (optional).
  ownerId?: string
  teamId?: string | null
  agentId?: string | null
  environment?: string
  resourceType?: string | null
  resourceId?: string | null
  authorizationPolicyRef?: string | null
  autonomyPolicyVersion?: number | null
  inputDigest?: string | null
  adapterId?: string | null
  traceId?: string | null
  queuedAt?: Date | string | null
  origin?: "AGENT" | "TRIGGER"
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

const LEDGER: Record<TaskEventName, { action: AuditAction; outcome: AuditOutcome }> = {
  "task.created": { action: "task.created", outcome: "SUCCESS" },
  "task.queued": { action: "task.queued", outcome: "INFO" },
  "task.started": { action: "task.started", outcome: "INFO" },
  "task.retrying": { action: "task.retrying", outcome: "INFO" },
  "task.succeeded": { action: "task.succeeded", outcome: "SUCCESS" },
  "task.failed": { action: "task.failed", outcome: "FAILED" },
  "task.cancellation_requested": { action: "task.cancellation_requested", outcome: "INFO" },
  "task.cancelled": { action: "task.cancelled", outcome: "INFO" },
  "task.expired": { action: "task.expired", outcome: "FAILED" },
  "task.timed_out": { action: "task.timed_out", outcome: "FAILED" },
  "task.security_violation": { action: "security.task_violation", outcome: "DENIED" },
}

function recordEvidence(event: TaskEventName, fields: TaskEventFields): void {
  const { action, outcome } = LEDGER[event]
  recordAudit({
    action,
    outcome,
    actor: { type: "AGENT", id: fields.connectionId },
    requestId: fields.requestId,
    traceId: fields.traceId ?? null,
    connectionId: fields.connectionId,
    agentId: fields.agentId ?? null,
    ownerId: fields.ownerId ?? null,
    teamId: fields.teamId ?? null,
    capabilityId: fields.capabilityId,
    capabilityVersion: fields.capabilityVersion,
    resourceType: fields.resourceType ?? null,
    resourceRef: fields.resourceId ?? null,
    environment: fields.environment ?? null,
    authorizationPolicyRef: fields.authorizationPolicyRef ?? null,
    autonomyPolicyVersion: fields.autonomyPolicyVersion ?? null,
    taskRef: fields.taskRef,
    adapterId: fields.adapterId ?? null,
    executionStatus: fields.status,
    errorCode: fields.errorCode ?? null,
    inputDigest: fields.inputDigest ?? null,
    metadata: { attempt: fields.attempt, detailCode: fields.detailCode ?? undefined, durationMs: fields.durationMs, jobId: fields.jobId, origin: fields.origin },
  })
}

function recordLabelledMetrics(event: TaskEventName, fields: TaskEventFields): void {
  const capability = fields.capabilityId
  if (event === "task.created") countMetric("agent_task_created_total", { capability })
  else if (event === "task.succeeded") countMetric("agent_task_succeeded_total", { capability })
  else if (event === "task.failed" || event === "task.expired" || event === "task.timed_out") {
    countMetric("agent_task_failed_total", { capability, reason: fields.errorCode ?? event.replace("task.", "").toUpperCase() })
  } else if (event === "task.retrying") countMetric("agent_task_retry_total", { capability })
  else if (event === "task.security_violation") countMetric("agent_security_denial_total", { reason: fields.detailCode ?? "TASK_SECURITY_VIOLATION" })
  if (event === "task.started" && fields.queuedAt) {
    const queuedAt = new Date(fields.queuedAt).getTime()
    if (Number.isFinite(queuedAt)) observeMetric("agent_task_queue_latency_ms", Date.now() - queuedAt, { capability })
  }
}

export function recordTaskEvent(event: TaskEventName, fields: TaskEventFields): void {
  try {
    const log = { event, ...fields }
    delete log.inputDigest
    delete log.queuedAt
    if (WARN_EVENTS.includes(event)) gatewayLogger.warn(log, "agent_gateway_task_event")
    else gatewayLogger.info(log, "agent_gateway_task_event")
    incrementMetric(METRIC_BY_EVENT[event])
    recordLabelledMetrics(event, fields)
    recordEvidence(event, fields)
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
