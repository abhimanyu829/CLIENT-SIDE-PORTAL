/**
 * lib/agent-gateway/tasks/types.ts
 *
 * Phase 8 — Async Task Engine vocabulary. The engine is an ORCHESTRATION
 * layer for agent-originated asynchronous work: it records the task,
 * enqueues one BullMQ job per attempt on the existing Redis/BullMQ stack,
 * and the existing worker process executes it through the existing Phase 4
 * adapters. It never replaces a business worker and never executes anything
 * a synchronous call could not.
 */
import type { AgentTask } from "@prisma/client"

/** Mirrors the Prisma `AgentTaskStatus` enum exactly. */
export const AGENT_TASK_STATUSES = [
  "QUEUED",
  "STARTING",
  "RUNNING",
  "CANCELLING",
  "SUCCEEDED",
  "FAILED",
  "RETRY_QUEUED",
  "CANCELLED",
  "EXPIRED",
  "TIMED_OUT",
] as const
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]

/** Mirrors the Prisma `AgentTaskRetryClass` enum exactly. */
export type RetryClass = "SAFE_RETRY" | "CONDITIONAL_RETRY" | "NO_RETRY"

/** The persisted task row (Prisma-generated shape). */
export type AgentTaskRow = AgentTask

/**
 * Stable, agent-facing task error codes. Messages are generic: never SQL,
 * stack traces, file paths, connection strings, credentials or tokens.
 * IDEMPOTENCY_* reuse the Phase 4 ExecutionErrorCode names.
 */
export type TaskErrorCode =
  | "TASK_NOT_FOUND"
  | "TASK_EXPIRED"
  | "TASK_CANCELLED"
  | "TASK_TIMEOUT"
  | "TASK_ALREADY_RUNNING"
  | "TASK_ALREADY_COMPLETED"
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_DISABLED"
  | "ASYNC_NOT_SUPPORTED"
  | "INVALID_INPUT"
  | "AUTHORIZATION_REVOKED"
  | "APPROVAL_EXPIRED"
  | "EXECUTION_FAILED"
  | "RETRY_EXHAUSTED"
  | "QUEUE_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "ENVIRONMENT_MISMATCH"
  | "TASK_STORE_UNAVAILABLE"

/** Honest cancellation outcomes — never a faked cancellation. */
export type CancelOutcome = "CANCELLED" | "CANCELLATION_REQUESTED" | "CANCELLATION_UNAVAILABLE"

/** What an agent may see about its own task. No input, no internal ids, no digests. */
export interface AgentTaskView {
  taskRef: string
  capabilityId: string
  capabilityVersion: number
  status: AgentTaskStatus
  attempts: number
  maxAttempts: number
  retryScheduled: boolean
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  finishedAt: string | null
  expiresAt: string
  errorCode: string | null
  /** "TRIGGER" when a human-configured Phase 9 trigger created the task; "AGENT" otherwise. */
  origin: "AGENT" | "TRIGGER"
  /** Present only when status is SUCCEEDED and the result is still retained and readable. */
  result?: unknown
  /** SUCCEEDED but the result is not returned: "REMOVED" (retention) or "AUTHORIZATION_REVOKED". */
  resultUnavailable?: "REMOVED" | "AUTHORIZATION_REVOKED"
  /** For TIMED_OUT: the deadline was reached; the underlying service call may still have completed. */
  note?: string
}

export interface SubmitTaskResult {
  task: AgentTaskView
  /** False when an existing task was returned (idempotent replay / in-flight duplicate). */
  created: boolean
  /**
   * Internal row id, for server-side linking only (Phase 9 trigger runs).
   * Never serialized to agents: the MCP tools return `task` + `created` only.
   */
  taskId: string
}

export interface CancelTaskResult {
  outcome: CancelOutcome
  task: AgentTaskView
}

/** Server-derived identity of the calling connection (never client input). */
export interface TaskCallerIdentity {
  connectionId: string
  ownerId: string
}
