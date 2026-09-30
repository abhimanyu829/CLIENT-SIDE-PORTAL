/**
 * lib/agent-gateway/authorization/precedence.ts
 *
 * Deterministic precedence resolution over the set of policy versions
 * whose scope+capability MATCH the current AuthorizationContext (matching
 * itself happens in engine.ts; this module only orders/reduces an
 * already-matched candidate set).
 *
 * Precedence order (exact, per the Phase 6 spec):
 *   1. hard security deny            — handled entirely in engine.ts BEFORE
 *                                       any policy is consulted (identity/
 *                                       connection/environment/capability
 *                                       existence checks). Not represented
 *                                       here as a "policy" at all.
 *   2. explicit resource deny        — scope=RESOURCE, effect=DENY
 *   3. explicit connection deny      — scope=CONNECTION, effect=DENY
 *   4. explicit capability deny      — scope=CAPABILITY, effect=DENY
 *   5. explicit approval requirement — effect=REQUIRES_APPROVAL (any scope)
 *   6. most specific allow           — narrowest matching scope, effect=ALLOW
 *   7. broader allow                 — wider matching scope, effect=ALLOW
 *   8. default deny                  — no candidate matched at all
 *
 * "Most specific" is defined by an explicit scope-specificity ranking
 * (higher = more specific), NOT by insertion order or "last policy wins"
 * — the spec explicitly forbids nondeterministic/contradictory precedence.
 * Within the same specificity rank, `AgentPolicy.priority` (higher wins)
 * breaks ties; if priority also ties, the lexicographically smaller
 * `policyId` wins (a fully deterministic, arbitrary-but-stable tiebreak —
 * never "whichever the DB happened to return first").
 */
import type { PolicyScope, ResolvedPolicyVersion } from "./types"

/** Higher number = more specific. RESOURCE is the narrowest possible match; GLOBAL is the widest. */
const SCOPE_SPECIFICITY: Record<PolicyScope, number> = {
  RESOURCE: 7,
  CONNECTION: 6,
  CAPABILITY: 5,
  RESOURCE_TYPE: 4,
  TEAM: 3,
  OWNER: 2,
  ENVIRONMENT: 1,
  GLOBAL: 0,
}

function compareSpecificityDesc(a: ResolvedPolicyVersion, b: ResolvedPolicyVersion): number {
  const specDiff = SCOPE_SPECIFICITY[b.scope] - SCOPE_SPECIFICITY[a.scope]
  if (specDiff !== 0) return specDiff
  const prioDiff = b.policyPriority - a.policyPriority
  if (prioDiff !== 0) return prioDiff
  return a.policyId < b.policyId ? -1 : a.policyId > b.policyId ? 1 : 0
}

export interface PrecedenceResult {
  winner: ResolvedPolicyVersion | null
  /** Which precedence stage produced the winner — for observability/tracing only. */
  stage:
    | "RESOURCE_DENY"
    | "CONNECTION_DENY"
    | "CAPABILITY_DENY"
    | "APPROVAL_REQUIREMENT"
    | "MOST_SPECIFIC_ALLOW"
    | "DEFAULT_DENY"
}

/**
 * Reduces an already-matched candidate set to a single deterministic
 * winner, following the exact precedence order documented above.
 */
export function resolvePrecedence(candidates: ResolvedPolicyVersion[]): PrecedenceResult {
  const denies = candidates.filter((c) => c.effect === "DENY")
  const approvals = candidates.filter((c) => c.effect === "REQUIRES_APPROVAL")
  const allows = candidates.filter((c) => c.effect === "ALLOW")

  const resourceDeny = denies.filter((c) => c.scope === "RESOURCE").sort(compareSpecificityDesc)[0]
  if (resourceDeny) return { winner: resourceDeny, stage: "RESOURCE_DENY" }

  const connectionDeny = denies.filter((c) => c.scope === "CONNECTION").sort(compareSpecificityDesc)[0]
  if (connectionDeny) return { winner: connectionDeny, stage: "CONNECTION_DENY" }

  const capabilityDeny = denies.filter((c) => c.scope === "CAPABILITY").sort(compareSpecificityDesc)[0]
  if (capabilityDeny) return { winner: capabilityDeny, stage: "CAPABILITY_DENY" }

  // Any remaining explicit deny at any other scope still outranks approval/allow.
  const otherDeny = denies.sort(compareSpecificityDesc)[0]
  if (otherDeny) return { winner: otherDeny, stage: "CAPABILITY_DENY" }

  const approval = approvals.sort(compareSpecificityDesc)[0]
  if (approval) return { winner: approval, stage: "APPROVAL_REQUIREMENT" }

  const allow = allows.sort(compareSpecificityDesc)[0]
  if (allow) return { winner: allow, stage: "MOST_SPECIFIC_ALLOW" }

  return { winner: null, stage: "DEFAULT_DENY" }
}
