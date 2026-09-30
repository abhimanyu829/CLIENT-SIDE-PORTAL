/**
 * lib/agent-gateway/execution-gate/observability.ts
 *
 * Safe operational metadata for Phase 7 decisions, through the existing
 * Phase 1 pino `gatewayLogger` (no new logging system, not the Phase 11
 * ledger). Never logs tokens, OTP codes, raw inputs or approval digests
 * beyond a short prefix.
 */
import { gatewayLogger } from "../observability/request-log"

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
}

export function recordGateEvent(fields: GateEventFields): void {
  const log = { ...fields }
  if (fields.outcome === "ALLOWED") {
    gatewayLogger.info(log, "agent_gateway_execution_gate")
  } else {
    gatewayLogger.warn(log, "agent_gateway_execution_gate")
  }
}
