/**
 * lib/services/free-trial-lifecycle.ts
 *
 * Phase 6 — Free Forever + 14-day trial. Pure, dependency-free rules.
 * No DB, no I/O.
 *
 * Owns: trial duration/expiry math (UTC), eligibility-scope identity,
 * free-enrollment idempotency identity, trial state machine, trial-eligibility
 * policy helpers.
 */

import { createHash } from "crypto"
import {
  EntitlementSourceType,
  PlanType,
  TrialStatus,
} from "@prisma/client"

// ── Errors ─────────────────────────────────────────────────────────────────────

export type FreeTrialErrorCode =
  | "FREE_PLAN_UNAVAILABLE"
  | "TRIAL_NOT_ELIGIBLE"
  | "TRIAL_ALREADY_USED"
  | "TRIAL_ALREADY_ACTIVE"
  | "TRIAL_EXPIRED"
  | "TRIAL_CANCELLED"
  | "TRIAL_PROVISIONING_FAILED"
  | "INVALID_PLAN_VERSION"
  | "UNSUPPORTED_TRIAL_ITEM"
  | "ENTITLEMENT_PROVISIONING_FAILED"
  | "PAID_CONVERSION_PENDING"
  | "PAID_CONVERSION_NOT_CONFIRMED"
  | "TRIAL_STATE_CONFLICT"
  | "RESOURCE_LIMIT_EXCEEDED"

export class FreeTrialError extends Error {
  readonly code: FreeTrialErrorCode
  constructor(code: FreeTrialErrorCode, message: string) {
    super(message)
    this.name = "FreeTrialError"
    this.code = code
  }
}

// ── Trial default policy ───────────────────────────────────────────────────────

/** Default trial duration: 14 consecutive 24-hour periods (UTC). */
export const TRIAL_DURATION_DAYS = 14
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000

/** Trials require a verified account by default. */
export const TRIAL_REQUIRES_VERIFIED_ACCOUNT = true

/** One trial per customer per plan version (eligibility scope). */
export const TRIAL_SCOPE_VERSIONED = true

/**
 * Exact expiration math: trialExpiresAt = startedAt + 14 days in UTC
 * milliseconds. Never string math, never local calendar fiddling.
 */
export function trialExpiresAtFor(startedAt: Date): Date {
  if (!(startedAt instanceof Date) || Number.isNaN(startedAt.getTime())) {
    throw new FreeTrialError("TRIAL_NOT_ELIGIBLE", "Invalid trial start time")
  }
  return new Date(startedAt.getTime() + TRIAL_DURATION_MS)
}

/** UTC-fixed eligibility scope identity (deterministic, order-independent). */
export function buildTrialScopeKey(userId: string, planVersionId: string): string {
  return createHash("sha256").update(`${userId}|${planVersionId}`).digest("hex")
}

/** UTC-fixed free-enrollment idempotency identity. */
export function buildFreeEnrollmentKey(userId: string, planVersionId: string): string {
  return createHash("sha256").update(`free:${userId}|${planVersionId}`).digest("hex")
}

// ── Trial state machine (server-controlled) ──────────────────────────────────

export const TRIAL_STATUS_TRANSITIONS: Readonly<Record<TrialStatus, readonly TrialStatus[]>> =
  Object.freeze({
    [TrialStatus.PENDING]: Object.freeze([TrialStatus.ACTIVE, TrialStatus.CANCELLED]),
    [TrialStatus.ACTIVE]: Object.freeze([
      TrialStatus.CONVERTED,
      TrialStatus.EXPIRED,
      TrialStatus.CANCELLED,
    ]),
    // Terminal states — never resurrected by stale events.
    [TrialStatus.CONVERTED]: Object.freeze([]),
    [TrialStatus.EXPIRED]: Object.freeze([]),
    [TrialStatus.CANCELLED]: Object.freeze([]),
  })

export function canTransitionTrialStatus(from: TrialStatus, to: TrialStatus): boolean {
  if (from === to) return true // idempotent no-op
  return TRIAL_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTrialTransition(from: TrialStatus, to: TrialStatus): void {
  if (!canTransitionTrialStatus(from, to)) {
    throw new FreeTrialError("TRIAL_STATE_CONFLICT", `Invalid trial transition ${from} -> ${to}`)
  }
}

/**
 * Access is denied once now >= expiresAt for an ACTIVE trial — read-time rule,
 * independent of any cleanup worker.
 */
export function isTrialExpiredAt(
  status: TrialStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== TrialStatus.ACTIVE) return true // non-active trials grant nothing
  if (!expiresAt) return false // defensive: no boundary = not expired by time rule
  return expiresAt.getTime() <= now.getTime()
}

// ── Eligibility policy helpers ────────────────────────────────────────────────

export interface TrialEligibilityContext {
  hasVerifiedAccount: boolean
  hasActiveOrPendingTrial: boolean
  hasConsumedTrial: boolean
  hasActivePaidSubscription: boolean
}

/** Deterministic single-pass eligibility decision for the default policy. */
export function evaluateTrialEligibility(ctx: TrialEligibilityContext): { eligible: boolean; code: FreeTrialErrorCode | null } {
  if (TRIAL_REQUIRES_VERIFIED_ACCOUNT && !ctx.hasVerifiedAccount) {
    return { eligible: false, code: "TRIAL_NOT_ELIGIBLE" }
  }
  if (ctx.hasActiveOrPendingTrial) {
    return { eligible: false, code: "TRIAL_ALREADY_ACTIVE" }
  }
  if (ctx.hasConsumedTrial) {
    return { eligible: false, code: "TRIAL_ALREADY_USED" }
  }
  if (ctx.hasActivePaidSubscription) {
    // A paying customer does not need (or receive) a free trial for the same scope.
    return { eligible: false, code: "TRIAL_ALREADY_ACTIVE" }
  }
  return { eligible: true, code: null }
}

/** FREE plans can never be trial eligibility sources. */
export function isBillablePlanType(planType: PlanType | null): boolean {
  return planType !== PlanType.FREE
}

export { EntitlementSourceType }