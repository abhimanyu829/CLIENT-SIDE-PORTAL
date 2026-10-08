/**
 * lib/services/subscription-state-machine.ts
 *
 * Phase 1 — Subscription Domain Foundation.
 *
 * Pure, dependency-free state machine for the `Subscription` domain
 * (Stack A: marketplace product-tier subscriptions). No DB access, no I/O.
 *
 * Purpose:
 *  - Make every subscription status change a CONTROLLED, server-side
 *    transition instead of an arbitrary `status = request.body.status`.
 *  - Protect terminal state (CANCELLED) from accidental re-entry.
 *  - Be idempotent: a same-state transition is always allowed (no-op),
 *    so webhook retries / double-submits stay safe.
 *
 * This module deliberately does NOT encode provider (Stripe/Razorpay)
 * states — provider mapping belongs to the provider-integration phases.
 */

import { SubStatus, SubscriptionSource } from "@prisma/client"

// ── Transition table ───────────────────────────────────────────────────────────
/**
 * Allowed destination states per source state.
 *
 * Design notes (why each edge exists):
 *  - CANCELLED -> ACTIVE        : explicit reactivation / re-purchase only
 *    (reactivateSubscription, activateSubscription, changePlan).
 *  - CANCELLED -/-> PAST_DUE    : a cancelled subscription must never be
 *    revived by a late "payment failed" webhook. This is intentional
 *    hardening vs. the pre-Phase-1 behaviour.
 *  - CANCELLED -/-> PAUSED      : pausing something already cancelled is
 *    meaningless; blocked.
 *  - ACTIVE/PAST_DUE/TRIALING -> PAUSED : operator pause.
 *  - PAST_DUE -> ACTIVE         : successful recovery payment.
 *  - PAUSED -> PAST_DUE         : billing failure discovered while paused.
 *
 * Same-state transitions are always allowed (idempotent no-op) and are NOT
 * listed here — see canTransitionSubscriptionStatus().
 */
export const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubStatus, readonly SubStatus[]>> =
  Object.freeze({
    [SubStatus.TRIALING]: Object.freeze([SubStatus.ACTIVE, SubStatus.PAST_DUE, SubStatus.PAUSED, SubStatus.CANCELLED]),
    [SubStatus.ACTIVE]: Object.freeze([SubStatus.PAST_DUE, SubStatus.PAUSED, SubStatus.CANCELLED]),
    [SubStatus.PAST_DUE]: Object.freeze([SubStatus.ACTIVE, SubStatus.PAUSED, SubStatus.CANCELLED]),
    [SubStatus.PAUSED]: Object.freeze([SubStatus.ACTIVE, SubStatus.PAST_DUE, SubStatus.CANCELLED]),
    // Terminal: only explicit reactivation may leave CANCELLED.
    [SubStatus.CANCELLED]: Object.freeze([SubStatus.ACTIVE]),
  })

/** Statuses that are terminal for everything except explicit reactivation. */
export const TERMINAL_SUBSCRIPTION_STATUSES: readonly SubStatus[] = Object.freeze([
  SubStatus.CANCELLED,
])

/** Initial statuses a brand-new subscription may legally start in. */
export const ALLOWED_INITIAL_SUBSCRIPTION_STATUSES: readonly SubStatus[] = Object.freeze([
  SubStatus.TRIALING,
  SubStatus.ACTIVE,
])

/** Controlled provenance set — mirror of the SubscriptionSource Prisma enum. */
export const SUBSCRIPTION_SOURCES: readonly SubscriptionSource[] = Object.freeze([
  "CHECKOUT",
  "STRIPE_WEBHOOK",
  "RAZORPAY_WEBHOOK",
  "ADMIN",
  "SYSTEM",
] as SubscriptionSource[])

/** Controlled environment set — provider-independent deployment labels. */
export const SUBSCRIPTION_ENVIRONMENTS: readonly string[] = Object.freeze([
  "development",
  "test",
  "production",
])

// ── Error ──────────────────────────────────────────────────────────────────────

export class SubscriptionTransitionError extends Error {
  readonly code = "INVALID_SUBSCRIPTION_TRANSITION"
  readonly from: SubStatus
  readonly to: SubStatus

  constructor(from: SubStatus, to: SubStatus) {
    super(`Invalid subscription transition ${from} -> ${to}`)
    this.name = "SubscriptionTransitionError"
    this.from = from
    this.to = to
  }
}

export class SubscriptionValidationError extends Error {
  readonly code = "INVALID_SUBSCRIPTION_INPUT"

  constructor(message: string) {
    super(message)
    this.name = "SubscriptionValidationError"
  }
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function isTerminalSubscriptionStatus(status: SubStatus): boolean {
  return TERMINAL_SUBSCRIPTION_STATUSES.includes(status)
}

export function isSubscriptionStatus(value: unknown): value is SubStatus {
  return typeof value === "string" && (Object.values(SubStatus) as string[]).includes(value)
}

/**
 * Same-state is always allowed (idempotent no-op). Otherwise consult the
 * transition table.
 */
export function canTransitionSubscriptionStatus(from: SubStatus, to: SubStatus): boolean {
  if (from === to) return true
  return SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false
}

/** Throws SubscriptionTransitionError when the transition is not allowed. */
export function assertSubscriptionTransition(from: SubStatus, to: SubStatus): void {
  if (!canTransitionSubscriptionStatus(from, to)) {
    throw new SubscriptionTransitionError(from, to)
  }
}

// ── Input validation (foundation contract) ────────────────────────────────────

export function isValidSubscriptionSource(value: unknown): value is SubscriptionSource {
  return (
    typeof value === "string" && (SUBSCRIPTION_SOURCES as readonly string[]).includes(value)
  )
}

export function assertValidSubscriptionSource(value: unknown): asserts value is SubscriptionSource {
  if (!isValidSubscriptionSource(value)) {
    throw new SubscriptionValidationError(
      `Invalid subscription source: ${String(value)}. Allowed: ${SUBSCRIPTION_SOURCES.join(", ")}`,
    )
  }
}

/**
 * Normalizes an environment label. Accepts the three controlled labels
 * (case-insensitive). Rejects anything else — environment strings gate
 * future provider isolation, so a typo must never slip through.
 */
export function normalizeSubscriptionEnvironment(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new SubscriptionValidationError(
      `Invalid subscription environment: ${String(raw)}. Allowed: ${SUBSCRIPTION_ENVIRONMENTS.join(", ")}`,
    )
  }
  const normalized = raw.trim().toLowerCase()
  if (!(SUBSCRIPTION_ENVIRONMENTS as readonly string[]).includes(normalized)) {
    throw new SubscriptionValidationError(
      `Invalid subscription environment: ${raw}. Allowed: ${SUBSCRIPTION_ENVIRONMENTS.join(", ")}`,
    )
  }
  return normalized
}

/** Deployment environment of the running process. Server-side only. */
export function currentSubscriptionEnvironment(): string {
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === "production") return "production"
  if (nodeEnv === "test") return "test"
  return "development"
}

export function assertAllowedInitialStatus(status: unknown): asserts status is SubStatus {
  if (!isSubscriptionStatus(status) || !ALLOWED_INITIAL_SUBSCRIPTION_STATUSES.includes(status)) {
    throw new SubscriptionValidationError(
      `Invalid initial subscription status: ${String(status)}. Allowed: ${ALLOWED_INITIAL_SUBSCRIPTION_STATUSES.join(", ")}`,
    )
  }
}
