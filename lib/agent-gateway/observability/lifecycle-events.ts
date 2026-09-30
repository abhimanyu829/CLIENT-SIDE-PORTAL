/**
 * lib/agent-gateway/observability/lifecycle-events.ts
 *
 * Structured security events for the AgentConnection/AgentCredential
 * lifecycle (Phase 2 spec §24): created, credential generated/rotated/
 * revoked, connection suspended/reactivated/expired, and the
 * authentication-failure classes (invalid credential, replay, signature
 * failure, revoked-credential reuse).
 *
 * Per spec: "Use the existing event/logging architecture when possible.
 * Do not prematurely implement the final immutable AgentAuditLog ledger."
 * Two existing mechanisms are reused, deliberately NOT a new ledger:
 *   1. Admin-actor-driven lifecycle mutations (create/suspend/reactivate/
 *      revoke/rotate) write to the EXISTING AuditLog table via the
 *      EXISTING lib/audit.ts helper — these are indistinguishable in kind
 *      from any other admin action already audited that way in this app.
 *   2. Authentication-time events (success/failure/replay/signature
 *      failure) go through the EXISTING gateway audit hook
 *      (observability/audit-hook.ts), which already logs per-request —
 *      no new table for these either.
 */
import { auditLog } from "@/lib/audit"

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
}
