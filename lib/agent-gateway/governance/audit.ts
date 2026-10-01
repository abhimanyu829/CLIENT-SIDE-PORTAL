/**
 * lib/agent-gateway/governance/audit.ts
 *
 * Every governance mutation is written to the EXISTING AuditLog table
 * through the EXISTING lib/audit.ts helper — exactly how Phase 2 records
 * connection lifecycle changes. Not the Phase 11 ledger.
 *
 * Callers pass non-secret summaries only: never a webhook secret, credential,
 * token, ciphertext, task input or result.
 */
import type { NextRequest } from "next/server"
import { auditLog } from "@/lib/audit"

export const GOVERNANCE_AUDIT_ACTIONS = {
  TRIGGER_CREATED: "AGENT_TRIGGER_CREATED",
  TRIGGER_UPDATED: "AGENT_TRIGGER_UPDATED",
  TRIGGER_TRANSITIONED: "AGENT_TRIGGER_STATUS_CHANGED",
  TRIGGER_SECRET_ROTATED: "AGENT_TRIGGER_SECRET_ROTATED",
  TASK_CANCELLED: "AGENT_TASK_CANCELLED_BY_ADMIN",
  POLICY_CREATED: "AGENT_POLICY_CREATED",
  POLICY_VERSION_PUBLISHED: "AGENT_POLICY_VERSION_PUBLISHED",
  POLICY_ROLLED_BACK: "AGENT_POLICY_ROLLED_BACK",
  POLICY_ENABLED: "AGENT_POLICY_ENABLED",
  POLICY_DISABLED: "AGENT_POLICY_DISABLED",
} as const

export type GovernanceAuditAction = (typeof GOVERNANCE_AUDIT_ACTIONS)[keyof typeof GOVERNANCE_AUDIT_ACTIONS]

export interface GovernanceAuditInput {
  actorId: string
  action: GovernanceAuditAction
  entity: "AgentTrigger" | "AgentTask" | "AgentPolicy"
  entityId: string
  before?: object
  after?: object
  reason?: string
  req?: Request
}

export function recordGovernanceAudit(input: GovernanceAuditInput): void {
  auditLog({
    userId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before,
    after: input.reason ? { ...(input.after ?? {}), reason: input.reason } : input.after,
    // lib/audit.ts reads only the IP and user-agent headers from the request.
    req: input.req as NextRequest | undefined,
  })
}
