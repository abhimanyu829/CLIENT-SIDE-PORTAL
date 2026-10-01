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
