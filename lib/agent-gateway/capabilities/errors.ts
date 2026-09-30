/**
 * lib/agent-gateway/capabilities/errors.ts
 *
 * Stable, machine-readable error contract for the capability registry.
 *
 * This is a SEPARATE error type from `shared/errors.ts`'s `GatewayError`,
 * deliberately: `GatewayError` is the HTTP-transport error contract for
 * the Phase 1/2 request pipeline. The capability registry has no HTTP
 * surface in Phase 3 (no MCP, no public discovery endpoint) — it is an
 * internal library consumed directly by code (Phase 4+). Keeping the
 * error types separate means a future HTTP-facing consumer (Phase 5 MCP)
 * chooses explicitly how to map `CapabilityError` -> `GatewayError`,
 * rather than this layer silently assuming HTTP semantics it doesn't have.
 *
 * Never leak: stack traces, internal file paths, secret/token values,
 * infrastructure credentials, or zod's raw internal error internals
 * beyond field-level messages.
 */

export type CapabilityErrorCode =
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_DISABLED"
  | "INVALID_INPUT"
  | "INVALID_VERSION"
  | "UNSUPPORTED_OPERATION"
  | "RESOURCE_NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXECUTION_UNAVAILABLE"
  | "INTERNAL_ERROR"

/** The only error type the capability registry is allowed to surface to a caller. */
export class CapabilityError extends Error {
  readonly code: CapabilityErrorCode
  /** Field-level validation detail (input/output schema failures). Never contains secret values. */
  readonly details?: Record<string, unknown>

  constructor(code: CapabilityErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "CapabilityError"
    this.code = code
    this.details = details
  }
}

/** Converts any caught value into a CapabilityError, never leaking the original detail. */
export function toCapabilityError(err: unknown): CapabilityError {
  if (err instanceof CapabilityError) return err
  return new CapabilityError("INTERNAL_ERROR", "An internal capability registry error occurred.")
}
