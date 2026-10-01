/**
 * lib/agent-gateway/governance/routes.ts
 *
 * Route handlers for app/api/admin/agent-governance/*. Each exported
 * handler serves exactly ONE named operation with its own strict body
 * schema; the route files only bind them to a path. Every handler:
 *   1. authenticates a SUPER_ADMIN human session and refuses agent
 *      credentials (requireGovernanceOperator);
 *   2. parses a size-bounded application/json body with a strict schema;
 *   3. calls one governance action (optimistic concurrency + audit);
 *   4. answers `{ success, ... }` or `{ success:false, code, error }`.
 */
import type { TriggerAction } from "../triggers/types"
import { requireGovernanceOperator } from "./access"
import {
  cancelTaskAction,
  createPolicyAction,
  createTriggerAction,
  publishPolicyVersionAction,
  rollbackPolicyAction,
  rotateTriggerSecretAction,
  setPolicyEnabledAction,
  transitionTriggerAction,
  updateTriggerAction,
} from "./actions"
import { governanceErrorResponse, governanceOk, readJsonBody } from "./http"
import { requestRecoveryAction, verifyLedgerAction } from "./evidence"
import { activateKillSwitchAction, changeAutonomyAction, configureRolloutAction, deactivateKillSwitchAction, recordAttestationAction, transitionRolloutAction } from "./release"
import {
  attestationSchema,
  autonomyChangeSchema,
  killSwitchActivateSchema,
  killSwitchDeactivateSchema,
  rolloutConfigureSchema,
  rolloutTransitionSchema,
  ledgerVerifySchema,
  recoveryRequestSchema,
  policyCreateSchema,
  policyRollbackSchema,
  policyToggleSchema,
  policyVersionSchema,
  taskCancelSchema,
  triggerCreateSchema,
  triggerUpdateSchema,
  versionedActionSchema,
} from "./schemas"

type RefContext = { params: Promise<{ ref: string }> }
type IdContext = { params: Promise<{ id: string }> }

export async function createTriggerRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, triggerCreateSchema)
    const { trigger, webhookSecret } = await createTriggerAction(body, actor.userId, req)
    // The webhook secret is in this response only, exactly once.
    return governanceOk({ trigger, ...(webhookSecret ? { webhookSecret } : {}) }, 201)
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function updateTriggerRoute(req: Request, { params }: RefContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { ref } = await params
    const body = await readJsonBody(req, triggerUpdateSchema)
    return governanceOk({ trigger: await updateTriggerAction(ref, body.expectedVersion, body.patch, actor.userId, req) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export function triggerTransitionRoute(action: TriggerAction) {
  return async function POST(req: Request, { params }: RefContext): Promise<Response> {
    try {
      const actor = await requireGovernanceOperator(req)
      const { ref } = await params
      const body = await readJsonBody(req, versionedActionSchema)
      return governanceOk({ trigger: await transitionTriggerAction(ref, body.expectedVersion, action, actor.userId, body.reason, req) })
    } catch (err) {
      return governanceErrorResponse(err)
    }
  }
}

export async function rotateTriggerSecretRoute(req: Request, { params }: RefContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { ref } = await params
    const body = await readJsonBody(req, versionedActionSchema)
    const { trigger, webhookSecret } = await rotateTriggerSecretAction(ref, body.expectedVersion, actor.userId, body.reason, req)
    return governanceOk({ trigger, webhookSecret })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function cancelTaskRoute(req: Request, { params }: RefContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { ref } = await params
    const body = await readJsonBody(req, taskCancelSchema)
    const result = await cancelTaskAction(ref, body.expectedStatus, actor.userId, body.reason, req)
    return governanceOk({ outcome: result.outcome, status: result.task.status })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function createPolicyRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, policyCreateSchema)
    return governanceOk({ policy: await createPolicyAction(body, actor.userId, req) }, 201)
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function publishPolicyVersionRoute(req: Request, { params }: IdContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { id } = await params
    const body = await readJsonBody(req, policyVersionSchema)
    return governanceOk({ policy: await publishPolicyVersionAction(id, body, actor.userId, req) }, 201)
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function rollbackPolicyRoute(req: Request, { params }: IdContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { id } = await params
    const body = await readJsonBody(req, policyRollbackSchema)
    return governanceOk({ policy: await rollbackPolicyAction(id, body.targetVersion, body.expectedCurrentVersion, actor.userId, body.reason, req) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export function policyToggleRoute(enabled: boolean) {
  return async function POST(req: Request, { params }: IdContext): Promise<Response> {
    try {
      const actor = await requireGovernanceOperator(req)
      const { id } = await params
      const body = await readJsonBody(req, policyToggleSchema)
      return governanceOk({ policy: await setPolicyEnabledAction(id, enabled, actor.userId, body.reason, req) })
    } catch (err) {
      return governanceErrorResponse(err)
    }
  }
}

// ── Phase 11 — evidence and recovery ─────────────────────────────────────

export async function requestRecoveryRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, recoveryRequestSchema)
    return governanceOk({ recovery: await requestRecoveryAction(body, actor.userId, req) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

// ── Phase 15 — release controls ─────────────────────────────────────────

export async function activateKillSwitchRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, killSwitchActivateSchema)
    const { killSwitch, created } = await activateKillSwitchAction(body, actor.userId, req)
    return governanceOk({ killSwitch, created }, created ? 201 : 200)
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function deactivateKillSwitchRoute(req: Request, { params }: RefContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { ref } = await params
    const body = await readJsonBody(req, killSwitchDeactivateSchema)
    return governanceOk({ killSwitch: await deactivateKillSwitchAction(ref, body, actor.userId, req) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function configureRolloutRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, rolloutConfigureSchema)
    return governanceOk({ rollout: await configureRolloutAction(body, actor.userId, req) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function transitionRolloutRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, rolloutTransitionSchema)
    const { rollout, health } = await transitionRolloutAction(body, actor.userId, req)
    return governanceOk({ rollout, ...(health ? { health } : {}) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function recordAttestationRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, attestationSchema)
    return governanceOk(await recordAttestationAction(body, actor.userId, req), 201)
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function changeAutonomyRoute(req: Request, { params }: IdContext): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const { id } = await params
    const body = await readJsonBody(req, autonomyChangeSchema)
    const result = await changeAutonomyAction(id, body, actor.userId, req)
    // A blocked promotion is a refusal with its reasons, not a server error.
    return governanceOk({ change: result }, result.outcome === "BLOCKED" ? 409 : 200)
  } catch (err) {
    return governanceErrorResponse(err)
  }
}

export async function verifyLedgerRoute(req: Request): Promise<Response> {
  try {
    const actor = await requireGovernanceOperator(req)
    const body = await readJsonBody(req, ledgerVerifySchema)
    return governanceOk({ verification: await verifyLedgerAction(body, actor.userId, req) })
  } catch (err) {
    return governanceErrorResponse(err)
  }
}
