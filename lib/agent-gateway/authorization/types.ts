/**
 * lib/agent-gateway/authorization/types.ts
 *
 * Phase 6 — core authorization types. This module defines the DATA SHAPES
 * only — no evaluation logic lives here (see engine.ts / policy-language.ts).
 *
 * AuthorizationContext deliberately mirrors, rather than replaces, Phase
 * 4's `AgentExecutionContext` (execution/contracts/execution-context.ts):
 * every trusted identity field here is copied verbatim from that same
 * already-verified source. This module never re-derives identity from
 * anything client-supplied.
 */
import type { AgentConnectionStatusValue } from "../shared/types"
import type { RiskTier } from "../capabilities/types"

// ── Decision model ──────────────────────────────────────────────────────

/**
 * The four decision outcomes required by the Phase 6 spec. Note
 * `POLICY_UNAVAILABLE` is a DISTINCT reason from `DENY` for observability
 * (so an operator can tell "a policy explicitly denied this" apart from
 * "the policy subsystem itself failed") — but at the ENFORCEMENT boundary
 * (authorizer.ts), POLICY_UNAVAILABLE is treated identically to DENY:
 * it always throws. There is no code path that treats POLICY_UNAVAILABLE
 * as anything other than a failure to authorize.
 */
export type AuthorizationDecisionKind = "ALLOW" | "DENY" | "REQUIRES_APPROVAL" | "POLICY_UNAVAILABLE"

/**
 * Stable, non-leaking reason codes (Phase 6 spec's explicit list, plus a
 * few this engine's own precedence stages need). Never includes policy
 * names, other tenants' identifiers, or any free-text detail that could
 * disclose whether a specific resource/policy exists to an unauthorized
 * caller — see errors.ts's external-facing mapping.
 */
export type AuthorizationReasonCode =
  | "IDENTITY_INVALID"
  | "CONNECTION_SUSPENDED"
  | "CONNECTION_REVOKED"
  | "CONNECTION_EXPIRED"
  | "CAPABILITY_NOT_ALLOWED"
  | "CAPABILITY_UNKNOWN"
  | "CAPABILITY_DISABLED"
  | "RESOURCE_OUT_OF_SCOPE"
  | "ENVIRONMENT_MISMATCH"
  | "RISK_TIER_EXCEEDED"
  | "POLICY_ALLOW"
  | "POLICY_DENY"
  | "APPROVAL_REQUIRED"
  | "POLICY_UNAVAILABLE"
  | "DEFAULT_DENY_NO_POLICY"
  | "HARD_SECURITY_DENY"

export interface AuthorizationDecision {
  decision: AuthorizationDecisionKind
  reasonCode: AuthorizationReasonCode
  /** Safe, human-readable detail. Never includes secrets or other tenants' data. */
  message: string
  /** Which policy (if any) produced this decision — for tracing, not for external disclosure. */
  matchedPolicyId?: string
  matchedPolicyVersionId?: string
  matchedPolicyVersion?: number
  /** Evaluation wall-clock duration, for observability only. */
  evaluationDurationMs?: number
}

// ── Input context ───────────────────────────────────────────────────────

/**
 * Everything the evaluator needs to make a decision. Every identity field
 * (`connectionId`, `ownerId`, `teamId`, `agentId`, `connectionStatus`,
 * `environment`) MUST be copied from an already-verified source
 * (`AgentExecutionContext`, itself built exclusively from Phase 2's
 * verified `AgentMachineIdentity` — see execution/resolver/build-execution-context.ts).
 * Nothing in this shape is ever read directly from a client-supplied
 * request field.
 */
export interface AuthorizationContext {
  requestId: string
  connectionId: string
  agentId?: string
  ownerId: string
  teamId?: string | null
  connectionStatus: AgentConnectionStatusValue

  environment: string

  capabilityId: string
  capabilityVersion: number
  capabilityRiskTier: RiskTier
  capabilityResourceType?: string

  /**
   * Best-effort resource identifier, derived by the caller (authorizer.ts)
   * from the capability's own declared `resource.resourceLocator` field
   * name looked up in the raw tool-call input — NEVER trusted as an
   * ownership proof by itself. This engine only uses it for RESOURCE-scope
   * policy MATCHING (e.g. "this policy applies to resource X"), never as
   * a substitute for Phase 4's own DB-level ownership check, which remains
   * the sole authority for "does this resource actually belong to this
   * caller." See docs/agent-gateway/phase-6/03-resource-scope-boundary.md.
   */
  resourceId?: string

  existingPermission?: string | null

  authenticationStrength: "BEARER" | "SIGNED_REQUEST"

  timestamp: Date
}

// ── Policy model (mirrors the Prisma shape, decoupled from @prisma/client) ──

export type PolicyEffect = "ALLOW" | "DENY" | "REQUIRES_APPROVAL"
export type PolicyScope = "GLOBAL" | "OWNER" | "TEAM" | "CONNECTION" | "CAPABILITY" | "RESOURCE_TYPE" | "RESOURCE" | "ENVIRONMENT"
export type PolicyVersionStatus = "ACTIVE" | "DISABLED" | "SUPERSEDED"

/** A resolved, ready-to-evaluate policy version — the unit the engine actually consumes. */
export interface ResolvedPolicyVersion {
  policyId: string
  policyVersionId: string
  version: number
  policyName: string
  policyEnabled: boolean
  policyPriority: number
  status: PolicyVersionStatus
  effect: PolicyEffect
  scope: PolicyScope
  scopeValue: string | null
  capabilityId: string | null
  conditions: ConditionNode | null
  riskConstraint: RiskTier | null
  approvalRequirement: boolean
}

// ── Declarative condition language (see policy-language.ts for the evaluator) ──

export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "exists"
  | "greaterThan"
  | "lessThan"

export interface ConditionLeaf {
  operator: ConditionOperator
  /** Dot-free attribute name, resolved against a fixed, known attribute bag — see policy-language.ts's ATTRIBUTE_RESOLVERS. Never a free-form expression. */
  attribute: string
  /** Absent for "exists". */
  value?: string | number | boolean | Array<string | number>
}

export interface ConditionAnd {
  and: ConditionNode[]
}

export interface ConditionOr {
  or: ConditionNode[]
}

export interface ConditionNot {
  not: ConditionNode
}

/** A constrained JSON tree. No branch here can ever hold executable code. */
export type ConditionNode = ConditionLeaf | ConditionAnd | ConditionOr | ConditionNot
