/**
 * lib/agent-gateway/rollout/promotion.ts
 *
 * Phase 15 — guarded autonomy changes for one agent connection, on top of
 * the Phase 7 autonomy store (a new policy version each time; history is
 * never edited).
 *
 * Promotion: exactly ONE level up the Phase 7 ladder
 *   OBSERVE_ONLY -> ASSISTED -> APPROVAL_REQUIRED -> LIMITED_AUTONOMY -> FULL_SCOPED_AUTONOMY
 * and only when every guard holds:
 *   - the connection is ACTIVE and in this environment;
 *   - no active kill switch applies to the connection (GLOBAL / CONNECTION);
 *   - the connection's health over the window is not UNHEALTHY / UNAVAILABLE,
 *     and no security event (task violation, refused input, injection,
 *     blocked outbound) was recorded for it;
 *   - promotion to LIMITED_AUTONOMY or above needs HEALTHY (enough evidence);
 *   - FULL_SCOPED_AUTONOMY is never reached by promotion in production.
 * The risk ceiling and every other field of the current policy are kept.
 * A refused promotion is evidence too (`autonomy.promotion_blocked`).
 *
 * Demotion: to any lower level, immediately, with no guard (making an agent
 * less autonomous is always allowed).
 */
import { db } from "@/lib/db"
import { recordAudit } from "../audit-ledger/recorder"
import { loadEffectiveAutonomyPolicy, setAutonomyPolicy } from "../autonomy/policy-store"
import { AUTONOMY_LEVELS, type AutonomyLevel } from "../autonomy/types"
import type { RiskTier } from "../capabilities/types"
import { GovernanceError, notFound } from "../governance/errors"
import { killSwitchMatches } from "./controls"
import { evaluateHealth, PROMOTION_MAX_SECURITY_EVENTS, type HealthReport } from "./health-gates"
import { findActiveKillSwitches } from "./store"

const NEEDS_HEALTHY: readonly AutonomyLevel[] = ["LIMITED_AUTONOMY", "FULL_SCOPED_AUTONOMY"]

export interface AutonomyChangeResult {
  outcome: "PROMOTED" | "DEMOTED" | "BLOCKED"
  levelFrom: AutonomyLevel
  levelTo: AutonomyLevel
  failedChecks: string[]
  health?: HealthReport
  policyVersion?: number
}

async function currentState(connectionId: string, environment: string) {
  const connection = await db.agentConnection.findUnique({ where: { id: connectionId }, select: { id: true, status: true, environment: true } })
  if (!connection || connection.environment !== environment) throw notFound("Connection")
  const policy = await loadEffectiveAutonomyPolicy(connectionId)
  const level = (policy && policy.status === "ACTIVE" ? policy.autonomyLevel : "OBSERVE_ONLY") as AutonomyLevel
  return { connection, policy, level }
}

export async function promoteAutonomy(input: { connectionId: string; reason: string; actorId: string; environment: string }, now: Date): Promise<AutonomyChangeResult> {
  const { connection, policy, level } = await currentState(input.connectionId, input.environment)
  const index = AUTONOMY_LEVELS.indexOf(level)
  if (index === AUTONOMY_LEVELS.length - 1) throw new GovernanceError("INVALID_STATE", "The connection is already at the highest autonomy level.")
  const target = AUTONOMY_LEVELS[index + 1]

  const failed: string[] = []
  if (connection.status !== "ACTIVE") failed.push("CONNECTION_NOT_ACTIVE")
  let switches = [] as Awaited<ReturnType<typeof findActiveKillSwitches>>
  try {
    switches = await findActiveKillSwitches(input.environment)
  } catch {
    failed.push("RELEASE_CONTROLS_UNAVAILABLE")
  }
  if (switches.some((s) => (s.scope === "GLOBAL" || s.scope === "CONNECTION") && killSwitchMatches(s, { capabilityId: "", riskTier: "", connectionId: input.connectionId, environment: input.environment }))) {
    failed.push("KILL_SWITCH_ACTIVE")
  }
  const health = await evaluateHealth({ connectionId: input.connectionId, environment: input.environment }, now, { securityLimit: PROMOTION_MAX_SECURITY_EVENTS })
  if (health.verdict === "UNHEALTHY" || health.verdict === "UNAVAILABLE") failed.push(...health.reasons.map((r) => (r.startsWith("HEALTH_") ? r : `HEALTH_${r}`)))
  if (NEEDS_HEALTHY.includes(target) && health.verdict !== "HEALTHY" && !failed.some((f) => f.startsWith("HEALTH_"))) failed.push("HEALTH_INSUFFICIENT_EVIDENCE")
  if (target === "FULL_SCOPED_AUTONOMY" && input.environment === "production") failed.push("FULL_AUTONOMY_NOT_PROMOTABLE_IN_PRODUCTION")

  if (failed.length > 0) {
    recordAudit({
      action: "autonomy.promotion_blocked",
      outcome: "DENIED",
      actor: { type: "HUMAN", id: input.actorId },
      connectionId: input.connectionId,
      environment: input.environment,
      autonomyLevel: level,
      metadata: { levelFrom: level, levelTo: target, failedChecks: failed, reason: input.reason, kind: health.verdict },
    })
    return { outcome: "BLOCKED", levelFrom: level, levelTo: level, failedChecks: failed, health }
  }

  const written = await setAutonomyPolicy({
    connectionId: input.connectionId,
    autonomyLevel: target,
    maxRiskTier: ((policy?.maxRiskTier as RiskTier | undefined) ?? "READ") as RiskTier,
    allowedCapabilityIds: policy?.allowedCapabilityIds ?? [],
    approvalRequiredFor: policy?.approvalRequiredFor ?? [],
    environmentScope: policy?.environmentScope ?? [],
    resourceScopeReference: policy?.resourceScopeReference ?? null,
    expiresAt: policy?.expiresAt ?? null,
    note: `Promoted ${level} -> ${target}: ${input.reason}`.slice(0, 500),
    actorId: input.actorId,
    ...(policy ? { expectedVersion: policy.version } : {}),
  })
  recordAudit({
    action: "autonomy.promoted",
    outcome: "SUCCESS",
    actor: { type: "HUMAN", id: input.actorId },
    connectionId: input.connectionId,
    environment: input.environment,
    autonomyLevel: target,
    autonomyPolicyVersion: written.version,
    metadata: { levelFrom: level, levelTo: target, reason: input.reason, kind: health.verdict },
  })
  return { outcome: "PROMOTED", levelFrom: level, levelTo: target, failedChecks: [], health, policyVersion: written.version }
}

export async function demoteAutonomy(input: { connectionId: string; targetLevel: AutonomyLevel; reason: string; actorId: string; environment: string }): Promise<AutonomyChangeResult> {
  const { policy, level } = await currentState(input.connectionId, input.environment)
  if (!(AUTONOMY_LEVELS as readonly string[]).includes(input.targetLevel)) throw new GovernanceError("VALIDATION_FAILED", "Unknown autonomy level.")
  if (AUTONOMY_LEVELS.indexOf(input.targetLevel) >= AUTONOMY_LEVELS.indexOf(level)) throw new GovernanceError("INVALID_STATE", "Demotion must lower the autonomy level.")
  const written = await setAutonomyPolicy({
    connectionId: input.connectionId,
    autonomyLevel: input.targetLevel,
    maxRiskTier: ((policy?.maxRiskTier as RiskTier | undefined) ?? "READ") as RiskTier,
    allowedCapabilityIds: policy?.allowedCapabilityIds ?? [],
    approvalRequiredFor: policy?.approvalRequiredFor ?? [],
    environmentScope: policy?.environmentScope ?? [],
    resourceScopeReference: policy?.resourceScopeReference ?? null,
    expiresAt: policy?.expiresAt ?? null,
    note: `Demoted ${level} -> ${input.targetLevel}: ${input.reason}`.slice(0, 500),
    actorId: input.actorId,
    ...(policy ? { expectedVersion: policy.version } : {}),
  })
  recordAudit({
    action: "autonomy.demoted",
    outcome: "SUCCESS",
    actor: { type: "HUMAN", id: input.actorId },
    connectionId: input.connectionId,
    environment: input.environment,
    autonomyLevel: input.targetLevel,
    autonomyPolicyVersion: written.version,
    metadata: { levelFrom: level, levelTo: input.targetLevel, reason: input.reason },
  })
  return { outcome: "DEMOTED", levelFrom: level, levelTo: input.targetLevel, failedChecks: [], policyVersion: written.version }
}
