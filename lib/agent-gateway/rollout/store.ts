/**
 * lib/agent-gateway/rollout/store.ts — Phase 15 persistence (AgentRollout,
 * AgentKillSwitch). No cache, deliberately: a kill switch or a rollback
 * takes effect on the very next gated call, like the autonomy store.
 */
import { randomBytes } from "node:crypto"
import { db } from "@/lib/db"
import type { KillSwitchRow, KillSwitchScope, RolloutRow, RolloutStage } from "./types"

export const KILL_SWITCH_REF_PATTERN = /^ksw_[0-9a-f]{32}$/

export function generateKillSwitchRef(): string {
  return `ksw_${randomBytes(16).toString("hex")}`
}

export async function findActiveKillSwitches(environment: string): Promise<KillSwitchRow[]> {
  return (await db.agentKillSwitch.findMany({ where: { environment, active: true }, orderBy: { activatedAt: "desc" }, take: 200 })) as KillSwitchRow[]
}

export async function listKillSwitches(environment: string, take = 100): Promise<KillSwitchRow[]> {
  return (await db.agentKillSwitch.findMany({ where: { environment }, orderBy: { activatedAt: "desc" }, take })) as KillSwitchRow[]
}

export async function findKillSwitchByRef(publicRef: string): Promise<KillSwitchRow | null> {
  if (!KILL_SWITCH_REF_PATTERN.test(publicRef)) return null
  return ((await db.agentKillSwitch.findUnique({ where: { publicRef } })) as KillSwitchRow | null) ?? null
}

export async function createKillSwitch(input: { scope: KillSwitchScope; target: string | null; environment: string; reason: string; actorId: string; now: Date }): Promise<KillSwitchRow> {
  return (await db.agentKillSwitch.create({
    data: {
      publicRef: generateKillSwitchRef(),
      scope: input.scope,
      target: input.target,
      environment: input.environment,
      active: true,
      reason: input.reason,
      activatedById: input.actorId,
      activatedAt: input.now,
    },
  })) as KillSwitchRow
}

/** Conditional on the expected version and on still being active. */
export async function deactivateKillSwitch(id: string, expectedVersion: number, actorId: string, reason: string, now: Date): Promise<boolean> {
  const result = await db.agentKillSwitch.updateMany({
    where: { id, version: expectedVersion, active: true },
    data: { active: false, deactivatedById: actorId, deactivatedAt: now, deactivationReason: reason, version: { increment: 1 } },
  })
  return result.count === 1
}

export async function findRollout(capabilityId: string, environment: string): Promise<RolloutRow | null> {
  return ((await db.agentRollout.findUnique({ where: { capabilityId_environment: { capabilityId, environment } } })) as RolloutRow | null) ?? null
}

export async function listRollouts(environment: string): Promise<RolloutRow[]> {
  return (await db.agentRollout.findMany({ where: { environment }, orderBy: { capabilityId: "asc" }, take: 500 })) as RolloutRow[]
}

export async function createRollout(input: { capabilityId: string; environment: string; canaryPercent: number; allowedConnectionIds: string[]; actorId: string }): Promise<RolloutRow> {
  return (await db.agentRollout.create({
    data: { capabilityId: input.capabilityId, environment: input.environment, stage: "DISABLED", canaryPercent: input.canaryPercent, allowedConnectionIds: input.allowedConnectionIds, updatedById: input.actorId },
  })) as RolloutRow
}

export interface RolloutPatch {
  stage?: RolloutStage
  canaryPercent?: number
  allowedConnectionIds?: string[]
  pausedFromStage?: RolloutStage | null
  pausedReason?: string | null
}

/** Optimistic concurrency: applies only if the row is still at `expectedVersion` (and, if given, at `expectedStage`). */
export async function updateRollout(id: string, expectedVersion: number, patch: RolloutPatch, actorId: string, expectedStage?: RolloutStage): Promise<boolean> {
  const result = await db.agentRollout.updateMany({
    where: { id, version: expectedVersion, ...(expectedStage ? { stage: expectedStage } : {}) },
    data: { ...patch, updatedById: actorId, version: { increment: 1 } },
  })
  return result.count === 1
}
