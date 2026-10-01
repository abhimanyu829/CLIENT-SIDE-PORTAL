/**
 * lib/agent-gateway/governance/release.ts
 *
 * Phase 15 governance: kill switches, rollouts, release attestations and
 * guarded autonomy promotion. SUPER_ADMIN only (routes:
 * requireGovernanceOperator; pages: requireGovernanceViewer). Each action
 * calls one release service and records the human change in the existing
 * AuditLog (the services append the ledger events themselves).
 */
import { getCapabilityRegistry } from "../capabilities"
import { getGatewayConfig } from "../config"
import { ReleaseService } from "../rollout/release-service"
import { listAttestations, recordReleaseAttestation, type AttestationView } from "../rollout/attestations"
import { demoteAutonomy, promoteAutonomy, type AutonomyChangeResult } from "../rollout/promotion"
import { evaluateHealth, type HealthReport } from "../rollout/health-gates"
import { listKillSwitches, listRollouts } from "../rollout/store"
import type { KillSwitchRow, KillSwitchScope, RolloutRow, RolloutStage } from "../rollout/types"
import type { AutonomyLevel } from "../autonomy/types"
import { GOVERNANCE_AUDIT_ACTIONS, recordGovernanceAudit } from "./audit"
import { GovernanceError } from "./errors"

const environment = () => getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT
const service = () => new ReleaseService({ registry: getCapabilityRegistry(), environment: environment() })

export interface KillSwitchView {
  ref: string
  scope: KillSwitchScope
  target: string | null
  active: boolean
  reason: string
  activatedBy: string
  activatedAt: string
  deactivatedBy: string | null
  deactivatedAt: string | null
  version: number
}

export function toKillSwitchView(row: KillSwitchRow): KillSwitchView {
  return {
    ref: row.publicRef,
    scope: row.scope,
    target: row.target,
    active: row.active,
    reason: row.reason,
    activatedBy: row.activatedById,
    activatedAt: new Date(row.activatedAt).toISOString(),
    deactivatedBy: row.deactivatedById,
    deactivatedAt: row.deactivatedAt ? new Date(row.deactivatedAt).toISOString() : null,
    version: row.version,
  }
}

export interface RolloutView {
  capabilityId: string
  stage: RolloutStage
  canaryPercent: number
  cohort: string[]
  pausedFromStage: RolloutStage | null
  pausedReason: string | null
  version: number
  updatedBy: string
  updatedAt: string
}

export function toRolloutView(row: RolloutRow): RolloutView {
  return {
    capabilityId: row.capabilityId,
    stage: row.stage,
    canaryPercent: row.canaryPercent,
    cohort: [...row.allowedConnectionIds],
    pausedFromStage: row.pausedFromStage,
    pausedReason: row.pausedReason,
    version: row.version,
    updatedBy: row.updatedById,
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export interface ReleaseOverview {
  environment: string
  enforced: boolean
  killSwitches: KillSwitchView[]
  rollouts: Array<RolloutView & { health: HealthReport }>
  attestations: AttestationView[]
}

export async function getReleaseOverview(now = new Date()): Promise<ReleaseOverview> {
  const env = environment()
  const [switches, rollouts, attestations] = await Promise.all([listKillSwitches(env), listRollouts(env), listAttestations(env, 20)])
  const withHealth = await Promise.all(rollouts.map(async (r) => ({ ...toRolloutView(r), health: await evaluateHealth({ capabilityId: r.capabilityId, environment: env }, now) })))
  return { environment: env, enforced: getGatewayConfig().AGENT_GATEWAY_ROLLOUT_ENFORCED === true, killSwitches: switches.map(toKillSwitchView), rollouts: withHealth, attestations }
}

export async function activateKillSwitchAction(body: { scope: KillSwitchScope; target?: string; reason: string }, actorId: string, req?: Request): Promise<{ killSwitch: KillSwitchView; created: boolean }> {
  const { killSwitch, created } = await service().activateKillSwitch(body, actorId)
  if (created) {
    recordGovernanceAudit({ actorId, action: GOVERNANCE_AUDIT_ACTIONS.KILL_SWITCH_ACTIVATED, entity: "AgentKillSwitch", entityId: killSwitch.publicRef, after: { status: "ACTIVE", scope: killSwitch.scope }, reason: body.reason, req })
  }
  return { killSwitch: toKillSwitchView(killSwitch), created }
}

export async function deactivateKillSwitchAction(ref: string, body: { expectedVersion: number; reason: string }, actorId: string, req?: Request): Promise<KillSwitchView> {
  const row = await service().deactivateKillSwitch(ref, body.expectedVersion, body.reason, actorId)
  recordGovernanceAudit({ actorId, action: GOVERNANCE_AUDIT_ACTIONS.KILL_SWITCH_DEACTIVATED, entity: "AgentKillSwitch", entityId: row.publicRef, before: { status: "ACTIVE" }, after: { status: "INACTIVE", scope: row.scope }, reason: body.reason, req })
  return toKillSwitchView(row)
}

export async function configureRolloutAction(
  body: { capabilityId: string; canaryPercent: number; allowedConnectionIds: string[]; expectedVersion?: number; reason: string },
  actorId: string,
  req?: Request
): Promise<RolloutView> {
  const row = await service().configureRollout(body, actorId)
  recordGovernanceAudit({ actorId, action: GOVERNANCE_AUDIT_ACTIONS.ROLLOUT_CONFIGURED, entity: "AgentRollout", entityId: row.capabilityId, after: { status: row.stage, capabilityId: row.capabilityId, version: row.version }, reason: body.reason, req })
  return toRolloutView(row)
}

export async function transitionRolloutAction(
  body: { capabilityId: string; action: "advance" | "pause" | "resume" | "rollback"; targetStage?: RolloutStage; expectedVersion: number; reason: string },
  actorId: string,
  req?: Request
): Promise<{ rollout: RolloutView; health?: HealthReport }> {
  const { rollout, health } = await service().transitionRollout(body, actorId)
  recordGovernanceAudit({ actorId, action: GOVERNANCE_AUDIT_ACTIONS.ROLLOUT_TRANSITIONED, entity: "AgentRollout", entityId: rollout.capabilityId, after: { status: rollout.stage, capabilityId: rollout.capabilityId, version: rollout.version }, reason: body.reason, req })
  return { rollout: toRolloutView(rollout), health }
}

export async function recordAttestationAction(body: { capabilityId: string; confirmed: string[]; reason: string }, actorId: string, req?: Request): Promise<{ attestation: AttestationView; health: HealthReport }> {
  let known = false
  try {
    known = !!getCapabilityRegistry().get(body.capabilityId)
  } catch {
    known = false
  }
  if (!known) throw new GovernanceError("VALIDATION_FAILED", "Unknown capability.")
  const { view, health } = await recordReleaseAttestation({ capabilityId: body.capabilityId, environment: environment(), confirmed: body.confirmed, reason: body.reason, actorId }, new Date())
  recordGovernanceAudit({ actorId, action: GOVERNANCE_AUDIT_ACTIONS.RELEASE_ATTESTED, entity: "AgentAuditEvent", entityId: view.eventId, after: { ok: view.passed, capabilityId: view.capabilityId }, reason: body.reason, req })
  return { attestation: view, health }
}

export async function changeAutonomyAction(
  connectionId: string,
  body: { direction: "promote" | "demote"; targetLevel?: AutonomyLevel; reason: string },
  actorId: string,
  req?: Request
): Promise<AutonomyChangeResult> {
  const env = environment()
  const result =
    body.direction === "promote"
      ? await promoteAutonomy({ connectionId, reason: body.reason, actorId, environment: env }, new Date())
      : await demoteAutonomy({ connectionId, targetLevel: body.targetLevel!, reason: body.reason, actorId, environment: env })
  if (result.outcome !== "BLOCKED") {
    recordGovernanceAudit({ actorId, action: GOVERNANCE_AUDIT_ACTIONS.AUTONOMY_PROMOTION, entity: "AgentAutonomyPolicy", entityId: connectionId, before: { status: result.levelFrom }, after: { status: result.levelTo, version: result.policyVersion }, reason: body.reason, req })
  }
  return result
}
