/**
 * lib/agent-gateway/rollout/release-service.ts
 *
 * Phase 15 — the operator actions over the release controls, called only
 * from SUPER_ADMIN governance routes (and the maintenance pass for
 * auto-pause). Every change is conditional (optimistic concurrency) and is
 * appended to the audit ledger with the human actor and the reason.
 *
 *   kill switches   activate (idempotent per scope+target), deactivate
 *   rollouts        configure cohort; advance one stage at a time
 *                   (DISABLED -> INTERNAL -> CANARY -> GENERAL); pause;
 *                   resume to the paused-from stage; roll back to any
 *                   lower stage
 *   guards          INTERNAL needs a cohort; CANARY needs 1-50 %;
 *                   GENERAL and resume need a health gate that is not
 *                   UNHEALTHY / UNAVAILABLE; GENERAL in production needs a
 *                   current passed attestation
 *   auto-pause      INTERNAL / CANARY rollouts whose health gate is
 *                   UNHEALTHY are paused by the system (GENERAL is never
 *                   auto-paused: taking a capability away from everyone is
 *                   an operator decision — the kill switch)
 */
import { db } from "@/lib/db"
import { recordAudit } from "../audit-ledger/recorder"
import type { AuditAction } from "../audit-ledger/types"
import type { CapabilityRegistry } from "../capabilities/registry"
import { GovernanceError, conflict, notFound } from "../governance/errors"
import { hasCurrentAttestation } from "./attestations"
import { evaluateHealth, type HealthReport } from "./health-gates"
import {
  createKillSwitch,
  createRollout,
  deactivateKillSwitch,
  findActiveKillSwitches,
  findKillSwitchByRef,
  findRollout,
  listRollouts,
  updateRollout,
  type RolloutPatch,
} from "./store"
import { RISK_TIERS, STAGE_ORDER, type KillSwitchRow, type KillSwitchScope, type RolloutRow, type RolloutStage } from "./types"

export const MAX_CANARY_PERCENT = 50
export const MAX_COHORT = 50

const invalid = (message: string) => new GovernanceError("VALIDATION_FAILED", message)
const invalidState = (message: string) => new GovernanceError("INVALID_STATE", message)

export interface ReleaseServiceDeps {
  registry: CapabilityRegistry
  environment: string
  clock?: () => Date
}

export class ReleaseService {
  private readonly clock: () => Date
  constructor(private readonly deps: ReleaseServiceDeps) {
    this.clock = deps.clock ?? (() => new Date())
  }

  /** Registry lookup that treats a malformed id as unknown (the registry throws on malformed ids). */
  private capability(id: string) {
    try {
      return this.deps.registry.get(id)
    } catch {
      return null
    }
  }

  // ── Kill switches ────────────────────────────────────────────────────

  async activateKillSwitch(input: { scope: KillSwitchScope; target?: string | null; reason: string }, actorId: string): Promise<{ killSwitch: KillSwitchRow; created: boolean }> {
    const target = await this.validateKillSwitchTarget(input.scope, input.target ?? null)
    const env = this.deps.environment
    const existing = (await findActiveKillSwitches(env)).find((k) => k.scope === input.scope && (k.target ?? null) === target)
    if (existing) return { killSwitch: existing, created: false }
    const row = await createKillSwitch({ scope: input.scope, target, environment: env, reason: input.reason, actorId, now: this.clock() })
    await this.evidence({
      action: "kill_switch.activated",
      actorId,
      capabilityId: input.scope === "CAPABILITY" ? target : null,
      connectionId: input.scope === "CONNECTION" ? target : null,
      resourceRef: row.publicRef,
      metadata: { scope: input.scope, target: target ?? undefined, reason: input.reason },
    })
    return { killSwitch: row, created: true }
  }

  async deactivateKillSwitch(publicRef: string, expectedVersion: number, reason: string, actorId: string): Promise<KillSwitchRow> {
    const row = await findKillSwitchByRef(publicRef)
    if (!row || row.environment !== this.deps.environment) throw notFound("Kill switch")
    if (!row.active) throw invalidState("The kill switch is already inactive.")
    if (row.version !== expectedVersion || !(await deactivateKillSwitch(row.id, expectedVersion, actorId, reason, this.clock()))) throw conflict("kill switch")
    await this.evidence({
      action: "kill_switch.deactivated",
      actorId,
      capabilityId: row.scope === "CAPABILITY" ? row.target : null,
      connectionId: row.scope === "CONNECTION" ? row.target : null,
      resourceRef: row.publicRef,
      metadata: { scope: row.scope, target: row.target ?? undefined, reason },
    })
    return (await findKillSwitchByRef(publicRef))!
  }

  private async validateKillSwitchTarget(scope: KillSwitchScope, target: string | null): Promise<string | null> {
    switch (scope) {
      case "GLOBAL":
        if (target) throw invalid("A GLOBAL kill switch takes no target.")
        return null
      case "CAPABILITY":
        if (!target || !this.capability(target)) throw invalid("Unknown capability.")
        return target
      case "RISK_TIER":
        if (!target || !(RISK_TIERS as readonly string[]).includes(target)) throw invalid("Unknown risk tier.")
        return target
      case "CONNECTION": {
        if (!target || !/^[A-Za-z0-9_-]{1,64}$/.test(target)) throw invalid("Unknown connection.")
        const exists = await db.agentConnection.findUnique({ where: { id: target }, select: { id: true } })
        if (!exists) throw invalid("Unknown connection.")
        return target
      }
      default:
        throw invalid("Unknown kill switch scope.")
    }
  }

  // ── Rollouts ─────────────────────────────────────────────────────────

  async configureRollout(
    input: { capabilityId: string; canaryPercent: number; allowedConnectionIds: string[]; expectedVersion?: number; reason: string },
    actorId: string
  ): Promise<RolloutRow> {
    const def = this.capability(input.capabilityId)
    if (!def || def.exposure !== "AGENT_AVAILABLE") throw invalid("Only agent-available capabilities have a rollout.")
    if (!Number.isInteger(input.canaryPercent) || input.canaryPercent < 0 || input.canaryPercent > 100) throw invalid("canaryPercent must be 0-100.")
    const cohort = Array.from(new Set(input.allowedConnectionIds))
    if (cohort.length > MAX_COHORT) throw invalid(`At most ${MAX_COHORT} connections in a cohort.`)
    if (cohort.length > 0) {
      const found = await db.agentConnection.findMany({ where: { id: { in: cohort } }, select: { id: true } })
      if (found.length !== cohort.length) throw invalid("The cohort names an unknown connection.")
    }
    const env = this.deps.environment
    const current = await findRollout(def.id, env)
    if (!current) {
      if (input.expectedVersion !== undefined) throw conflict("rollout")
      let created: RolloutRow
      try {
        created = await createRollout({ capabilityId: def.id, environment: env, canaryPercent: input.canaryPercent, allowedConnectionIds: cohort, actorId })
      } catch {
        throw conflict("rollout")
      }
      await this.rolloutEvidence("rollout.configured", created, actorId, input.reason, null)
      return created
    }
    if (input.expectedVersion !== current.version) throw conflict("rollout")
    if (current.stage === "CANARY" && input.canaryPercent > MAX_CANARY_PERCENT) throw invalid(`A canary covers at most ${MAX_CANARY_PERCENT}% of connections; advance to GENERAL instead.`)
    if (current.stage === "INTERNAL" && cohort.length === 0) throw invalid("An INTERNAL rollout needs at least one connection.")
    if (!(await updateRollout(current.id, current.version, { canaryPercent: input.canaryPercent, allowedConnectionIds: cohort }, actorId))) throw conflict("rollout")
    const next = (await findRollout(def.id, env))!
    await this.rolloutEvidence("rollout.configured", next, actorId, input.reason, current.stage)
    return next
  }

  async transitionRollout(
    input: { capabilityId: string; action: "advance" | "pause" | "resume" | "rollback"; targetStage?: RolloutStage; expectedVersion: number; reason: string },
    actorId: string
  ): Promise<{ rollout: RolloutRow; health?: HealthReport }> {
    const env = this.deps.environment
    const current = await findRollout(input.capabilityId, env)
    if (!current) throw notFound("Rollout")
    if (current.version !== input.expectedVersion) throw conflict("rollout")
    const now = this.clock()
    let patch: RolloutPatch
    let action: "rollout.advanced" | "rollout.paused" | "rollout.resumed" | "rollout.rolled_back"
    let health: HealthReport | undefined

    switch (input.action) {
      case "advance": {
        const index = STAGE_ORDER.indexOf(current.stage)
        if (index < 0 || index === STAGE_ORDER.length - 1) throw invalidState(`A ${current.stage} rollout cannot advance${current.stage === "PAUSED" ? "; resume it first" : ""}.`)
        const to = STAGE_ORDER[index + 1]
        if (to === "INTERNAL" && current.allowedConnectionIds.length === 0) throw invalidState("Name the INTERNAL cohort before advancing.")
        if (to === "CANARY" && (current.canaryPercent < 1 || current.canaryPercent > MAX_CANARY_PERCENT)) throw invalidState(`Set canaryPercent to 1-${MAX_CANARY_PERCENT} before advancing to CANARY.`)
        if (to === "GENERAL") {
          health = await evaluateHealth({ capabilityId: current.capabilityId, environment: env }, now)
          if (health.verdict === "UNHEALTHY" || health.verdict === "UNAVAILABLE") throw invalidState(`The health gate is ${health.verdict} (${health.reasons.join(", ")}).`)
          if (env === "production" && !(await hasCurrentAttestation(current.capabilityId, env, now))) throw invalidState("GENERAL in production needs a passed release attestation from the last 7 days.")
        }
        patch = { stage: to }
        action = "rollout.advanced"
        break
      }
      case "pause":
        if (current.stage === "DISABLED" || current.stage === "PAUSED") throw invalidState(`A ${current.stage} rollout cannot be paused.`)
        patch = { stage: "PAUSED", pausedFromStage: current.stage, pausedReason: input.reason }
        action = "rollout.paused"
        break
      case "resume": {
        if (current.stage !== "PAUSED" || !current.pausedFromStage) throw invalidState("Only a paused rollout can be resumed.")
        health = await evaluateHealth({ capabilityId: current.capabilityId, environment: env }, now)
        if (health.verdict === "UNHEALTHY" || health.verdict === "UNAVAILABLE") throw invalidState(`The health gate is ${health.verdict} (${health.reasons.join(", ")}).`)
        patch = { stage: current.pausedFromStage, pausedFromStage: null, pausedReason: null }
        action = "rollout.resumed"
        break
      }
      case "rollback": {
        const from = current.stage === "PAUSED" ? current.pausedFromStage ?? "GENERAL" : current.stage
        const target = input.targetStage
        if (!target || !STAGE_ORDER.includes(target) || STAGE_ORDER.indexOf(target) >= STAGE_ORDER.indexOf(from)) throw invalid("Roll back to a stage below the current one.")
        patch = { stage: target, pausedFromStage: null, pausedReason: null }
        action = "rollout.rolled_back"
        break
      }
      default:
        throw invalid("Unknown rollout action.")
    }
    if (!(await updateRollout(current.id, current.version, patch, actorId, current.stage))) throw conflict("rollout")
    const next = (await findRollout(current.capabilityId, env))!
    await this.rolloutEvidence(action, next, actorId, input.reason, current.stage, health)
    return { rollout: next, health }
  }

  /** Maintenance pass: pauses INTERNAL / CANARY rollouts whose health gate is UNHEALTHY. Never throws. */
  async autoPauseUnhealthy(): Promise<Array<{ capabilityId: string; reasons: string[] }>> {
    const paused: Array<{ capabilityId: string; reasons: string[] }> = []
    const now = this.clock()
    let rollouts: RolloutRow[]
    try {
      rollouts = await listRollouts(this.deps.environment)
    } catch {
      return paused
    }
    for (const r of rollouts.filter((x) => x.stage === "INTERNAL" || x.stage === "CANARY")) {
      try {
        const health = await evaluateHealth({ capabilityId: r.capabilityId, environment: r.environment }, now)
        if (health.verdict !== "UNHEALTHY") continue
        const ok = await updateRollout(r.id, r.version, { stage: "PAUSED", pausedFromStage: r.stage, pausedReason: `auto-paused: ${health.reasons.join(", ")}` }, "system", r.stage)
        if (!ok) continue
        recordAudit({
          action: "rollout.auto_paused",
          outcome: "SUCCESS",
          actor: { type: "SYSTEM" },
          capabilityId: r.capabilityId,
          environment: r.environment,
          resourceType: "AgentRollout",
          resourceRef: r.capabilityId,
          metadata: { stage: "PAUSED", previousStage: r.stage, failedChecks: health.reasons, healthy: false, failureCount: health.serviceFailures },
        })
        paused.push({ capabilityId: r.capabilityId, reasons: health.reasons })
      } catch {
        // one rollout's failure never stops the pass
      }
    }
    return paused
  }

  private async rolloutEvidence(action: AuditAction, row: RolloutRow, actorId: string, reason: string, previousStage: RolloutStage | null, health?: HealthReport): Promise<void> {
    await this.evidence({
      action,
      actorId,
      capabilityId: row.capabilityId,
      connectionId: null,
      resourceRef: row.capabilityId,
      metadata: {
        stage: row.stage,
        previousStage: previousStage ?? undefined,
        percentage: row.canaryPercent,
        cohortSize: row.allowedConnectionIds.length,
        reason,
        ...(health ? { healthy: health.verdict === "HEALTHY" || health.verdict === "INSUFFICIENT_DATA", kind: health.verdict } : {}),
      },
    })
  }

  /**
   * Ledger evidence of a release-control change. Best effort, like every
   * governance change (the AuditLog row written by the governance action is
   * the primary record): an emergency stop must never fail because the
   * evidence store is down.
   */
  private async evidence(input: {
    action: AuditAction
    actorId: string
    capabilityId: string | null
    connectionId: string | null
    resourceRef: string
    metadata: Record<string, string | number | boolean | string[] | undefined>
  }): Promise<void> {
    recordAudit({
      action: input.action,
      outcome: "SUCCESS",
      actor: { type: "HUMAN", id: input.actorId },
      capabilityId: input.capabilityId,
      connectionId: input.connectionId,
      environment: this.deps.environment,
      resourceType: input.action.startsWith("kill_switch") ? "AgentKillSwitch" : "AgentRollout",
      resourceRef: input.resourceRef,
      metadata: input.metadata,
    })
  }
}
