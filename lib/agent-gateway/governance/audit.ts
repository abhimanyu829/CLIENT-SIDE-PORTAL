/**
 * lib/agent-gateway/governance/audit.ts
 *
 * Every governance mutation is written to the EXISTING AuditLog table
 * through the EXISTING lib/audit.ts helper — exactly how Phase 2 records
 * connection lifecycle changes.
 *
 * Phase 11: the same mutation is also appended to the agent audit ledger
 * (POLICY for policy changes, ADMIN_GOVERNANCE for the rest), with the
 * human actor, the reason and allowlisted before/after facts only.
 *
 * Callers pass non-secret summaries only: never a webhook secret, credential,
 * token, ciphertext, task input or result.
 */
import type { NextRequest } from "next/server"
import { auditLog } from "@/lib/audit"
import { recordAudit } from "../audit-ledger/recorder"
import type { AuditAction } from "../audit-ledger/types"

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
  // Phase 11
  RECOVERY_REQUESTED: "AGENT_RECOVERY_REQUESTED",
  LEDGER_VERIFIED: "AGENT_AUDIT_LEDGER_VERIFIED",
} as const

export type GovernanceAuditAction = (typeof GOVERNANCE_AUDIT_ACTIONS)[keyof typeof GOVERNANCE_AUDIT_ACTIONS]

export interface GovernanceAuditInput {
  actorId: string
  action: GovernanceAuditAction
  entity: "AgentTrigger" | "AgentTask" | "AgentPolicy" | "AgentRecovery" | "AgentAuditEvent"
  entityId: string
  before?: object
  after?: object
  reason?: string
  req?: Request
}

/** null = the service performing the change already appends its own ledger events. */
const LEDGER_ACTIONS: Record<GovernanceAuditAction, AuditAction | null> = {
  AGENT_RECOVERY_REQUESTED: null,
  AGENT_AUDIT_LEDGER_VERIFIED: "governance.ledger_verified",
  AGENT_TRIGGER_CREATED: "governance.trigger_created",
  AGENT_TRIGGER_UPDATED: "governance.trigger_updated",
  AGENT_TRIGGER_STATUS_CHANGED: "governance.trigger_status_changed",
  AGENT_TRIGGER_SECRET_ROTATED: "governance.trigger_secret_rotated",
  AGENT_TASK_CANCELLED_BY_ADMIN: "governance.task_cancelled",
  AGENT_POLICY_CREATED: "policy.created",
  AGENT_POLICY_VERSION_PUBLISHED: "policy.version_published",
  AGENT_POLICY_ROLLED_BACK: "policy.rolled_back",
  AGENT_POLICY_ENABLED: "policy.enabled",
  AGENT_POLICY_DISABLED: "policy.disabled",
}

function pick(source: object | undefined, key: string): string | number | boolean | undefined {
  const value = (source as Record<string, unknown> | undefined)?.[key]
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined
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
  try {
    const ledgerAction = LEDGER_ACTIONS[input.action]
    if (!ledgerAction) return
    const statusFrom = pick(input.before, "status") ?? pick(input.before, "enabled")
    const statusTo = pick(input.after, "status") ?? pick(input.after, "enabled")
    recordAudit({
      action: ledgerAction,
      outcome: "SUCCESS",
      actor: { type: "HUMAN", id: input.actorId },
      resourceType: input.entity,
      resourceRef: input.entityId,
      triggerRef: input.entity === "AgentTrigger" && input.entityId.startsWith("trg_") ? input.entityId : null,
      taskRef: input.entity === "AgentTask" && input.entityId.startsWith("atk_") ? input.entityId : null,
      capabilityId: (pick(input.after, "capabilityId") as string | undefined) ?? null,
      metadata: {
        reason: input.reason,
        statusFrom: statusFrom === undefined ? undefined : String(statusFrom),
        statusTo: statusTo === undefined ? undefined : String(statusTo),
        policyId: input.entity === "AgentPolicy" ? input.entityId : undefined,
        policyVersion: pick(input.after, "version") as number | undefined,
        effect: pick(input.after, "effect") as string | undefined,
        scope: pick(input.after, "scope") as string | undefined,
        healthy: pick(input.after, "ok") as boolean | undefined,
        verifiedTo: pick(input.after, "lastVerifiedSequence") as number | undefined,
        brokenAt: pick(input.after, "brokenAt") as number | undefined,
      },
    })
  } catch {
    // Evidence never blocks the governance action (AuditLog above is the primary record).
  }
}
