/**
 * lib/agent-gateway/execution-gate/observability.ts
 *
 * Safe operational metadata for Phase 7 decisions, through the existing
 * Phase 1 pino `gatewayLogger` (no new logging system). Never logs tokens,
 * OTP codes, raw inputs or approval digests beyond a short prefix.
 *
 * Phase 11: every decision is also evidence. Each gate event is appended to
 * the audit ledger (AUTHORIZATION / APPROVAL categories) and counted in the
 * labelled metrics. The single exception is a stored result being read
 * back and still allowed (purpose "result_read"): an agent polling task
 * status would otherwise write one ledger event per poll, so only denials
 * of a result read are recorded.
 */
import { gatewayLogger } from "../observability/request-log"
import { recordAudit } from "../audit-ledger/recorder"
import type { AuditAction, AuditOutcome } from "../audit-ledger/types"
import { countMetric, observeMetric } from "../observability/agent-metrics"

export interface GateEventFields {
  requestId: string
  connectionId: string
  agentId?: string | null
  capabilityId: string
  capabilityVersion: number
  resourceType?: string | null
  resourceRef?: string | null
  riskTier: string
  autonomyLevel: string
  outcome: string
  reasonCode: string
  approvalRef?: string
  approvalState?: string
  durationMs: number
  // Phase 11 — ledger context (optional: absent fields are simply not recorded).
  ownerId?: string
  teamId?: string | null
  environment?: string
  purpose?: "decision" | "revalidation" | "result_read"
  authorizationDecision?: string
  authorizationPolicyRef?: string
  autonomyPolicyVersion?: number | null
  inputDigest?: string
  policyEvaluationMs?: number
}

function ledgerActionFor(fields: GateEventFields): { action: AuditAction; outcome: AuditOutcome } {
  if (fields.outcome === "ALLOWED") {
    return fields.reasonCode === "APPROVAL_CONSUMED" ? { action: "approval.consumed", outcome: "SUCCESS" } : { action: "authorization.allowed", outcome: "SUCCESS" }
  }
  if (fields.outcome === "APPROVAL_REQUIRED") return { action: "approval.required", outcome: "INFO" }
  if (fields.reasonCode === "APPROVAL_REQUIRED") return { action: "approval.required", outcome: "DENIED" }
  if (fields.reasonCode.startsWith("APPROVAL_")) return { action: "approval.refused", outcome: "DENIED" }
  if (fields.reasonCode === "POLICY_UNAVAILABLE") return { action: "authorization.unavailable", outcome: "FAILED" }
  return { action: "authorization.denied", outcome: "DENIED" }
}

function recordLedger(fields: GateEventFields): void {
  if (fields.purpose === "result_read" && fields.outcome === "ALLOWED") return
  const { action, outcome } = ledgerActionFor(fields)
  recordAudit({
    action,
    outcome,
    actor: { type: "AGENT", id: fields.connectionId },
    requestId: fields.requestId,
    connectionId: fields.connectionId,
    agentId: fields.agentId ?? null,
    ownerId: fields.ownerId ?? null,
    teamId: fields.teamId ?? null,
    capabilityId: fields.capabilityId,
    capabilityVersion: fields.capabilityVersion,
    riskTier: fields.riskTier,
    resourceType: fields.resourceType ?? null,
    resourceRef: fields.resourceRef ?? null,
    environment: fields.environment ?? null,
    authorizationDecision: fields.authorizationDecision ?? null,
    authorizationPolicyRef: fields.authorizationPolicyRef ?? null,
    autonomyLevel: fields.autonomyLevel,
    autonomyPolicyVersion: fields.autonomyPolicyVersion ?? null,
    approvalRef: fields.approvalRef ?? null,
    inputDigest: fields.inputDigest ?? null,
    resultCode: fields.reasonCode,
    metadata: { reasonCode: fields.reasonCode, approvalState: fields.approvalState, origin: fields.purpose, durationMs: fields.durationMs },
  })
}

function recordMetrics(fields: GateEventFields): void {
  countMetric("agent_authorization_total", { decision: fields.outcome, risk_tier: fields.riskTier })
  if (fields.outcome === "DENIED" && !fields.reasonCode.startsWith("APPROVAL_")) {
    countMetric("agent_security_denial_total", { reason: fields.reasonCode })
  }
  if (fields.reasonCode.startsWith("APPROVAL_")) countMetric("agent_approval_total", { outcome: fields.outcome })
  if (typeof fields.policyEvaluationMs === "number") {
    observeMetric("agent_policy_evaluation_duration_ms", fields.policyEvaluationMs, { decision: fields.authorizationDecision })
  }
}

export function recordGateEvent(fields: GateEventFields): void {
  const log = { ...fields }
  delete log.inputDigest
  if (fields.outcome === "ALLOWED") {
    gatewayLogger.info(log, "agent_gateway_execution_gate")
  } else {
    gatewayLogger.warn(log, "agent_gateway_execution_gate")
  }
  try {
    recordMetrics(fields)
    recordLedger(fields)
  } catch {
    // Evidence/metrics never change a decision.
  }
}
