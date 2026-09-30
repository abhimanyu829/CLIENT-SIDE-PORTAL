/**
 * lib/agent-gateway/autonomy/index.ts — Phase 7 autonomy barrel.
 */
export { AUTONOMY_LEVELS, RISK_ORDER } from "./types"
export type { AutonomyLevel, AutonomyDecision, AutonomyOutcome, AutonomyReasonCode, EffectiveAutonomyPolicy } from "./types"
export { resolveAutonomyDecision } from "./evaluator"
export type { AutonomyInput } from "./evaluator"
export { mandatoryApprovalReason } from "./approval-requirements"
export type { MandatoryApprovalReason } from "./approval-requirements"
export { loadEffectiveAutonomyPolicy, setAutonomyPolicy, disableAutonomyPolicy } from "./policy-store"
export type { SetAutonomyPolicyInput } from "./policy-store"
