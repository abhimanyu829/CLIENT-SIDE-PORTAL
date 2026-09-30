/**
 * lib/agent-gateway/autonomy/evaluator.ts
 *
 * `resolveAutonomyDecision()` — pure and deterministic. It performs no I/O and
 * executes nothing. It only decides whether an already-authorized operation
 * may run autonomously, needs a human approval, or is denied.
 *
 * Precedence (every earlier step can only make the outcome stricter):
 *   1. Policy data unavailable              -> POLICY_UNAVAILABLE
 *   2. Phase 6 DENY / POLICY_UNAVAILABLE    -> DENY / POLICY_UNAVAILABLE
 *   3. Capability not exposed / not active  -> DENY
 *   4. Stored policy malformed              -> DENY
 *   5. Environment outside policy scope     -> DENY
 *   6. Capability outside policy allowlist  -> DENY
 *  6b. Resource outside policy resource scope -> DENY
 *   7. Risk tier above policy ceiling       -> DENY
 *   8. Level matrix (may DENY or require approval)
 *   9. Mandatory approval gates (Phase 3 metadata, per-connection list,
 *      Phase 6 REQUIRES_APPROVAL)          -> REQUIRE_APPROVAL
 *  10. Otherwise                            -> ALLOW_AUTONOMOUS
 *
 * No autonomy level can turn a DENY into anything else, and no level can
 * remove a mandatory approval gate.
 */
import type { CapabilityDefinition, RiskTier } from "../capabilities/types"
import type { AuthorizationDecision } from "../authorization/types"
import { AUTONOMY_LEVELS, RISK_ORDER, type AutonomyDecision, type AutonomyLevel, type EffectiveAutonomyPolicy } from "./types"
import { mandatoryApprovalReason } from "./approval-requirements"

export interface AutonomyInput {
  capability: CapabilityDefinition
  authorization: AuthorizationDecision
  /** null = no usable stored policy exists (none, disabled, or superseded). */
  policy: EffectiveAutonomyPolicy | null
  /** True when the policy store itself failed — distinct from "no policy". */
  policyUnavailable?: boolean
  environment: string
  now: Date
  /** Resource the operation targets (from Phase 3 resource metadata), if any. */
  resourceType?: string | null
  resourceId?: string | null
}

/**
 * `resourceScopeReference` format: "<ResourceType>:<resourceId>" or
 * "<ResourceType>:*". Anything else is malformed. Returns null if in scope,
 * otherwise the denial reason.
 */
function resourceScopeViolation(
  scope: string,
  resourceType: string | null | undefined,
  resourceId: string | null | undefined
): "RESOURCE_OUT_OF_SCOPE" | "INVALID_AUTONOMY_POLICY" | null {
  const sep = scope.indexOf(":")
  if (sep <= 0 || sep === scope.length - 1) return "INVALID_AUTONOMY_POLICY"
  const scopeType = scope.slice(0, sep)
  const scopeId = scope.slice(sep + 1)
  if (!resourceType || resourceType !== scopeType) return "RESOURCE_OUT_OF_SCOPE"
  if (scopeId === "*") return null
  return resourceId === scopeId ? null : "RESOURCE_OUT_OF_SCOPE"
}

/** The default posture when a connection has no active autonomy policy: read-only, no mutations. */
const DEFAULT_LEVEL: AutonomyLevel = "OBSERVE_ONLY"
const DEFAULT_MAX_RISK: RiskTier = "READ"

function isAutonomyLevel(value: string): value is AutonomyLevel {
  return (AUTONOMY_LEVELS as readonly string[]).includes(value)
}

function isRiskTier(value: string): value is RiskTier {
  return Object.prototype.hasOwnProperty.call(RISK_ORDER, value)
}

function decision(
  outcome: AutonomyDecision["outcome"],
  reasonCode: AutonomyDecision["reasonCode"],
  effectiveLevel: AutonomyLevel,
  policyVersion: number | null,
  mandatoryApproval = false
): AutonomyDecision {
  return { outcome, reasonCode, effectiveLevel, policyVersion, mandatoryApproval }
}

export function resolveAutonomyDecision(input: AutonomyInput): AutonomyDecision {
  const { capability, authorization, environment, now } = input

  // 1. The store failed — never guess.
  if (input.policyUnavailable) return decision("POLICY_UNAVAILABLE", "POLICY_UNAVAILABLE", DEFAULT_LEVEL, null)

  // 2. Phase 6 is authoritative for "may this identity act at all".
  if (authorization.decision === "POLICY_UNAVAILABLE") return decision("POLICY_UNAVAILABLE", "POLICY_UNAVAILABLE", DEFAULT_LEVEL, null)
  if (authorization.decision !== "ALLOW" && authorization.decision !== "REQUIRES_APPROVAL") {
    return decision("DENY", "AUTHORIZATION_DENIED", DEFAULT_LEVEL, null)
  }

  // 3. Capability hard state (defense in depth — Phase 5 already filters).
  if (capability.exposure !== "AGENT_AVAILABLE" || capability.status !== "ACTIVE") {
    return decision("DENY", "CAPABILITY_UNAVAILABLE", DEFAULT_LEVEL, null)
  }

  // Resolve the effective policy. Absent, disabled, superseded or expired
  // policies all collapse to the default read-only posture.
  const stored = input.policy
  const usable = stored !== null && stored.status === "ACTIVE" && (stored.expiresAt === null || stored.expiresAt.getTime() > now.getTime())

  // 4. A stored policy with an unknown level or risk tier is malformed — deny.
  if (usable && (!isAutonomyLevel(stored.autonomyLevel) || !isRiskTier(stored.maxRiskTier))) {
    return decision("DENY", "INVALID_AUTONOMY_POLICY", DEFAULT_LEVEL, stored.version)
  }

  const level: AutonomyLevel = usable ? (stored.autonomyLevel as AutonomyLevel) : DEFAULT_LEVEL
  const maxRisk: RiskTier = usable ? (stored.maxRiskTier as RiskTier) : DEFAULT_MAX_RISK
  const version = usable ? stored.version : null
  const risk = capability.operationType

  if (!isRiskTier(risk)) return decision("DENY", "CAPABILITY_UNAVAILABLE", level, version)

  if (usable) {
    // 5. Environment scope.
    if (stored.environmentScope.length > 0 && !stored.environmentScope.includes(environment)) {
      return decision("DENY", "ENVIRONMENT_BLOCKED", level, version)
    }
    // 6. Capability allowlist.
    if (stored.allowedCapabilityIds.length > 0 && !stored.allowedCapabilityIds.includes(capability.id)) {
      return decision("DENY", "CAPABILITY_OUT_OF_SCOPE", level, version)
    }
    // 6b. Resource scope (narrows only — Phase 6 remains the authority on access).
    if (stored.resourceScopeReference) {
      const violation = resourceScopeViolation(stored.resourceScopeReference, input.resourceType, input.resourceId)
      if (violation) return decision("DENY", violation, level, version)
    }
  }

  // 7. Risk ceiling.
  if (RISK_ORDER[risk] > RISK_ORDER[maxRisk]) return decision("DENY", "RISK_ABOVE_AUTONOMY_THRESHOLD", level, version)

  // 8. Level matrix: which tiers may run autonomously, which may be
  //    requested with approval, which are refused outright.
  let levelOutcome: "ALLOW" | "APPROVAL" | "DENY"
  switch (level) {
    case "OBSERVE_ONLY":
      levelOutcome = risk === "READ" ? "ALLOW" : "DENY"
      break
    case "ASSISTED":
      levelOutcome = risk === "READ" ? "ALLOW" : risk === "LOW_RISK_WRITE" ? "APPROVAL" : "DENY"
      break
    case "APPROVAL_REQUIRED":
      levelOutcome = risk === "READ" ? "ALLOW" : "APPROVAL"
      break
    case "LIMITED_AUTONOMY":
      levelOutcome = RISK_ORDER[risk] <= RISK_ORDER.LOW_RISK_WRITE ? "ALLOW" : "APPROVAL"
      break
    case "FULL_SCOPED_AUTONOMY":
      levelOutcome = "ALLOW"
      break
    default:
      levelOutcome = "DENY"
  }
  if (levelOutcome === "DENY") return decision("DENY", "AUTONOMY_DENIED", level, version)

  // 9. Mandatory approval gates — no level removes these.
  const hardReason = mandatoryApprovalReason(capability, environment)
  const connectionMandatory = usable && stored.approvalRequiredFor.includes(capability.id)
  if (hardReason || connectionMandatory) {
    return decision("REQUIRE_APPROVAL", "APPROVAL_REQUIRED_MANDATORY", level, version, true)
  }
  if (authorization.decision === "REQUIRES_APPROVAL") {
    return decision("REQUIRE_APPROVAL", "APPROVAL_REQUIRED_BY_AUTHORIZATION", level, version, true)
  }
  if (levelOutcome === "APPROVAL") return decision("REQUIRE_APPROVAL", "APPROVAL_REQUIRED_BY_LEVEL", level, version)

  // 10. Within pre-approved bounds.
  return decision("ALLOW_AUTONOMOUS", "AUTONOMOUS_WITHIN_BOUNDS", level, version)
}
