/**
 * lib/agent-gateway/shared/errors.ts
 *
 * Stable, machine-readable error contract for the Agent Gateway.
 *
 * Never expose: stack traces, database errors, secret names, internal
 * filesystem paths, Prisma details, internal service credentials, or any
 * other upstream security-sensitive detail. Every error surfaced to a
 * caller MUST go through `GatewayError` so the response shape stays
 * constant regardless of what failed internally.
 */

export type GatewayErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_EXPIRED"
  | "CONNECTION_INACTIVE"
  | "SIGNATURE_INVALID"
  | "SIGNATURE_EXPIRED"
  | "REPLAY_DETECTED"
  | "RATE_LIMITED"
  | "REQUEST_TOO_LARGE"
  | "MALFORMED_REQUEST"
  | "GATEWAY_DISABLED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "INTERNAL_GATEWAY_ERROR"
  | "NOT_FOUND"
  // Phase 2 — machine identity / AgentConnection lifecycle error codes.
  | "INVALID_CREDENTIAL"
  | "CONNECTION_NOT_FOUND"
  | "CONNECTION_PENDING"
  | "CONNECTION_SUSPENDED"
  | "CONNECTION_REVOKED"
  | "CONNECTION_EXPIRED"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_REVOKED"
  | "ENVIRONMENT_MISMATCH"
  | "CONNECTION_DISABLED"
  | "ILLEGAL_STATE_TRANSITION"
  | "VALIDATION_FAILED"

const STATUS_BY_CODE: Record<GatewayErrorCode, number> = {
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  AUTH_EXPIRED: 401,
  CONNECTION_INACTIVE: 403,
  SIGNATURE_INVALID: 401,
  SIGNATURE_EXPIRED: 401,
  REPLAY_DETECTED: 409,
  RATE_LIMITED: 429,
  REQUEST_TOO_LARGE: 413,
  MALFORMED_REQUEST: 400,
  GATEWAY_DISABLED: 503,
  UPSTREAM_UNAVAILABLE: 502,
  UPSTREAM_TIMEOUT: 504,
  INTERNAL_GATEWAY_ERROR: 500,
  NOT_FOUND: 404,
  // Phase 2 additions. Note: identity-state errors (CONNECTION_SUSPENDED,
  // CONNECTION_REVOKED, etc.) intentionally map to the SAME 401 status as
  // AUTH_INVALID at the gateway's external boundary — see error-mapping
  // rationale in signature/§39: the external response must not let an
  // unauthorized caller distinguish "wrong credential" from "credential
  // belongs to a suspended connection" (that would leak connection
  // existence/state to an attacker). The distinct codes below exist for
  // internal logging/audit granularity, not for external disambiguation.
  INVALID_CREDENTIAL: 401,
  CONNECTION_NOT_FOUND: 401,
  CONNECTION_PENDING: 401,
  CONNECTION_SUSPENDED: 401,
  CONNECTION_REVOKED: 401,
  CONNECTION_EXPIRED: 401,
  CREDENTIAL_EXPIRED: 401,
  CREDENTIAL_REVOKED: 401,
  ENVIRONMENT_MISMATCH: 401,
  CONNECTION_DISABLED: 401,
  // Admin-management-API-only errors (not reachable via the external
  // machine-authentication boundary, so no enumeration concern applies).
  ILLEGAL_STATE_TRANSITION: 409,
  VALIDATION_FAILED: 400,
}

/** The only error type the gateway pipeline is allowed to surface to a caller. */
export class GatewayError extends Error {
  readonly code: GatewayErrorCode
  readonly statusCode: number

  constructor(code: GatewayErrorCode, message: string) {
    super(message)
    this.name = "GatewayError"
    this.code = code
    this.statusCode = STATUS_BY_CODE[code]
  }
}

export interface GatewayErrorBody {
  success: false
  error: {
    code: GatewayErrorCode
    message: string
    requestId: string
  }
}

export function toErrorBody(err: GatewayError, requestId: string): GatewayErrorBody {
  return {
    success: false,
    error: { code: err.code, message: err.message, requestId },
  }
}

/** Converts any caught value into a GatewayError, never leaking the original detail. */
export function toGatewayError(err: unknown): GatewayError {
  if (err instanceof GatewayError) return err
  return new GatewayError("INTERNAL_GATEWAY_ERROR", "An internal gateway error occurred.")
}
