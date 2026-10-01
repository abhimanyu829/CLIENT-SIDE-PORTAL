/**
 * lib/agent-gateway/governance/actions.ts
 *
 * Governance mutations. Thin, explicit operations over the EXISTING services
 * — TriggerService (Phase 9), AgentTaskService.cancel (Phase 8) and the
 * Phase 6 policy store — each with optimistic concurrency and an audit
 * entry. There is no generic "run any action" path: every operation is a
 * named function behind its own route.
 */
import { db } from "@/lib/db"
import { getCapabilityRegistry } from "../capabilities"
import { ExecutionGate } from "../execution-gate/gate"
import { PolicyEngineAuthorizer } from "../authorization/authorizer"
import { createPolicyVersion, disablePolicy, enablePolicy, rollbackToVersion } from "../authorization/policy-store"
import { assertWellFormedCondition } from "../authorization/policy-language"
import type { ConditionNode, PolicyEffect, PolicyScope } from "../authorization/types"
import type { RiskTier } from "../capabilities/types"
import { createAgentTaskService } from "../tasks"
import type { AgentTaskService } from "../tasks/engine"
import type { CancelTaskResult, AgentTaskStatus } from "../tasks/types"
import { TriggerService } from "../triggers/service"
import type { TriggerAction, TriggerView } from "../triggers/types"
import { GOVERNANCE_AUDIT_ACTIONS, recordGovernanceAudit } from "./audit"
import { GovernanceError, conflict, notFound } from "./errors"
import type { PolicyCreateBody, PolicyVersionBody } from "./schemas"

export interface GovernanceActionDeps {
  triggerService?: TriggerService
  taskService?: Pick<AgentTaskService, "cancel">
}

const triggers = (deps: GovernanceActionDeps) => deps.triggerService ?? new TriggerService()
const tasks = (deps: GovernanceActionDeps) => deps.taskService ?? createAgentTaskService(new ExecutionGate({ authorization: new PolicyEngineAuthorizer() }))

// ── Triggers (Phase 9 service) ───────────────────────────────────────────

export async function createTriggerAction(body: unknown, actorId: string, req?: Request, deps: GovernanceActionDeps = {}) {
  const result = await triggers(deps).create(body, actorId)
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.TRIGGER_CREATED,
    entity: "AgentTrigger",
    entityId: result.trigger.triggerRef,
    after: { type: result.trigger.type, connectionId: result.trigger.connectionId, capabilityId: result.trigger.capabilityId, status: result.trigger.status },
    req,
  })
  return result
}

export async function updateTriggerAction(triggerRef: string, expectedVersion: number, patch: unknown, actorId: string, req?: Request, deps: GovernanceActionDeps = {}) {
  const trigger = await triggers(deps).update(triggerRef, expectedVersion, patch, actorId)
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.TRIGGER_UPDATED,
    entity: "AgentTrigger",
    entityId: triggerRef,
    before: { version: expectedVersion },
    after: { version: trigger.version, fields: Object.keys((patch ?? {}) as object).sort() },
    req,
  })
  return trigger
}

export async function transitionTriggerAction(
  triggerRef: string,
  expectedVersion: number,
  action: TriggerAction,
  actorId: string,
  reason?: string,
  req?: Request,
  deps: GovernanceActionDeps = {}
): Promise<TriggerView> {
  const trigger = await triggers(deps).transition(triggerRef, expectedVersion, action, actorId)
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.TRIGGER_TRANSITIONED,
    entity: "AgentTrigger",
    entityId: triggerRef,
    before: { version: expectedVersion },
    after: { action, status: trigger.status, version: trigger.version },
    reason,
    req,
  })
  return trigger
}

export async function rotateTriggerSecretAction(triggerRef: string, expectedVersion: number, actorId: string, reason?: string, req?: Request, deps: GovernanceActionDeps = {}) {
  const result = await triggers(deps).rotateWebhookSecret(triggerRef, expectedVersion, actorId)
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.TRIGGER_SECRET_ROTATED,
    entity: "AgentTrigger",
    entityId: triggerRef,
    // The version number only — never the secret or its ciphertext.
    after: { secretVersion: result.trigger.webhook?.secretVersion ?? null },
    reason,
    req,
  })
  return result
}

// ── Tasks (Phase 8 engine) ───────────────────────────────────────────────

/**
 * Cancels a task on behalf of its owning connection, with the engine's own
 * honest semantics (QUEUED/STARTING/retry pending cancel; RUNNING cancels
 * only cooperatively-cancellable capabilities). `expectedStatus` is the
 * status the administrator saw: if the task moved on, nothing is done.
 */
export async function cancelTaskAction(
  taskRef: string,
  expectedStatus: AgentTaskStatus,
  actorId: string,
  reason?: string,
  req?: Request,
  deps: GovernanceActionDeps = {}
): Promise<CancelTaskResult> {
  if (!/^atk_[0-9a-f]{32}$/.test(taskRef)) throw notFound("Task")
  const row = await db.agentTask.findUnique({ where: { taskRef }, select: { status: true, connectionId: true, ownerId: true } })
  if (!row) throw notFound("Task")
  if (row.status !== expectedStatus) throw conflict("task")
  const result = await tasks(deps).cancel({ connectionId: row.connectionId, ownerId: row.ownerId }, taskRef)
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.TASK_CANCELLED,
    entity: "AgentTask",
    entityId: taskRef,
    before: { status: row.status },
    after: { outcome: result.outcome, status: result.task.status },
    reason,
    req,
  })
  return result
}

// ── Policies (Phase 6 store) ─────────────────────────────────────────────

const SCOPES_WITH_VALUE: readonly PolicyScope[] = ["OWNER", "TEAM", "CONNECTION", "RESOURCE_TYPE", "RESOURCE", "ENVIRONMENT"]
const ENVIRONMENTS = ["development", "staging", "production", "test"]

function validatePolicyVersion(body: Omit<PolicyVersionBody, "expectedCurrentVersion">): void {
  const invalid = (message: string) => new GovernanceError("VALIDATION_FAILED", message)
  const value = body.scopeValue ?? null
  if (SCOPES_WITH_VALUE.includes(body.scope)) {
    if (!value) throw invalid(`Scope ${body.scope} needs a scope value.`)
    if (!/^[A-Za-z0-9_.:@-]{1,200}$/.test(value)) throw invalid("The scope value must be a plain identifier.")
    if (body.scope === "ENVIRONMENT" && !ENVIRONMENTS.includes(value)) throw invalid("Unknown environment.")
  } else if (value) {
    throw invalid(`Scope ${body.scope} does not take a scope value.`)
  }
  if (body.scope === "CAPABILITY" && !body.capabilityId) throw invalid("Scope CAPABILITY needs a capability.")
  if (body.capabilityId) {
    const known = getCapabilityRegistry()
      .list({ includeDisabled: true, includeForbidden: true })
      .some((d) => d.id === body.capabilityId)
    if (!known) throw invalid("Unknown capability.")
  }
  if (body.conditions !== undefined && body.conditions !== null) {
    try {
      assertWellFormedCondition(body.conditions)
    } catch (err) {
      throw invalid(err instanceof Error ? `Invalid conditions: ${err.message}` : "Invalid conditions.")
    }
  }
}

function versionInput(body: Omit<PolicyVersionBody, "expectedCurrentVersion">) {
  return {
    effect: body.effect as PolicyEffect,
    scope: body.scope as PolicyScope,
    scopeValue: body.scopeValue ?? null,
    capabilityId: body.capabilityId ?? null,
    conditions: (body.conditions ?? null) as ConditionNode | null,
    riskConstraint: (body.riskConstraint ?? null) as RiskTier | null,
    approvalRequirement: body.approvalRequirement ?? false,
    note: body.note,
  }
}

async function requirePolicy(policyId: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(policyId)) throw notFound("Policy")
  const row = await db.agentPolicy.findUnique({ where: { id: policyId } })
  if (!row) throw notFound("Policy")
  return row
}

export async function createPolicyAction(body: PolicyCreateBody, actorId: string, req?: Request) {
  validatePolicyVersion(body)
  const result = await createPolicyVersion({
    name: body.name,
    description: body.description,
    priority: body.priority,
    enabled: body.enabled,
    ...versionInput(body),
    actorId,
  })
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.POLICY_CREATED,
    entity: "AgentPolicy",
    entityId: result.policyId,
    after: { version: result.version, effect: body.effect, scope: body.scope, capabilityId: body.capabilityId ?? null, enabled: body.enabled ?? true },
    req,
  })
  return result
}

export async function publishPolicyVersionAction(policyId: string, body: PolicyVersionBody, actorId: string, req?: Request) {
  await requirePolicy(policyId)
  validatePolicyVersion(body)
  const result = await createPolicyVersion({ policyId, ...versionInput(body), actorId, expectedCurrentVersion: body.expectedCurrentVersion })
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.POLICY_VERSION_PUBLISHED,
    entity: "AgentPolicy",
    entityId: policyId,
    before: { version: body.expectedCurrentVersion },
    after: { version: result.version, effect: body.effect, scope: body.scope, capabilityId: body.capabilityId ?? null },
    req,
  })
  return result
}

export async function rollbackPolicyAction(policyId: string, targetVersion: number, expectedCurrentVersion: number, actorId: string, reason?: string, req?: Request) {
  await requirePolicy(policyId)
  const target = await db.agentPolicyVersion.findUnique({ where: { policyId_version: { policyId, version: targetVersion } } })
  if (!target) throw notFound("Policy version")
  if (targetVersion >= expectedCurrentVersion) throw new GovernanceError("VALIDATION_FAILED", "Choose an earlier version to roll back to.")
  const result = await rollbackToVersion(policyId, targetVersion, actorId, expectedCurrentVersion)
  recordGovernanceAudit({
    actorId,
    action: GOVERNANCE_AUDIT_ACTIONS.POLICY_ROLLED_BACK,
    entity: "AgentPolicy",
    entityId: policyId,
    before: { version: expectedCurrentVersion },
    after: { version: result.version, copiedFrom: targetVersion },
    reason,
    req,
  })
  return result
}

/** Kill switch on / off. Idempotent: setting the current state again is a no-op success. */
export async function setPolicyEnabledAction(policyId: string, enabled: boolean, actorId: string, reason?: string, req?: Request) {
  const row = await requirePolicy(policyId)
  if (row.enabled !== enabled) {
    if (enabled) await enablePolicy(policyId)
    else await disablePolicy(policyId)
    recordGovernanceAudit({
      actorId,
      action: enabled ? GOVERNANCE_AUDIT_ACTIONS.POLICY_ENABLED : GOVERNANCE_AUDIT_ACTIONS.POLICY_DISABLED,
      entity: "AgentPolicy",
      entityId: policyId,
      before: { enabled: row.enabled },
      after: { enabled },
      reason,
      req,
    })
  }
  return { policyId, enabled }
}
