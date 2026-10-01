/**
 * lib/agent-gateway/rollout/types.ts — Phase 15 release-control vocabulary.
 */

export const ROLLOUT_STAGES = ["DISABLED", "INTERNAL", "CANARY", "GENERAL", "PAUSED"] as const
export type RolloutStage = (typeof ROLLOUT_STAGES)[number]

/** The forward order of active stages; PAUSED sits outside it. */
export const STAGE_ORDER: readonly RolloutStage[] = ["DISABLED", "INTERNAL", "CANARY", "GENERAL"]

export const KILL_SWITCH_SCOPES = ["GLOBAL", "CAPABILITY", "CONNECTION", "RISK_TIER"] as const
export type KillSwitchScope = (typeof KILL_SWITCH_SCOPES)[number]

export const RISK_TIERS = ["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"] as const

export interface RolloutRow {
  id: string
  capabilityId: string
  environment: string
  stage: RolloutStage
  canaryPercent: number
  allowedConnectionIds: string[]
  pausedFromStage: RolloutStage | null
  pausedReason: string | null
  version: number
  updatedById: string
  createdAt: Date
  updatedAt: Date
}

export interface KillSwitchRow {
  id: string
  publicRef: string
  scope: KillSwitchScope
  target: string | null
  environment: string
  active: boolean
  reason: string
  activatedById: string
  activatedAt: Date
  deactivatedById: string | null
  deactivatedAt: Date | null
  deactivationReason: string | null
  version: number
}

/** Why an operation was refused by the release controls. */
export type RuntimeControlCode = "KILL_SWITCH_ACTIVE" | "ROLLOUT_BLOCKED" | "RELEASE_CONTROLS_UNAVAILABLE"

export type RuntimeControlVerdict =
  | { allowed: true; stage: RolloutStage | "LEGACY" }
  | { allowed: false; code: RuntimeControlCode; detail: string; killSwitchRef?: string; killSwitchScope?: KillSwitchScope; stage?: RolloutStage }
