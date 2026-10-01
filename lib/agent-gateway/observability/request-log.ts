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
 *
 * Phase 12: that rule is also ENFORCED, not only followed — the child
 * logger redacts credential- and payload-shaped fields (top level and one
 * level down) through pino's own redaction, so a future log call that
 * passes a header bag, a token or a raw input by mistake still writes
 * "[redacted]".
 */
import type { Logger } from "pino"
import { logger } from "@/lib/logger"

const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "token",
  "bearerToken",
  "accessToken",
  "refreshToken",
  "secret",
  "webhookSecret",
  "signingSecret",
  "clientSecret",
  "password",
  "apiKey",
  "signature",
  "otp",
  "stepUpCode",
  "code",
  "rawBody",
  "body",
  "input",
  "output",
  "result",
  "payload",
]

/** pino redaction paths: each key at the top level, one level down, and inside headers. */
export const GATEWAY_LOG_REDACT_PATHS: readonly string[] = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((k) => `*.${k}`),
  'headers["x-abhibhi-signature"]',
  'headers["x-api-key"]',
  "req.headers.authorization",
  "req.headers.cookie",
]

export function withGatewayRedaction(parent: Logger): Logger {
  return parent.child({ module: "agent-gateway" }, { redact: { paths: [...GATEWAY_LOG_REDACT_PATHS], censor: "[redacted]" } })
}

export const gatewayLogger = withGatewayRedaction(logger)

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
