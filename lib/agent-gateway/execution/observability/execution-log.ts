/**
 * lib/agent-gateway/execution/observability/execution-log.ts
 *
 * Execution-time observability, reusing the EXISTING Phase 1 pino logger
 * (`lib/agent-gateway/observability/request-log.ts`'s `gatewayLogger`) —
 * no new logging library, no new ledger. This is explicitly NOT the
 * Phase 11 audit ledger — it is the same safe, structured logging
 * pattern Phase 1 already established, scoped to execution events.
 *
 * Never logged: bearer tokens, credentials, secrets, payment
 * credentials, raw authorization headers, or full request/response
 * payloads. Only the fixed, safe field set below is ever recorded.
 */
import { gatewayLogger } from "../../observability/request-log"

export interface ExecutionLogEvent {
  requestId: string
  connectionId?: string
  capabilityId: string
  capabilityVersion: number
  adapterId?: string
  durationMs: number
  outcome: "SUCCESS" | "FAILURE"
  errorCode?: string
  idempotencyReplay?: boolean
}

export function recordExecutionEvent(event: ExecutionLogEvent): void {
  const fields = {
    requestId: event.requestId,
    connectionId: event.connectionId,
    capabilityId: event.capabilityId,
    capabilityVersion: event.capabilityVersion,
    adapterId: event.adapterId,
    durationMs: event.durationMs,
    outcome: event.outcome,
    errorCode: event.errorCode,
    idempotencyReplay: event.idempotencyReplay,
  }
  if (event.outcome === "SUCCESS") {
    gatewayLogger.info(fields, "agent_gateway_capability_executed")
  } else {
    gatewayLogger.warn(fields, "agent_gateway_capability_execution_failed")
  }
}
