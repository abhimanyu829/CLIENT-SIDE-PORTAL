/**
 * lib/agent-gateway/execution/contracts/execution-error.ts
 *
 * Stable, machine-readable execution error contract. Every adapter and
 * the resolver itself throw ONLY this type — never a raw Prisma error,
 * never an unwrapped Server Action redirect, never a stack trace.
 *
 * This is deliberately its own type, separate from Phase 3's
 * `CapabilityError` (registry-time errors: not found, disabled, invalid
 * input shape) and Phase 1's `GatewayError` (HTTP-transport errors).
 * `ExecutionError` covers what can go wrong DURING execution against a
 * real existing service — a distinct failure surface from either.
 */

export type ExecutionErrorCode =
  | "INVALID_INPUT"
  | "RESOURCE_NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "EXECUTION_UNAVAILABLE"
  | "TIMEOUT"
  | "CANCELLED"
  | "NOT_EXECUTABLE_YET"
  | "ENVIRONMENT_MISMATCH"
  | "ADAPTER_NOT_FOUND"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR"
  // Phase 15 — release controls (resolver re-check immediately before dispatch)
  | "KILL_SWITCH_ACTIVE"
  | "ROLLOUT_BLOCKED"

export class ExecutionError extends Error {
  readonly code: ExecutionErrorCode
  /** Safe, field-level detail only. Never a secret, credential, or stack trace. */
  readonly details?: Record<string, unknown>

  constructor(code: ExecutionErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "ExecutionError"
    this.code = code
    this.details = details
  }
}

/** Converts any caught value into an ExecutionError, never leaking the original detail (stack trace, Prisma internals, etc.). */
export function toExecutionError(err: unknown): ExecutionError {
  if (err instanceof ExecutionError) return err
  return new ExecutionError("INTERNAL_ERROR", "An internal execution error occurred.")
}
