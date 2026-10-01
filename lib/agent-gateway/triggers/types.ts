/**
 * lib/agent-gateway/triggers/types.ts
 *
 * Phase 9 — event / webhook / schedule triggers. A trigger is a HUMAN-
 * configured, explicitly authorized request to run ONE async-capable
 * capability for ONE agent connection when an allowlisted internal event, a
 * signed webhook call or a schedule occurrence arrives. Firing creates a
 * Phase 8 task through the same chain as an agent call (identity -> Phase 6
 * -> Phase 7 -> task). A trigger never grants anything by existing.
 */
import type { AgentTrigger, AgentTriggerRun } from "@prisma/client"

export type AgentTriggerRow = AgentTrigger
export type AgentTriggerRunRow = AgentTriggerRun

export type TriggerType = "EVENT" | "WEBHOOK" | "SCHEDULE"
export const TRIGGER_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "DISABLED", "EXPIRED", "REVOKED"] as const
export type TriggerStatus = (typeof TRIGGER_STATUSES)[number]
export type TriggerConcurrency = "ALLOW_PARALLEL" | "DROP_WHILE_RUNNING" | "QUEUE_ONE"
export type MissedRunPolicy = "SKIP" | "CATCH_UP_ONCE"
export type TriggerRunStatus = "TASK_CREATED" | "PENDING" | "DROPPED" | "DENIED" | "APPROVAL_REQUIRED" | "FAILED" | "SKIPPED_MISSED"
export type TriggerAction = "activate" | "pause" | "resume" | "disable" | "revoke"

/** Stable trigger error codes. Messages are generic; secrets are never included. */
export type TriggerErrorCode =
  | "TRIGGER_NOT_FOUND"
  | "TRIGGER_VALIDATION_FAILED"
  | "TRIGGER_CONFLICT"
  | "TRIGGER_INVALID_TRANSITION"
  | "TRIGGERS_UNAVAILABLE"
  | "SIGNATURE_INVALID"
  | "REPLAY_DETECTED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_REQUEST"
  | "SCHEDULE_ERROR"
  | "CONDITION_ERROR"
  | "TASK_CREATION_FAILED"
  | "QUEUE_UNAVAILABLE"
  | "AUTHORIZATION_DENIED"
  | "APPROVAL_REQUIRED"

/** One arrival at a trigger. */
export interface TriggerDelivery {
  source: TriggerType
  /** Dedup identity within the trigger: "event:<digest>", "webhook:<eventId>", "schedule:<iso>". */
  deliveryKey: string
  resourceId?: string | null
  scheduledFor?: Date | null
  bodyDigest?: string | null
}

/** Admin-facing trigger projection. Never contains the webhook secret or its ciphertext. */
export interface TriggerView {
  triggerRef: string
  name: string
  type: TriggerType
  status: TriggerStatus
  version: number
  connectionId: string
  ownerId: string
  teamId: string | null
  environment: string
  capabilityId: string
  capabilityVersion: number
  input: unknown
  bindResource: boolean
  concurrency: TriggerConcurrency
  event: { eventType: string; resourceId: string | null; actorScope: string } | null
  webhook: { path: string; secretVersion: number | null } | null
  schedule: {
    kind: string
    cron: string | null
    timezone: string
    runAt: string | null
    missedRunPolicy: string
    nextRunAt: string | null
    lastScheduledFor: string | null
  } | null
  expiresAt: string | null
  lastTriggeredAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  failureCount: number
  createdAt: string
  updatedAt: string
}

export interface TriggerRunView {
  runRef: string
  source: TriggerType
  status: TriggerRunStatus
  errorCode: string | null
  hasTask: boolean
  scheduledFor: string | null
  receivedAt: string
  completedAt: string | null
}
