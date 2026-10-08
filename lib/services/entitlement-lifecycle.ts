/**
 * lib/services/entitlement-lifecycle.ts
 *
 * Phase 3 — Entitlement Engine. Pure, dependency-free rules. No DB, no I/O.
 *
 * Owns:
 *  - grant status machine (PENDING/ACTIVE/SUSPENDED/EXPIRED/REVOKED)
 *  - time-validity rule (startsAt / expiresAt, UTC)
 *  - controlled vocabularies (type/source/scope/subject)
 *  - entitlement key validation (stable business keys)
 *  - deterministic dedupe-key construction (idempotent grants)
 *  - deterministic limit resolution rule
 */

import { createHash } from "crypto"
import {
  EntitlementScope,
  EntitlementSourceType,
  EntitlementSubjectType,
  EntitlementType,
  GrantStatus,
  PlanItemType,
} from "@prisma/client"

// ── Errors ─────────────────────────────────────────────────────────────────────

export type EntitlementErrorCode =
  | "ENTITLEMENT_NOT_FOUND"
  | "ENTITLEMENT_INACTIVE"
  | "ENTITLEMENT_EXPIRED"
  | "ENTITLEMENT_REVOKED"
  | "ENTITLEMENT_OUT_OF_SCOPE"
  | "DUPLICATE_GRANT"
  | "INVALID_ENTITLEMENT"
  | "INVALID_SOURCE"
  | "UNAUTHORIZED_GRANT"
  | "CONFLICT"
  | "ENTITLEMENT_SERVICE_UNAVAILABLE"

export class EntitlementError extends Error {
  readonly code: EntitlementErrorCode
  constructor(code: EntitlementErrorCode, message: string) {
    super(message)
    this.name = "EntitlementError"
    this.code = code
  }
}

// ── Grant status machine ──────────────────────────────────────────────────────

export const GRANT_STATUS_TRANSITIONS: Readonly<Record<GrantStatus, readonly GrantStatus[]>> =
  Object.freeze({
    [GrantStatus.PENDING]: Object.freeze([GrantStatus.ACTIVE, GrantStatus.REVOKED]),
    [GrantStatus.ACTIVE]: Object.freeze([
      GrantStatus.SUSPENDED,
      GrantStatus.REVOKED,
      GrantStatus.EXPIRED,
    ]),
    [GrantStatus.SUSPENDED]: Object.freeze([GrantStatus.ACTIVE, GrantStatus.REVOKED]),
    // Terminal states.
    [GrantStatus.EXPIRED]: Object.freeze([]),
    [GrantStatus.REVOKED]: Object.freeze([]),
  })

export function isTerminalGrantStatus(status: GrantStatus): boolean {
  return status === GrantStatus.EXPIRED || status === GrantStatus.REVOKED
}

export function canTransitionGrantStatus(from: GrantStatus, to: GrantStatus): boolean {
  if (from === to) return true // idempotent no-op
  return GRANT_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertGrantStatusTransition(from: GrantStatus, to: GrantStatus): void {
  if (!canTransitionGrantStatus(from, to)) {
    throw new EntitlementError("CONFLICT", `Invalid grant transition ${from} -> ${to}`)
  }
}

/** PENDING is not usable; only ACTIVE, within its time window, resolves. */
export function isGrantStatusUsable(status: GrantStatus): boolean {
  return status === GrantStatus.ACTIVE
}

// ── Time validity ─────────────────────────────────────────────────────────────

export interface GrantTimeFields {
  status: GrantStatus
  startsAt: Date
  expiresAt: Date | null
}

/**
 * now >= startsAt AND (now < expiresAt OR expiresAt IS NULL) AND status ACTIVE.
 * Expiry is enforced at read time — access checks never depend on a cleanup job.
 */
export function isGrantUsableNow(grant: GrantTimeFields, now: Date = new Date()): boolean {
  if (!isGrantStatusUsable(grant.status)) return false
  if (grant.startsAt.getTime() > now.getTime()) return false
  if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) return false
  return true
}

// ── Controlled vocabularies ───────────────────────────────────────────────────

export const ENTITLEMENT_TYPES: readonly EntitlementType[] = Object.freeze([
  EntitlementType.PRODUCT,
  EntitlementType.SERVICE,
  EntitlementType.FEATURE,
  EntitlementType.AI_CAPABILITY,
  EntitlementType.STORAGE,
  EntitlementType.USER_LIMIT,
  EntitlementType.ADMIN_LIMIT,
  EntitlementType.RESOURCE_LIMIT,
  EntitlementType.SUPPORT,
])

export const ENTITLEMENT_SOURCE_TYPES: readonly EntitlementSourceType[] = Object.freeze([
  EntitlementSourceType.STANDALONE_PURCHASE,
  EntitlementSourceType.SUBSCRIPTION,
  EntitlementSourceType.ADMIN_GRANT,
  EntitlementSourceType.PROMOTIONAL,
])

export const ENTITLEMENT_SCOPES: readonly EntitlementScope[] = Object.freeze([
  EntitlementScope.GLOBAL,
  EntitlementScope.OWNER,
  EntitlementScope.TEAM,
  EntitlementScope.RESOURCE,
])

export const ENTITLEMENT_SUBJECT_TYPES: readonly EntitlementSubjectType[] = Object.freeze([
  EntitlementSubjectType.USER,
  EntitlementSubjectType.TEAM,
])

/** Limit-style types (numeric limit resolution applies). */
export const LIMIT_ENTITLEMENT_TYPES: readonly EntitlementType[] = Object.freeze([
  EntitlementType.STORAGE,
  EntitlementType.USER_LIMIT,
  EntitlementType.ADMIN_LIMIT,
  EntitlementType.RESOURCE_LIMIT,
])

export function isEntitlementType(value: unknown): value is EntitlementType {
  return typeof value === "string" && (ENTITLEMENT_TYPES as readonly string[]).includes(value)
}

export function isEntitlementSourceType(value: unknown): value is EntitlementSourceType {
  return (
    typeof value === "string" && (ENTITLEMENT_SOURCE_TYPES as readonly string[]).includes(value)
  )
}

export function isEntitlementScope(value: unknown): value is EntitlementScope {
  return typeof value === "string" && (ENTITLEMENT_SCOPES as readonly string[]).includes(value)
}

export function isLimitEntitlementType(type: EntitlementType): boolean {
  return LIMIT_ENTITLEMENT_TYPES.includes(type)
}

// ── Entitlement key ───────────────────────────────────────────────────────────

const KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

/**
 * Stable business keys, e.g. "product.school_management", "limit.admin_users".
 * Deliberately NOT model names, table names or UUIDs.
 */
export function isValidEntitlementKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 3 && value.length <= 120 && KEY_RE.test(value)
}

export function assertValidEntitlementKey(value: unknown): asserts value is string {
  if (!isValidEntitlementKey(value)) {
    throw new EntitlementError(
      "INVALID_ENTITLEMENT",
      `Invalid entitlement key: ${String(value)}. Expected "namespace.semantic_name" (e.g. product.school_management).`,
    )
  }
}

/** Namespaced key helpers used by the standalone adapter. */
export function productEntitlementKey(productId: string): string {
  return `product.${productId}`
}
export function serviceEntitlementKey(serviceId: string): string {
  return `service.${serviceId}`
}

// ── Deterministic dedupe key ──────────────────────────────────────────────────

export interface DedupeAxes {
  entitlementKey: string
  subjectType: EntitlementSubjectType
  subjectUserId?: string | null
  subjectTeamId?: string | null
  sourceType: EntitlementSourceType
  sourceReference: string
  scope: EntitlementScope
  resourceId?: string | null
}

/**
 * Canonical, order-independent hash of every idempotency axis. Repeated
 * provisioning (same source + reference + entitlement + subject + scope)
 * yields the same key, so no duplicate active grant is created.
 */
export function buildGrantDedupeKey(axes: DedupeAxes): string {
  const canonical = JSON.stringify([
    axes.entitlementKey,
    axes.subjectType,
    axes.subjectUserId ?? "",
    axes.subjectTeamId ?? "",
    axes.sourceType,
    axes.sourceReference,
    axes.scope,
    axes.resourceId ?? "",
  ])
  return createHash("sha256").update(canonical).digest("hex")
}

// ── Limit resolution ──────────────────────────────────────────────────────────

/**
 * Deterministic limit rule: the HIGHEST valid limit wins (max), never a blind
 * sum. Rationale: overlapping grants from different sources (e.g. standalone +
 * subscription) must not stack into a larger-than-intended limit. Documented
 * per-key policy is "max wins" for all limit types in Phase 3.
 */
export function resolveLimitValue(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  if (nums.length === 0) return null
  return Math.max(...nums)
}

// ── Plan-item → entitlement contract (Phase 5 consumes this) ──────────────────

export interface PlanItemLike {
  itemType: PlanItemType
  itemRefId?: string | null
  itemRefKey?: string | null
  limitValue?: number | null
  limitUnit?: string | null
}

export interface EntitlementDescriptor {
  key: string
  type: EntitlementType
  resourceId: string | null
  limitValue: number | null
  limitUnit: string | null
}

/**
 * Pure translation contract from a Phase-2 PlanItem to the entitlement it
 * promises. Documents HOW plan composition maps to entitlement keys WITHOUT
 * creating grants — actual provisioning is Phase 5.
 */
export function describePlanItemEntitlement(item: PlanItemLike): EntitlementDescriptor {
  switch (item.itemType) {
    case PlanItemType.PRODUCT:
      return {
        key: productEntitlementKey(item.itemRefId ?? ""),
        type: EntitlementType.PRODUCT,
        resourceId: item.itemRefId ?? null,
        limitValue: null,
        limitUnit: null,
      }
    case PlanItemType.SERVICE:
      return {
        key: serviceEntitlementKey(item.itemRefId ?? ""),
        type: EntitlementType.SERVICE,
        resourceId: item.itemRefId ?? null,
        limitValue: null,
        limitUnit: null,
      }
    case PlanItemType.AI_CAPABILITY:
      return {
        key: `ai.${item.itemRefId ?? ""}`,
        type: EntitlementType.AI_CAPABILITY,
        resourceId: item.itemRefId ?? null,
        limitValue: null,
        limitUnit: null,
      }
    case PlanItemType.FEATURE:
      return {
        key: `feature.${item.itemRefKey ?? "unknown"}`,
        type: EntitlementType.FEATURE,
        resourceId: null,
        limitValue: null,
        limitUnit: null,
      }
    case PlanItemType.STORAGE:
      return {
        key: "limit.storage",
        type: EntitlementType.STORAGE,
        resourceId: null,
        limitValue: item.limitValue ?? null,
        limitUnit: item.limitUnit ?? null,
      }
    case PlanItemType.USER_LIMIT:
      return {
        key: "limit.team_members",
        type: EntitlementType.USER_LIMIT,
        resourceId: null,
        limitValue: item.limitValue ?? null,
        limitUnit: item.limitUnit ?? null,
      }
    case PlanItemType.ADMIN_LIMIT:
      return {
        key: "limit.admin_users",
        type: EntitlementType.ADMIN_LIMIT,
        resourceId: null,
        limitValue: item.limitValue ?? null,
        limitUnit: item.limitUnit ?? null,
      }
    case PlanItemType.RESOURCE_LIMIT:
      return {
        key: `limit.${item.itemRefKey ?? "resource"}`,
        type: EntitlementType.RESOURCE_LIMIT,
        resourceId: null,
        limitValue: item.limitValue ?? null,
        limitUnit: item.limitUnit ?? null,
      }
    case PlanItemType.SUPPORT:
      return {
        key: `support.${item.itemRefKey ?? "standard"}`,
        type: EntitlementType.SUPPORT,
        resourceId: null,
        limitValue: null,
        limitUnit: null,
      }
    default:
      throw new EntitlementError("INVALID_ENTITLEMENT", `Unmappable plan item type: ${String(item.itemType)}`)
  }
}
