/**
 * lib/agent-gateway/authorization/index.ts
 *
 * Barrel re-exports for the Phase 6 authorization module, mirroring the
 * exact convention of Phase 3/4/5's own index.ts files.
 */
export type {
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationDecisionKind,
  AuthorizationReasonCode,
  PolicyEffect,
  PolicyScope,
  PolicyVersionStatus,
  ResolvedPolicyVersion,
  ConditionNode,
  ConditionLeaf,
  ConditionAnd,
  ConditionOr,
  ConditionNot,
  ConditionOperator,
} from "./types"

export { evaluateCondition, assertWellFormedCondition, ALLOWED_ATTRIBUTES } from "./policy-language"
export { resolvePrecedence } from "./precedence"
export type { PrecedenceResult } from "./precedence"
export { evaluate } from "./engine"
export type { PolicySet } from "./engine"
export { toAuthorizationError } from "./errors"
export { recordAuthorizationEvent } from "./observability"
export type { AuthorizationEventFields } from "./observability"
export { KNOWN_HUMAN_PERMISSIONS, isKnownHumanPermission } from "./rbac-bridge"
export {
  loadActivePolicySet,
  invalidatePolicyCache,
  createPolicyVersion,
  disablePolicy,
  enablePolicy,
  rollbackToVersion,
} from "./policy-store"
export type { CreatePolicyVersionInput } from "./policy-store"
export { buildAuthorizationContext } from "./context-builder"
export { PolicyEngineAuthorizer } from "./authorizer"
export { simulateAuthorization } from "./simulate"
export { seedBaselineReadPolicies } from "./seed"
export type { SeedResult } from "./seed"
