/**
 * lib/agent-gateway/tasks/retry-policy.ts
 *
 * Retry behaviour is DERIVED from each capability's own Phase 3/4 metadata —
 * there is no universal retry policy:
 *
 *   SAFE_RETRY         idempotency.class IDEMPOTENT and retrySafe (reads).
 *                      Transient failures retry, up to 3 attempts.
 *   CONDITIONAL_RETRY  non-idempotent but not declared unsafe. Retried ONLY
 *                      when the failure happened before the adapter was
 *                      dispatched (nothing can have been mutated).
 *   NO_RETRY           irreversible, FORBIDDEN, financial (Phase 7's
 *                      mandatory financial gate), retrySafe=false without an
 *                      idempotency key, or missing metadata. One attempt.
 */
import type { CapabilityDefinition } from "../capabilities/types"
import type { ExecutionErrorCode } from "../execution/contracts/execution-error"
import { mandatoryApprovalReason } from "../autonomy/approval-requirements"
import type { RetryClass } from "./types"

export function classifyRetry(capability: CapabilityDefinition): RetryClass {
  const idem = capability.idempotency
  const rollback = capability.rollback
  if (!idem || !rollback || typeof idem.retrySafe !== "boolean" || !idem.class) return "NO_RETRY"
  if (rollback.reversibility === "IRREVERSIBLE" || capability.exposure === "FORBIDDEN") return "NO_RETRY"
  if (capability.operationType === "CRITICAL") return "NO_RETRY"
  // Payment / refund / billing / payout mutations are never blindly retried.
  if (mandatoryApprovalReason(capability, "development") === "FINANCIAL_OPERATION") return "NO_RETRY"
  if (idem.class === "IDEMPOTENT" && idem.retrySafe) return "SAFE_RETRY"
  if (!idem.retrySafe && !idem.requiresIdempotencyKey) return "NO_RETRY"
  return "CONDITIONAL_RETRY"
}

export function maxAttemptsFor(retryClass: RetryClass): number {
  return retryClass === "NO_RETRY" ? 1 : 3
}

/** Delay before attempt n+1 after attempt n failed: 1000 × 2^(n−1) ms. */
export function backoffMs(failedAttempt: number): number {
  return 1000 * 2 ** Math.max(0, failedAttempt - 1)
}

/** Phase 4 codes that describe a temporary condition rather than a definitive answer. */
const TRANSIENT_EXECUTION_CODES: readonly ExecutionErrorCode[] = ["EXECUTION_UNAVAILABLE", "INTERNAL_ERROR", "TIMEOUT"]

export function isTransientExecutionCode(code: string | undefined): boolean {
  return code !== undefined && (TRANSIENT_EXECUTION_CODES as readonly string[]).includes(code)
}

export interface FailureDecisionInput {
  retryClass: RetryClass
  attempts: number
  maxAttempts: number
  transient: boolean
  /** True when the adapter was never invoked for this attempt. */
  preDispatch: boolean
}

export type FailureDecision = { retry: true } | { retry: false; errorCode: "EXECUTION_FAILED" | "RETRY_EXHAUSTED" }

export function decideAfterFailure(input: FailureDecisionInput): FailureDecision {
  const retryable =
    input.transient && (input.retryClass === "SAFE_RETRY" || (input.retryClass === "CONDITIONAL_RETRY" && input.preDispatch))
  if (!retryable) return { retry: false, errorCode: "EXECUTION_FAILED" }
  if (input.attempts >= input.maxAttempts) return { retry: false, errorCode: "RETRY_EXHAUSTED" }
  return { retry: true }
}
