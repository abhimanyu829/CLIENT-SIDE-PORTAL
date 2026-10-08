/**
 * lib/services/plan-lifecycle.ts
 *
 * Phase 2 — Plan Catalog. Pure, dependency-free lifecycle rules for the plan
 * catalog. No DB access, no I/O.
 *
 * Two machines live here:
 *  - PLAN status       : DRAFT → PUBLISHED → PAUSED → ARCHIVED (plan-level)
 *  - VERSION status    : DRAFT → PUBLISHED → ARCHIVED (version-level)
 *
 * Both are server-controlled. No client request ever sets status directly.
 */

import { PlanItemType, PlanStatus, PlanType, PlanVersionStatus } from "@prisma/client"

// ── Errors ─────────────────────────────────────────────────────────────────────

export class PlanTransitionError extends Error {
  readonly code = "INVALID_PLAN_TRANSITION"
  readonly from: string
  readonly to: string
  constructor(kind: "PLAN" | "VERSION", from: string, to: string) {
    super(`Invalid ${kind} transition ${from} -> ${to}`)
    this.name = "PlanTransitionError"
    this.from = from
    this.to = to
  }
}

export class PlanValidationError extends Error {
  readonly code = "INVALID_PLAN_INPUT"
  readonly issues: string[]
  constructor(message: string, issues: string[] = []) {
    super(message)
    this.name = "PlanValidationError"
    this.issues = issues
  }
}

// ── Plan status machine ────────────────────────────────────────────────────────

export const PLAN_STATUS_TRANSITIONS: Readonly<Record<PlanStatus, readonly PlanStatus[]>> =
  Object.freeze({
    [PlanStatus.DRAFT]: Object.freeze([PlanStatus.PUBLISHED, PlanStatus.ARCHIVED]),
    [PlanStatus.PUBLISHED]: Object.freeze([PlanStatus.PAUSED, PlanStatus.ARCHIVED]),
    [PlanStatus.PAUSED]: Object.freeze([PlanStatus.PUBLISHED, PlanStatus.ARCHIVED]),
    // ARCHIVED is terminal: a plan is never un-archived. Historical versions
    // and (future) subscriptions stay intact; it is simply no longer offered.
    [PlanStatus.ARCHIVED]: Object.freeze([]),
  })

export function isTerminalPlanStatus(status: PlanStatus): boolean {
  return status === PlanStatus.ARCHIVED
}

export function canTransitionPlanStatus(from: PlanStatus, to: PlanStatus): boolean {
  if (from === to) return true // idempotent no-op
  return PLAN_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertPlanTransition(from: PlanStatus, to: PlanStatus): void {
  if (!canTransitionPlanStatus(from, to)) throw new PlanTransitionError("PLAN", from, to)
}

// ── Version status machine ─────────────────────────────────────────────────────

export const PLAN_VERSION_TRANSITIONS: Readonly<
  Record<PlanVersionStatus, readonly PlanVersionStatus[]>
> = Object.freeze({
  [PlanVersionStatus.DRAFT]: Object.freeze([
    PlanVersionStatus.PUBLISHED,
    PlanVersionStatus.ARCHIVED,
  ]),
  [PlanVersionStatus.PUBLISHED]: Object.freeze([PlanVersionStatus.ARCHIVED]),
  [PlanVersionStatus.ARCHIVED]: Object.freeze([]),
})

export function isEditableVersionStatus(status: PlanVersionStatus): boolean {
  return status === PlanVersionStatus.DRAFT
}

export function canTransitionVersionStatus(
  from: PlanVersionStatus,
  to: PlanVersionStatus,
): boolean {
  if (from === to) return true
  return PLAN_VERSION_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertVersionTransition(from: PlanVersionStatus, to: PlanVersionStatus): void {
  if (!canTransitionVersionStatus(from, to)) throw new PlanTransitionError("VERSION", from, to)
}

// ── Controlled vocabularies ───────────────────────────────────────────────────

export const PLAN_TYPES: readonly PlanType[] = Object.freeze([
  PlanType.FREE,
  PlanType.MONTHLY,
  PlanType.THREE_MONTH,
  PlanType.SIX_MONTH,
  PlanType.YEARLY,
  PlanType.ENTERPRISE,
  PlanType.CUSTOM,
])

/** Commercial duration (months) implied by each plan type. FREE = 0. */
export const PLAN_TYPE_DURATION_MONTHS: Readonly<Record<PlanType, number | null>> = Object.freeze({
  [PlanType.FREE]: 0,
  [PlanType.MONTHLY]: 1,
  [PlanType.THREE_MONTH]: 3,
  [PlanType.SIX_MONTH]: 6,
  [PlanType.YEARLY]: 12,
  [PlanType.ENTERPRISE]: null, // negotiated
  [PlanType.CUSTOM]: null,
})

/** Billing interval (months) implied by each plan type. FREE = 0 (no billing). */
export const PLAN_TYPE_BILLING_MONTHS: Readonly<Record<PlanType, number | null>> = Object.freeze({
  [PlanType.FREE]: 0,
  [PlanType.MONTHLY]: 1,
  [PlanType.THREE_MONTH]: 3,
  [PlanType.SIX_MONTH]: 6,
  [PlanType.YEARLY]: 12,
  [PlanType.ENTERPRISE]: null,
  [PlanType.CUSTOM]: null,
})

/** Item types that reference a real application resource (need existence check). */
export const REFERENTIAL_ITEM_TYPES: readonly PlanItemType[] = Object.freeze([
  PlanItemType.PRODUCT,
  PlanItemType.SERVICE,
  PlanItemType.AI_CAPABILITY,
])

/** Item types that declare a numeric limit rather than reference a resource. */
export const LIMIT_ITEM_TYPES: readonly PlanItemType[] = Object.freeze([
  PlanItemType.STORAGE,
  PlanItemType.USER_LIMIT,
  PlanItemType.ADMIN_LIMIT,
  PlanItemType.RESOURCE_LIMIT,
])

/** Item types that are singletons within a version (may appear at most once). */
export const SINGLETON_ITEM_TYPES: readonly PlanItemType[] = Object.freeze([
  PlanItemType.STORAGE,
  PlanItemType.USER_LIMIT,
  PlanItemType.ADMIN_LIMIT,
  PlanItemType.RESOURCE_LIMIT,
  PlanItemType.SUPPORT,
])

export const PLAN_ITEM_TYPES: readonly PlanItemType[] = Object.freeze([
  PlanItemType.PRODUCT,
  PlanItemType.SERVICE,
  PlanItemType.FEATURE,
  PlanItemType.AI_CAPABILITY,
  PlanItemType.STORAGE,
  PlanItemType.USER_LIMIT,
  PlanItemType.ADMIN_LIMIT,
  PlanItemType.RESOURCE_LIMIT,
  PlanItemType.SUPPORT,
])

export const PLAN_CURRENCIES: readonly string[] = Object.freeze([
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
])

export function isPlanType(value: unknown): value is PlanType {
  return typeof value === "string" && (PLAN_TYPES as readonly string[]).includes(value)
}

export function isPlanItemType(value: unknown): value is PlanItemType {
  return typeof value === "string" && (PLAN_ITEM_TYPES as readonly string[]).includes(value)
}

export function isReferentialItemType(type: PlanItemType): boolean {
  return REFERENTIAL_ITEM_TYPES.includes(type)
}

export function isLimitItemType(type: PlanItemType): boolean {
  return LIMIT_ITEM_TYPES.includes(type)
}

export function isSingletonItemType(type: PlanItemType): boolean {
  return SINGLETON_ITEM_TYPES.includes(type)
}

export function isPlanCurrency(value: unknown): value is string {
  return typeof value === "string" && PLAN_CURRENCIES.includes(value)
}

/** FREE plan definitions may have a zero monetary price and zero items. */
export function planRequiresPaidPricing(planType: PlanType): boolean {
  return planType !== PlanType.FREE
}

export function planRequiresItems(planType: PlanType): boolean {
  return planType !== PlanType.FREE
}

// ── Identity ───────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidPlanSlug(value: unknown): value is string {
  return typeof value === "string" && value.length >= 3 && value.length <= 80 && SLUG_RE.test(value)
}

export function assertValidPlanSlug(value: unknown): asserts value is string {
  if (!isValidPlanSlug(value)) {
    throw new PlanValidationError(
      `Invalid plan slug: ${String(value)}. Expected lowercase alphanumeric words separated by single hyphens (3-80 chars).`,
    )
  }
}

/** Deterministic slug from a display name. Display-name changes never alter
 *  an existing plan's identity because the slug is stored, not derived. */
export function slugifyPlanName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
}
