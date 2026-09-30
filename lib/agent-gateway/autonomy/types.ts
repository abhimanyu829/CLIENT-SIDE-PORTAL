/**
 * lib/agent-gateway/autonomy/types.ts
 *
 * Phase 7 — autonomy data shapes. Autonomy answers ONE question: "under
 * what pre-approved bounds may this connection act WITHOUT a fresh human
 * approval?" It never answers "may it act at all" (Phase 6) or "how is the
 * action performed" (Phase 4).
 */
import type { RiskTier } from "../capabilities/types"

/** Mirrors the Prisma `AgentAutonomyLevel` enum exactly — ordered from most to least restrictive. */
export const AUTONOMY_LEVELS = [
  "OBSERVE_ONLY",
  "ASSISTED",
  "APPROVAL_REQUIRED",
  "LIMITED_AUTONOMY",
  "FULL_SCOPED_AUTONOMY",
] as const

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]

/** Phase 3's own risk ordering (READ < LOW_RISK_WRITE < HIGH_RISK_MUTATION < CRITICAL). */
export const RISK_ORDER: Record<RiskTier, number> = {
  READ: 0,
  LOW_RISK_WRITE: 1,
  HIGH_RISK_MUTATION: 2,
  CRITICAL: 3,
}

/** The currently effective, already-resolved autonomy policy for one connection. */
export interface EffectiveAutonomyPolicy {
  id: string
  connectionId: string
  version: number
  status: "ACTIVE" | "SUPERSEDED" | "DISABLED"
  autonomyLevel: string // validated by the evaluator — a stored value is never trusted blindly
  maxRiskTier: string
  allowedCapabilityIds: string[]
  approvalRequiredFor: string[]
  environmentScope: string[]
  resourceScopeReference: string | null
  expiresAt: Date | null
}

export type AutonomyOutcome = "ALLOW_AUTONOMOUS" | "REQUIRE_APPROVAL" | "DENY" | "POLICY_UNAVAILABLE"

export type AutonomyReasonCode =
  | "AUTONOMOUS_WITHIN_BOUNDS"
  | "APPROVAL_REQUIRED_BY_LEVEL"
  | "APPROVAL_REQUIRED_MANDATORY"
  | "APPROVAL_REQUIRED_BY_AUTHORIZATION"
  | "AUTHORIZATION_DENIED"
  | "CAPABILITY_UNAVAILABLE"
  | "CAPABILITY_OUT_OF_SCOPE"
  | "RESOURCE_OUT_OF_SCOPE"
  | "ENVIRONMENT_BLOCKED"
  | "RISK_ABOVE_AUTONOMY_THRESHOLD"
  | "AUTONOMY_DENIED"
  | "INVALID_AUTONOMY_POLICY"
  | "POLICY_UNAVAILABLE"

export interface AutonomyDecision {
  outcome: AutonomyOutcome
  reasonCode: AutonomyReasonCode
  /** The level actually applied (OBSERVE_ONLY when no usable policy exists). */
  effectiveLevel: AutonomyLevel
  /** null when no stored policy applied (default OBSERVE_ONLY posture). */
  policyVersion: number | null
  /** True when a hard approval gate applied regardless of autonomy level. */
  mandatoryApproval: boolean
}
