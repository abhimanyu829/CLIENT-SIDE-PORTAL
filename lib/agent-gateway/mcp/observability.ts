/**
 * lib/agent-gateway/mcp/observability.ts
 *
 * MCP-layer observability, reusing the EXISTING Phase 1 pino logger
 * (`lib/agent-gateway/observability/request-log.ts`'s `gatewayLogger`) —
 * no new logging library. This is explicitly NOT the Phase 11 audit
 * ledger.
 *
 * Only safe metadata is ever logged: requestId, connectionId,
 * capabilityId/toolName, protocolVersion, duration, result category,
 * error code. NEVER: tokens, credentials, signatures, authorization
 * headers, payment secrets, raw sensitive payloads.
 */
import { gatewayLogger } from "../observability/request-log"

export type McpEventKind =
  | "mcp_request_received"
  | "authentication_outcome"
  | "tool_discovered"
  | "tool_called"
  | "authorization_result"
  | "adapter_started"
  | "adapter_completed"
  | "adapter_failed"
  | "protocol_failure"
  | "disconnect"
  | "timeout"

export interface McpEventFields {
  event: McpEventKind | "authorization_result" | "adapter_started" | "adapter_completed" | "adapter_failed"
  requestId: string
  connectionId?: string
  toolName?: string
  protocolVersion?: string
  outcome?: "ALLOWED" | "DENIED" | "SUCCESS" | "FAILURE"
  errorCode?: string
  durationMs?: number
}

export function recordMcpEvent(fields: McpEventFields): void {
  const logFields = {
    requestId: fields.requestId,
    connectionId: fields.connectionId,
    toolName: fields.toolName,
    protocolVersion: fields.protocolVersion,
    outcome: fields.outcome,
    errorCode: fields.errorCode,
    durationMs: fields.durationMs,
  }
  if (fields.outcome === "DENIED" || fields.outcome === "FAILURE" || fields.event === "adapter_failed" || fields.event === "protocol_failure") {
    gatewayLogger.warn(logFields, fields.event)
  } else {
    gatewayLogger.info(logFields, fields.event)
  }
}
