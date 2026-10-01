/**
 * lib/agent-gateway/observability/lifecycle-events.ts
 *
 * Structured security events for the AgentConnection/AgentCredential
 * lifecycle (Phase 2 spec §24): created, credential generated/rotated/
 * revoked, connection suspended/reactivated/expired, and the
 * authentication-failure classes (invalid credential, replay, signature
 * failure, revoked-credential reuse).
 *
 * Two existing mechanisms are reused:
 *   1. Admin-actor-driven lifecycle mutations (create/suspend/reactivate/
 *      revoke/rotate) write to the EXISTING AuditLog table via the
 *      EXISTING lib/audit.ts helper — these are indistinguishable in kind
 *      from any other admin action already audited that way in this app.
 *   2. Authentication-time events (success/failure/replay/signature
 *      failure) go through the EXISTING gateway audit hook
 *      (observability/audit-hook.ts), which already logs per-request.
 *
 * Phase 11: each lifecycle mutation is also appended to the agent audit
 * ledger (IDENTITY category) with the human actor and the status change —
 * never a credential, fingerprint or secret.
 */
import { auditLog } from "@/lib/audit"
import { recordAudit } from "../audit-ledger/recorder"
import type { AuditAction } from "../audit-ledger/types"

export const AGENT_LIFECYCLE_EVENTS = {
  CONNECTION_CREATED: "AGENT_CONNECTION_CREATED",
  CREDENTIAL_GENERATED: "AGENT_CREDENTIAL_GENERATED",
  CREDENTIAL_ROTATED: "AGENT_CREDENTIAL_ROTATED",
  CREDENTIAL_REVOKED: "AGENT_CREDENTIAL_REVOKED",
  CONNECTION_SUSPENDED: "AGENT_CONNECTION_SUSPENDED",
  CONNECTION_REACTIVATED: "AGENT_CONNECTION_REACTIVATED",
  CONNECTION_REVOKED: "AGENT_CONNECTION_REVOKED",
  CONNECTION_EXPIRED: "AGENT_CONNECTION_EXPIRED",
} as const

export type AgentLifecycleEventName = (typeof AGENT_LIFECYCLE_EVENTS)[keyof typeof AGENT_LIFECYCLE_EVENTS]

interface RecordLifecycleEventInput {
  action: AgentLifecycleEventName
  actorId: string
  connectionId: string
  before?: object
  after?: object
}

const LEDGER_ACTIONS: Record<AgentLifecycleEventName, AuditAction> = {
  AGENT_CONNECTION_CREATED: "connection.created",
  AGENT_CREDENTIAL_GENERATED: "credential.generated",
  AGENT_CREDENTIAL_ROTATED: "credential.rotated",
  AGENT_CREDENTIAL_REVOKED: "credential.revoked",
  AGENT_CONNECTION_SUSPENDED: "connection.suspended",
  AGENT_CONNECTION_REACTIVATED: "connection.reactivated",
  AGENT_CONNECTION_REVOKED: "connection.revoked",
  AGENT_CONNECTION_EXPIRED: "connection.expired",
}

function status(value: object | undefined): string | undefined {
  const s = (value as { status?: unknown } | undefined)?.status
  return typeof s === "string" ? s : undefined
}

/**
 * Writes a lifecycle mutation into the EXISTING AuditLog table. Never
 * includes a raw credential/secret value in `before`/`after` — callers
 * must pass only non-secret summaries (see connection-service.ts's call
 * sites, which pass status/timestamps, never tokens).
 */
export function recordLifecycleEvent(input: RecordLifecycleEventInput): void {
  auditLog({
    userId: input.actorId,
    action: input.action,
    entity: "AgentConnection",
    entityId: input.connectionId,
    before: input.before,
    after: input.after,
  })
  try {
    recordAudit({
      action: LEDGER_ACTIONS[input.action],
      outcome: "SUCCESS",
      actor: { type: "HUMAN", id: input.actorId },
      connectionId: input.connectionId,
      metadata: { statusFrom: status(input.before), statusTo: status(input.after) },
    })
  } catch {
    // Evidence never blocks a lifecycle change (AuditLog above is the primary record).
  }
}
