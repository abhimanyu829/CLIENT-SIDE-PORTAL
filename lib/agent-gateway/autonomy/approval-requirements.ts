/**
 * lib/agent-gateway/autonomy/approval-requirements.ts
 *
 * The declarative "mandatory approval" rules — the hard approval gates no
 * autonomy level can remove. They are derived ONLY from metadata that
 * earlier phases already defined (Phase 3 capability metadata, Phase 0's
 * risk classification), never from new business rules invented here.
 *
 * This is the "approval policy" of Phase 7, deliberately expressed as a
 * fixed, reviewable rule list in code rather than a second database policy
 * language: Phase 6 already owns the configurable, versioned policy
 * language (which can itself emit REQUIRES_APPROVAL), and per-connection
 * configurable approval lists live on AgentAutonomyPolicy.approvalRequiredFor.
 * A third configurable policy store would duplicate both.
 */
import type { CapabilityDefinition } from "../capabilities/types"

/** Phase 0 RISK-MATRIX / AI-EXPOSURE-CANDIDATES: money-moving domains are never unsupervised. */
const FINANCIAL_DOMAINS = new Set(["payments", "refunds", "billing", "payouts"])
const FINANCIAL_EFFECT_PATTERN = /payment|money|refund|billing|payout|charge/i

/** Deployment/provisioning mutations in production always need a human. */
const DEPLOYMENT_DOMAINS = new Set(["deployments", "deployment", "provisioning"])

export type MandatoryApprovalReason =
  | "CRITICAL_RISK_TIER"
  | "IRREVERSIBLE_OPERATION"
  | "FINANCIAL_OPERATION"
  | "PRODUCTION_DEPLOYMENT"

/**
 * Returns the first hard approval reason that applies, or null. Pure — the
 * same capability + environment always yields the same answer.
 */
export function mandatoryApprovalReason(capability: CapabilityDefinition, environment: string): MandatoryApprovalReason | null {
  const isMutation = capability.operationType !== "READ"

  if (capability.operationType === "CRITICAL") return "CRITICAL_RISK_TIER"
  if (isMutation && capability.rollback.reversibility === "IRREVERSIBLE") return "IRREVERSIBLE_OPERATION"
  if (
    isMutation &&
    (FINANCIAL_DOMAINS.has(capability.domain) || capability.sideEffects.effects.some((e) => FINANCIAL_EFFECT_PATTERN.test(e)))
  ) {
    return "FINANCIAL_OPERATION"
  }
  if (isMutation && environment === "production" && DEPLOYMENT_DOMAINS.has(capability.domain)) return "PRODUCTION_DEPLOYMENT"
  return null
}
