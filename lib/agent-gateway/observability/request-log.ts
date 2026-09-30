/**
 * lib/agent-gateway/observability/request-log.ts
 *
 * Structured logging via the EXISTING pino logger (lib/logger.ts) — no
 * new logging library, no new transport. A dedicated child logger scopes
 * every gateway log line under module: "agent-gateway".
 *
 * NEVER logged: bearer tokens, HMAC secrets, OAuth client secrets, the
 * full Authorization header, raw signed payloads, or unnecessary
 * customer-sensitive payload content (Phase 1 spec §28).
 */
import { createLogger } from "@/lib/logger"

export const gatewayLogger = createLogger("agent-gateway")

export interface GatewayLogFields {
  requestId: string
  route?: string
  connectionId?: string
  agentId?: string
  authMethod?: string
  statusCode?: number
  errorCode?: string
  latencyMs?: number
}

export function logGatewayRequest(fields: GatewayLogFields, message: string): void {
  gatewayLogger.info(fields, message)
}

export function logGatewayDenial(fields: GatewayLogFields, message: string): void {
  gatewayLogger.warn(fields, message)
}

export function logGatewayError(fields: GatewayLogFields & { err?: unknown }, message: string): void {
  gatewayLogger.error(fields, message)
}
