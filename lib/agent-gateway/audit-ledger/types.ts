/**
 * lib/agent-gateway/audit-ledger/types.ts
 *
 * Phase 11 — the closed vocabulary of the agent audit ledger.
 *
 * Every action belongs to exactly one category, so a caller can never
 * record "execution.succeeded" under, say, POLICY. Adding an action is a
 * code change (reviewed), never a runtime value.
 */

export const AUDIT_SCHEMA_VERSION = 1

export const AUDIT_ACTIONS = {
  // AUTHENTICATION
  "authentication.succeeded": "AUTHENTICATION",
  "authentication.failed": "AUTHENTICATION",
  // IDENTITY (connection lifecycle, human actors)
  "connection.created": "IDENTITY",
  "connection.suspended": "IDENTITY",
  "connection.reactivated": "IDENTITY",
  "connection.revoked": "IDENTITY",
  "credential.generated": "IDENTITY",
  "credential.rotated": "IDENTITY",
  "credential.revoked": "IDENTITY",
  "connection.expired": "IDENTITY",
  // CAPABILITY
  "capability_registry.loaded": "CAPABILITY",
  // AUTHORIZATION (gate decisions)
  "authorization.allowed": "AUTHORIZATION",
  "authorization.denied": "AUTHORIZATION",
  "authorization.unavailable": "AUTHORIZATION",
  // APPROVAL
  "approval.required": "APPROVAL",
  "approval.consumed": "APPROVAL",
  "approval.refused": "APPROVAL",
  "approval.approved": "APPROVAL",
  "approval.rejected": "APPROVAL",
  "approval.cancelled": "APPROVAL",
  // AUTONOMY
  "autonomy.policy_set": "AUTONOMY",
  "autonomy.policy_disabled": "AUTONOMY",
  "autonomy.promoted": "AUTONOMY",
  "autonomy.demoted": "AUTONOMY",
  "autonomy.promotion_blocked": "AUTONOMY",
  // EXECUTION
  "execution.started": "EXECUTION",
  "execution.succeeded": "EXECUTION",
  "execution.failed": "EXECUTION",
  "execution.replayed": "EXECUTION",
  // TASK
  "task.created": "TASK",
  "task.queued": "TASK",
  "task.started": "TASK",
  "task.retrying": "TASK",
  "task.succeeded": "TASK",
  "task.failed": "TASK",
  "task.cancellation_requested": "TASK",
  "task.cancelled": "TASK",
  "task.expired": "TASK",
  "task.timed_out": "TASK",
  // TRIGGER / WEBHOOK / SCHEDULE
  "trigger.fired": "TRIGGER",
  "webhook.accepted": "WEBHOOK",
  "webhook.rejected": "WEBHOOK",
  "schedule.fired": "SCHEDULE",
  // POLICY (human changes)
  "policy.created": "POLICY",
  "policy.version_published": "POLICY",
  "policy.rolled_back": "POLICY",
  "policy.enabled": "POLICY",
  "policy.disabled": "POLICY",
  // SECURITY
  "security.task_violation": "SECURITY",
  "security.injection_suspected": "SECURITY",
  "security.secret_redacted": "SECURITY",
  "security.input_rejected": "SECURITY",
  "security.outbound_blocked": "SECURITY",
  "security.kill_switch_blocked": "SECURITY",
  "security.rollout_blocked": "SECURITY",
  // FAILURE
  "failure.circuit_opened": "FAILURE",
  "failure.circuit_half_open": "FAILURE",
  "failure.circuit_closed": "FAILURE",
  "failure.circuit_rejected": "FAILURE",
  // ROLLBACK
  "recovery.requested": "ROLLBACK",
  "recovery.executing": "ROLLBACK",
  "recovery.succeeded": "ROLLBACK",
  "recovery.failed": "ROLLBACK",
  "recovery.approval_required": "ROLLBACK",
  "recovery.manual_required": "ROLLBACK",
  // ADMIN_GOVERNANCE
  "governance.trigger_created": "ADMIN_GOVERNANCE",
  "governance.trigger_updated": "ADMIN_GOVERNANCE",
  "governance.trigger_status_changed": "ADMIN_GOVERNANCE",
  "governance.trigger_secret_rotated": "ADMIN_GOVERNANCE",
  "governance.task_cancelled": "ADMIN_GOVERNANCE",
  "governance.ledger_verified": "ADMIN_GOVERNANCE",
  // CONFIGURATION (Phase 15 release controls)
  "kill_switch.activated": "CONFIGURATION",
  "kill_switch.deactivated": "CONFIGURATION",
  "rollout.configured": "CONFIGURATION",
  "rollout.advanced": "CONFIGURATION",
  "rollout.paused": "CONFIGURATION",
  "rollout.resumed": "CONFIGURATION",
  "rollout.rolled_back": "CONFIGURATION",
  "rollout.auto_paused": "CONFIGURATION",
  "release.attestation_recorded": "CONFIGURATION",
} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS
export type AuditCategory = (typeof AUDIT_ACTIONS)[AuditAction]
export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILED" | "INFO"
export type AuditActorType = "AGENT" | "HUMAN" | "SYSTEM"

export const AUDIT_CATEGORIES: readonly AuditCategory[] = Array.from(new Set(Object.values(AUDIT_ACTIONS)))

export function categoryOf(action: AuditAction): AuditCategory {
  return AUDIT_ACTIONS[action]
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, value)
}

/** Primitive metadata values only; nested objects only for the allowlisted keys in redaction.ts. */
export type AuditMetadataValue = string | number | boolean | null | string[] | Record<string, string | number | boolean | null>
export type AuditMetadata = Record<string, AuditMetadataValue | undefined>

/** What a caller supplies. Sequence, digests, eventId and schema version are always server-computed. */
export interface AuditEventInput {
  action: AuditAction
  outcome: AuditOutcome
  occurredAt?: Date
  actor: { type: AuditActorType; id?: string | null }
  requestId?: string | null
  traceId?: string | null
  connectionId?: string | null
  agentId?: string | null
  ownerId?: string | null
  teamId?: string | null
  capabilityId?: string | null
  capabilityVersion?: number | null
  riskTier?: string | null
  resourceType?: string | null
  resourceRef?: string | null
  environment?: string | null
  authorizationDecision?: string | null
  authorizationPolicyRef?: string | null
  autonomyLevel?: string | null
  autonomyPolicyVersion?: number | null
  approvalRef?: string | null
  taskRef?: string | null
  triggerRef?: string | null
  adapterId?: string | null
  executionStatus?: string | null
  resultCode?: string | null
  errorCode?: string | null
  inputDigest?: string | null
  outputDigest?: string | null
  metadata?: AuditMetadata
}

/** The stored row (Prisma AgentAuditEvent), as the ledger reads it back. */
export interface AuditEventRow {
  id: string
  sequence: number
  eventId: string
  schemaVersion: number
  category: AuditCategory
  action: string
  outcome: AuditOutcome
  occurredAt: Date
  recordedAt?: Date
  requestId: string | null
  traceId: string | null
  actorType: string
  actorId: string | null
  connectionId: string | null
  agentId: string | null
  ownerId: string | null
  teamId: string | null
  capabilityId: string | null
  capabilityVersion: number | null
  riskTier: string | null
  resourceType: string | null
  resourceRef: string | null
  environment: string | null
  authorizationDecision: string | null
  authorizationPolicyRef: string | null
  autonomyLevel: string | null
  autonomyPolicyVersion: number | null
  approvalRef: string | null
  taskRef: string | null
  triggerRef: string | null
  adapterId: string | null
  executionStatus: string | null
  resultCode: string | null
  errorCode: string | null
  inputDigest: string | null
  outputDigest: string | null
  metadata: unknown
  previousEventDigest: string
  eventDigest: string
}

export class AuditLedgerUnavailableError extends Error {
  readonly code = "AUDIT_LEDGER_UNAVAILABLE" as const
  constructor(message = "The audit ledger is unavailable.") {
    super(message)
    this.name = "AuditLedgerUnavailableError"
  }
}
