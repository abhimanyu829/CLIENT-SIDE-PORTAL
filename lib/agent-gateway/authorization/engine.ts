/**
 * lib/agent-gateway/authorization/engine.ts
 *
 * The deterministic policy evaluator: `evaluate(context, policySet) ->
 * AuthorizationDecision`. Pure, side-effect-free — no I/O, no DB, no
 * Redis, no network calls, no mutation. Fetching the policy set is
 * policy-store.ts's job; this module only decides given data already in
 * hand.
 *
 * Evaluation order (spec's exact numbered layers 1-14):
 *   1. authentication validity        — caller already authenticated (Phase 1);
 *                                        this engine assumes `context` was only
 *                                        ever built from an authenticated request.
 *   2. connection status              — must be ACTIVE
 *   3. environment                    — must be a recognized value (non-empty)
 *   4. capability existence           — asserted by the caller (authorizer.ts
 *                                        only calls this engine for a resolved,
 *                                        Phase-3-known capability)
 *   5. capability exposure            — asserted by the caller (Phase 5's
 *                                        tool-projection already filters to
 *                                        AGENT_AVAILABLE+ACTIVE before any
 *                                        authorize() call happens)
 *   6. hard security deny             — steps 2-3 above ARE this engine's hard
 *                                        security denies; nothing overrides them
 *   7. connection-level permission    — scope=CONNECTION policies
 *   8. owner/team scope               — scope=OWNER / scope=TEAM policies
 *   9. resource scope                 — scope=RESOURCE / scope=RESOURCE_TYPE
 *  10. existing permission compat.    — ConditionLeaf against existingPermission
 *  11. risk restrictions              — riskConstraint field on matched versions
 *  12. policy conditions              — evaluateCondition() over the ABAC tree
 *  13. approval requirement marker    — effect=REQUIRES_APPROVAL
 *  14. final decision                 — resolvePrecedence()
 *
 * Steps 7-12 aren't separate sequential gates in this implementation —
 * they're different DIMENSIONS a single candidate policy version must
 * match on simultaneously (scope match AND capability match AND risk
 * constraint AND declarative conditions), then step 14's precedence
 * resolver picks the deterministic winner among everything that matched.
 * This is equivalent to running them as sequential gates (a policy that
 * fails any one dimension is simply never a candidate at all) but avoids
 * re-implementing the same "did this policy match" logic six times.
 */
import type { AuthorizationContext, AuthorizationDecision, ResolvedPolicyVersion } from "./types"
import { evaluateCondition } from "./policy-language"
import { resolvePrecedence } from "./precedence"

const RISK_ORDER: Record<string, number> = { READ: 0, LOW_RISK_WRITE: 1, HIGH_RISK_MUTATION: 2, CRITICAL: 3 }

function riskExceeds(actual: string, constraint: string): boolean {
  const a = RISK_ORDER[actual] ?? 99
  const c = RISK_ORDER[constraint] ?? -1
  return a > c
}

function scopeMatches(ctx: AuthorizationContext, policy: ResolvedPolicyVersion): boolean {
  // Capability filter applies independently of scope — if a version
  // declares a capabilityId, it only ever applies to that one capability,
  // regardless of scope level. Per spec: "Never infer permission merely
  // because another capability in the same domain is allowed."
  if (policy.capabilityId !== null && policy.capabilityId !== ctx.capabilityId) return false

  switch (policy.scope) {
    case "GLOBAL":
      return true
    case "OWNER":
      return policy.scopeValue === ctx.ownerId
    case "TEAM":
      return ctx.teamId != null && policy.scopeValue === ctx.teamId
    case "CONNECTION":
      return policy.scopeValue === ctx.connectionId
    case "CAPABILITY":
      return policy.capabilityId === ctx.capabilityId
    case "RESOURCE_TYPE":
      return ctx.capabilityResourceType != null && policy.scopeValue === ctx.capabilityResourceType
    case "RESOURCE":
      return ctx.resourceId != null && policy.scopeValue === ctx.resourceId
    case "ENVIRONMENT":
      return policy.scopeValue === ctx.environment
    default:
      return false
  }
}

function versionMatches(ctx: AuthorizationContext, policy: ResolvedPolicyVersion): boolean {
  if (!policy.policyEnabled) return false
  if (policy.status !== "ACTIVE") return false
  if (!scopeMatches(ctx, policy)) return false
  if (policy.riskConstraint && riskExceeds(ctx.capabilityRiskTier, policy.riskConstraint)) {
    // A policy whose risk ceiling is exceeded by this capability simply
    // does not match at all — it neither allows nor denies; if nothing
    // ELSE matches, this correctly falls through to default deny.
    return false
  }
  if (!evaluateCondition(ctx, policy.conditions)) return false
  return true
}

/**
 * Hard security checks — evaluated before any policy is even consulted.
 * These can ONLY produce a DENY; nothing overrides them, no policy
 * exists that can flip a hard-security-deny into an ALLOW.
 */
function hardSecurityDeny(ctx: AuthorizationContext): AuthorizationDecision | null {
  if (!ctx.connectionId || !ctx.ownerId) {
    return { decision: "DENY", reasonCode: "IDENTITY_INVALID", message: "No verified machine identity is present." }
  }
  if (ctx.connectionStatus === "SUSPENDED") {
    return { decision: "DENY", reasonCode: "CONNECTION_SUSPENDED", message: "This connection is suspended." }
  }
  if (ctx.connectionStatus === "REVOKED") {
    return { decision: "DENY", reasonCode: "CONNECTION_REVOKED", message: "This connection has been revoked." }
  }
  if (ctx.connectionStatus === "EXPIRED") {
    return { decision: "DENY", reasonCode: "CONNECTION_EXPIRED", message: "This connection's identity has expired." }
  }
  if (ctx.connectionStatus === "PENDING") {
    return { decision: "DENY", reasonCode: "IDENTITY_INVALID", message: "This connection has not completed activation." }
  }
  if (!ctx.environment) {
    return { decision: "DENY", reasonCode: "ENVIRONMENT_MISMATCH", message: "No environment context is present." }
  }
  return null
}

export interface PolicySet {
  versions: ResolvedPolicyVersion[]
}

/**
 * The pure decision function. `policySet` is the FULL set of currently
 * ACTIVE, enabled policy versions the caller wants considered (typically
 * "everything" — filtering by capability/scope happens inside this
 * function, not by the caller pre-filtering, so precedence can correctly
 * consider cross-scope interactions).
 */
export function evaluate(ctx: AuthorizationContext, policySet: PolicySet): AuthorizationDecision {
  const startedAt = Date.now()

  const hardDeny = hardSecurityDeny(ctx)
  if (hardDeny) {
    return { ...hardDeny, evaluationDurationMs: Date.now() - startedAt }
  }

  const candidates = policySet.versions.filter((v) => versionMatches(ctx, v))

  if (candidates.length === 0) {
    return {
      decision: "DENY",
      reasonCode: "DEFAULT_DENY_NO_POLICY",
      message: `No policy authorizes capability "${ctx.capabilityId}" for this connection. Denying by default.`,
      evaluationDurationMs: Date.now() - startedAt,
    }
  }

  const { winner, stage } = resolvePrecedence(candidates)

  if (!winner) {
    return {
      decision: "DENY",
      reasonCode: "DEFAULT_DENY_NO_POLICY",
      message: `No policy authorizes capability "${ctx.capabilityId}" for this connection. Denying by default.`,
      evaluationDurationMs: Date.now() - startedAt,
    }
  }

  const base = {
    matchedPolicyId: winner.policyId,
    matchedPolicyVersionId: winner.policyVersionId,
    matchedPolicyVersion: winner.version,
    evaluationDurationMs: Date.now() - startedAt,
  }

  if (winner.effect === "DENY") {
    return { decision: "DENY", reasonCode: "POLICY_DENY", message: `Policy "${winner.policyName}" denies this operation.`, ...base }
  }
  if (winner.effect === "REQUIRES_APPROVAL" || winner.approvalRequirement) {
    return { decision: "REQUIRES_APPROVAL", reasonCode: "APPROVAL_REQUIRED", message: `Policy "${winner.policyName}" requires approval before this operation may proceed.`, ...base }
  }
  // winner.effect === "ALLOW" and no approval flag set.
  return { decision: "ALLOW", reasonCode: "POLICY_ALLOW", message: `Policy "${winner.policyName}" allows this operation.`, ...base }
}
