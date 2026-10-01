/**
 * lib/agent-gateway/rollout/controls.ts
 *
 * Phase 15 — runtime release controls: kill switches and rollout stages.
 *
 * `evaluateRuntimeControls` is pure (rows in, verdict out); `checkRuntimeControls`
 * loads the rows. They are enforced at three points, all fail-closed:
 *
 *   1. ExecutionGate.evaluate — before authorization, autonomy and any
 *      approval creation or consumption (sync calls, task submission, worker
 *      re-verification, trigger firings, recoveries);
 *   2. AdapterResolver.execute — immediately before dispatch (defense in depth:
 *      a switch flipped between the gate decision and execution still stops it);
 *   3. MCP tools/list — capabilities the connection cannot use are not listed.
 *
 * Kill switch scopes: GLOBAL (everything), CAPABILITY (one capability id),
 * CONNECTION (one agent connection), RISK_TIER (every capability of a tier).
 *
 * Rollout stages (per capability and environment):
 *   DISABLED  nobody          INTERNAL  allowlisted connections only
 *   CANARY    allowlisted + a stable hash bucket of connections < canaryPercent
 *   GENERAL   everybody       PAUSED    nobody (health gate or operator)
 * A missing row is "legacy ACTIVE" unless AGENT_GATEWAY_ROLLOUT_ENFORCED is on,
 * in which case it is DISABLED.
 */
import { createHash } from "node:crypto"
import { getGatewayConfig } from "../config"
import { recordAuditThrottled } from "../audit-ledger/recorder"
import { countMetric } from "../observability/agent-metrics"
import { findActiveKillSwitches, findRollout } from "./store"
import type { KillSwitchRow, RolloutRow, RuntimeControlVerdict } from "./types"

export interface RuntimeControlSubject {
  capabilityId: string
  riskTier: string
  connectionId: string
  environment: string
}

/** Stable 0-99 bucket of one connection for one capability (same connection, same capability → same bucket). */
export function canaryBucket(connectionId: string, capabilityId: string): number {
  return createHash("sha256").update(`${connectionId}\u0000${capabilityId}`, "utf8").digest().readUInt32BE(0) % 100
}

export function killSwitchMatches(sw: Pick<KillSwitchRow, "scope" | "target" | "active">, subject: RuntimeControlSubject): boolean {
  if (!sw.active) return false
  switch (sw.scope) {
    case "GLOBAL":
      return true
    case "CAPABILITY":
      return sw.target === subject.capabilityId
    case "CONNECTION":
      return sw.target === subject.connectionId
    case "RISK_TIER":
      return sw.target === subject.riskTier
    default:
      return true // unknown scope: fail closed
  }
}

export function rolloutAdmits(rollout: Pick<RolloutRow, "stage" | "canaryPercent" | "allowedConnectionIds">, subject: RuntimeControlSubject): boolean {
  switch (rollout.stage) {
    case "GENERAL":
      return true
    case "CANARY":
      return rollout.allowedConnectionIds.includes(subject.connectionId) || canaryBucket(subject.connectionId, subject.capabilityId) < Math.max(0, Math.min(100, rollout.canaryPercent))
    case "INTERNAL":
      return rollout.allowedConnectionIds.includes(subject.connectionId)
    default:
      return false // DISABLED, PAUSED, unknown
  }
}

export function evaluateRuntimeControls(subject: RuntimeControlSubject, killSwitches: readonly KillSwitchRow[], rollout: RolloutRow | null, enforced: boolean): RuntimeControlVerdict {
  const sw = killSwitches.find((k) => k.environment === subject.environment && killSwitchMatches(k, subject))
  if (sw) return { allowed: false, code: "KILL_SWITCH_ACTIVE", detail: `${sw.scope} kill switch`, killSwitchRef: sw.publicRef, killSwitchScope: sw.scope }
  if (!rollout) return enforced ? { allowed: false, code: "ROLLOUT_BLOCKED", detail: "not released in this environment", stage: "DISABLED" } : { allowed: true, stage: "LEGACY" }
  if (!rolloutAdmits(rollout, subject)) return { allowed: false, code: "ROLLOUT_BLOCKED", detail: `rollout stage ${rollout.stage}`, stage: rollout.stage }
  return { allowed: true, stage: rollout.stage }
}

export interface RuntimeControlDeps {
  loadKillSwitches: (environment: string) => Promise<KillSwitchRow[]>
  loadRollout: (capabilityId: string, environment: string) => Promise<RolloutRow | null>
  enforced: () => boolean
}

const DEFAULT_DEPS: RuntimeControlDeps = {
  loadKillSwitches: findActiveKillSwitches,
  loadRollout: findRollout,
  enforced: () => getGatewayConfig().AGENT_GATEWAY_ROLLOUT_ENFORCED === true,
}

/** Loads and evaluates. A store failure is RELEASE_CONTROLS_UNAVAILABLE (never "allowed"). */
export async function checkRuntimeControls(subject: RuntimeControlSubject, deps: RuntimeControlDeps = DEFAULT_DEPS): Promise<RuntimeControlVerdict> {
  let killSwitches: KillSwitchRow[]
  let rollout: RolloutRow | null
  try {
    ;[killSwitches, rollout] = await Promise.all([deps.loadKillSwitches(subject.environment), deps.loadRollout(subject.capabilityId, subject.environment)])
  } catch {
    return { allowed: false, code: "RELEASE_CONTROLS_UNAVAILABLE", detail: "release controls could not be read" }
  }
  return evaluateRuntimeControls(subject, killSwitches, rollout, deps.enforced())
}

/** Evidence for a refusal: one throttled ledger event per connection / capability / code per minute, plus a metric. */
export function recordRuntimeControlRefusal(subject: RuntimeControlSubject & { requestId?: string; ownerId?: string }, verdict: Extract<RuntimeControlVerdict, { allowed: false }>, source: "GATE" | "RESOLVER"): void {
  try {
    countMetric("agent_security_denial_total", { reason: verdict.code })
    if (verdict.code === "RELEASE_CONTROLS_UNAVAILABLE") return
    if (verdict.code === "KILL_SWITCH_ACTIVE") countMetric("agent_kill_switch_block_total", { scope: verdict.killSwitchScope ?? "GLOBAL" })
    else countMetric("agent_rollout_block_total", { stage: verdict.stage ?? "NONE" })
    recordAuditThrottled(
      {
        action: verdict.code === "KILL_SWITCH_ACTIVE" ? "security.kill_switch_blocked" : "security.rollout_blocked",
        outcome: "DENIED",
        actor: { type: "AGENT", id: subject.connectionId },
        requestId: subject.requestId ?? null,
        connectionId: subject.connectionId,
        ownerId: subject.ownerId ?? null,
        capabilityId: subject.capabilityId,
        riskTier: subject.riskTier,
        environment: subject.environment,
        resultCode: verdict.code,
        metadata: { reasonCode: verdict.code, source, stage: verdict.stage, evidenceRef: verdict.killSwitchRef },
      },
      `release:${subject.connectionId}:${subject.capabilityId}:${verdict.code}`,
      60_000
    )
  } catch {
    // Evidence never changes the refusal.
  }
}

/**
 * The capability ids a connection may currently see (MCP tools/list). Any
 * failure hides everything that is subject to the controls (fail closed).
 */
export async function visibleCapabilities(
  connectionId: string,
  environment: string,
  capabilities: ReadonlyArray<{ id: string; operationType: string }>,
  deps: RuntimeControlDeps = DEFAULT_DEPS
): Promise<Set<string>> {
  const visible = new Set<string>()
  let killSwitches: KillSwitchRow[]
  try {
    killSwitches = await deps.loadKillSwitches(environment)
  } catch {
    return visible
  }
  const enforced = deps.enforced()
  await Promise.all(
    capabilities.map(async (c) => {
      try {
        const rollout = await deps.loadRollout(c.id, environment)
        if (evaluateRuntimeControls({ capabilityId: c.id, riskTier: c.operationType, connectionId, environment }, killSwitches, rollout, enforced).allowed) visible.add(c.id)
      } catch {
        // hidden
      }
    })
  )
  return visible
}
