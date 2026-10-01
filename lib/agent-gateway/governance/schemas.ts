/**
 * lib/agent-gateway/governance/schemas.ts
 *
 * Strict request bodies for the governance routes. Unknown keys are
 * rejected, so a forged owner, environment, status, version or actor field
 * can never reach a service. Actor ids always come from the session.
 */
import { z } from "zod"
import { AGENT_TASK_STATUSES } from "../tasks/types"

const reason = z.string().trim().max(500).optional()

/** activate / pause / resume / disable / revoke / rotate-secret. */
export const versionedActionSchema = z.object({ expectedVersion: z.number().int().min(1), reason }).strict()

/** PATCH /triggers/[ref] — the patch itself is validated by TriggerService (updateTriggerSchema). */
export const triggerUpdateSchema = z.object({ expectedVersion: z.number().int().min(1), patch: z.record(z.unknown()) }).strict()

export const taskCancelSchema = z.object({ expectedStatus: z.enum(AGENT_TASK_STATUSES), reason }).strict()

const policyVersionFields = {
  effect: z.enum(["ALLOW", "DENY", "REQUIRES_APPROVAL"]),
  scope: z.enum(["GLOBAL", "OWNER", "TEAM", "CONNECTION", "CAPABILITY", "RESOURCE_TYPE", "RESOURCE", "ENVIRONMENT"]),
  scopeValue: z.string().trim().min(1).max(200).nullable().optional(),
  capabilityId: z.string().trim().min(1).max(80).nullable().optional(),
  conditions: z.unknown().optional(),
  riskConstraint: z.enum(["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"]).nullable().optional(),
  approvalRequirement: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
}

export const policyVersionSchema = z.object({ ...policyVersionFields, expectedCurrentVersion: z.number().int().min(1) }).strict()
export type PolicyVersionBody = z.infer<typeof policyVersionSchema>

export const policyCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional(),
    priority: z.number().int().min(-1000).max(1000).optional(),
    enabled: z.boolean().optional(),
    ...policyVersionFields,
  })
  .strict()
export type PolicyCreateBody = z.infer<typeof policyCreateSchema>

export const policyRollbackSchema = z.object({ targetVersion: z.number().int().min(1), expectedCurrentVersion: z.number().int().min(1), reason }).strict()

export const policyToggleSchema = z.object({ reason }).strict()

/** Trigger creation bodies are validated by TriggerService.create (createTriggerSchema). */
export const triggerCreateSchema = z.record(z.unknown())

// ── Phase 11 — evidence and recovery ─────────────────────────────────────

/** Recover one recorded execution. The reason is mandatory: recovery is a privileged, audited operation. */
export const recoveryRequestSchema = z
  .object({ eventId: z.string().regex(/^aud_[0-9a-f]{32}$/), reason: z.string().trim().min(3).max(500) })
  .strict()

// ── Phase 15 — release controls ─────────────────────────────────────────

const releaseReason = z.string().trim().min(3).max(500)
const capabilityIdField = z.string().regex(/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/)
const connectionIdField = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

export const killSwitchActivateSchema = z
  .object({ scope: z.enum(["GLOBAL", "CAPABILITY", "CONNECTION", "RISK_TIER"]), target: z.string().trim().min(1).max(100).optional(), reason: releaseReason })
  .strict()

export const killSwitchDeactivateSchema = z.object({ expectedVersion: z.number().int().min(1), reason: releaseReason }).strict()

export const rolloutConfigureSchema = z
  .object({
    capabilityId: capabilityIdField,
    canaryPercent: z.number().int().min(0).max(100),
    allowedConnectionIds: z.array(connectionIdField).max(50),
    expectedVersion: z.number().int().min(1).optional(),
    reason: releaseReason,
  })
  .strict()

export const rolloutTransitionSchema = z
  .object({
    capabilityId: capabilityIdField,
    action: z.enum(["advance", "pause", "resume", "rollback"]),
    targetStage: z.enum(["DISABLED", "INTERNAL", "CANARY"]).optional(),
    expectedVersion: z.number().int().min(1),
    reason: releaseReason,
  })
  .strict()

export const autonomyChangeSchema = z
  .object({
    direction: z.enum(["promote", "demote"]),
    targetLevel: z.enum(["OBSERVE_ONLY", "ASSISTED", "APPROVAL_REQUIRED", "LIMITED_AUTONOMY"]).optional(),
    reason: releaseReason,
  })
  .strict()
  .refine((b) => (b.direction === "demote") === (b.targetLevel !== undefined), { message: "A demotion names its target level; a promotion never does (one level up)." })

export const attestationSchema = z
  .object({
    capabilityId: capabilityIdField,
    confirmed: z.array(z.enum(["TESTS_PASSED", "SECURITY_REVIEWED", "ROLLBACK_PLAN_READY", "MONITORING_READY", "ON_CALL_ASSIGNED"])).max(5),
    reason: releaseReason,
  })
  .strict()

/** Verify the ledger's hash chain (read-only; POST so it is never prefetched). */
export const ledgerVerifySchema = z
  .object({ fromSequence: z.number().int().min(1).optional(), maxEvents: z.number().int().min(1).max(100_000).optional() })
  .strict()
