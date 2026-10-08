/**
 * lib/services/entitlement-resolver.ts
 *
 * Phase 3 — Entitlement Engine. The EFFECTIVE-ACCESS resolution layer.
 *
 * Answers, deterministically and server-side:
 *   - what can this subject use? (products/services/features/AI/support)
 *   - what limits apply? (storage, users, admins, ...)
 *   - when does access start/expire?
 *   - where (scope) and from which source does it come?
 *
 * Sources of truth (both read, never rewritten here):
 *   1. Native `EntitlementGrant` rows (admin/promotional/subscription grants).
 *   2. Existing `CustomerEntitlement` rows (standalone purchases + the
 *      pre-existing subscription entitlement sync) via a READ-ONLY adapter.
 *
 * The resolver NEVER grants or mutates anything, and never touches Razorpay,
 * checkout or standalone commerce tables.
 *
 * Cache: Redis via the shared cache-service. Cache is NOT the source of truth;
 * a miss or an unavailable Redis falls back to the database. Cached payloads
 * carry `expiresAt`, and every resolution re-applies the time/status rule at
 * read time, so a stale cache entry can never grant expired or revoked access.
 */

import {
  EntitlementScope,
  EntitlementSourceType,
  EntitlementType,
  GrantStatus,
} from "@prisma/client"
import { db } from "@/lib/db"
import { cacheGet, cacheSet, invalidateCache } from "@/lib/services/cache-service"
import { currentSubscriptionEnvironment } from "@/lib/services/subscription-state-machine"
import {
  EntitlementError,
  isGrantUsableNow,
  isLimitEntitlementType,
  productEntitlementKey,
  resolveLimitValue,
} from "@/lib/services/entitlement-lifecycle"

// ── Subject & output shapes ───────────────────────────────────────────────────

export type EntitlementSubject =
  | { type: "USER"; userId: string }
  | { type: "TEAM"; teamId: string }

export interface EffectiveEntitlement {
  key: string
  type: EntitlementType
  status: GrantStatus
  scope: EntitlementScope
  quantity: number | null
  limitValue: number | null
  limitUnit: string | null
  startsAt: Date
  expiresAt: Date | null
  sourceType: EntitlementSourceType
  sourceReference: string
  resourceType: string | null
  resourceId: string | null
  configuration: Record<string, unknown>
}

export interface ResolveOptions {
  /** Restrict to a resource-scoped grant for this resource id. */
  resourceId?: string
}

// ── Cache key & invalidation (shared with the service) ────────────────────────

export const ENTITLEMENT_CACHE_TTL_SECONDS = 60

export function entitlementCacheKey(subject: EntitlementSubject): string {
  const env = currentSubscriptionEnvironment()
  if (subject.type === "USER") return `entitlements:v1:${env}:user:${subject.userId}`
  return `entitlements:v1:${env}:team:${subject.teamId}`
}

export async function invalidateEntitlementCache(subject: EntitlementSubject): Promise<void> {
  await invalidateCache([entitlementCacheKey(subject)])
}

// ── Native grant read ─────────────────────────────────────────────────────────

interface GrantRow {
  entitlementKey: string
  entitlementDefinitionId: string
  type: EntitlementType
  scope: EntitlementScope
  sourceType: EntitlementSourceType
  sourceReference: string
  resourceType: string | null
  resourceId: string | null
  quantity: number | null
  limitValue: unknown
  limitUnit: string | null
  status: GrantStatus
  startsAt: Date
  expiresAt: Date | null
  configuration: unknown
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === "object" && "toNumber" in (value as object)) {
    const n = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeConfiguration(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Reads native grants for a subject, joined to their definition for the type. */
async function loadNativeGrants(subject: EntitlementSubject): Promise<EffectiveEntitlement[]> {
  const where =
    subject.type === "USER"
      ? { subjectType: "USER" as const, subjectUserId: subject.userId }
      : { subjectType: "TEAM" as const, subjectTeamId: subject.teamId }

  const rows = (await db.entitlementGrant.findMany({
    where,
    include: { entitlementDefinition: { select: { type: true } } },
  })) as unknown as Array<
    GrantRow & { entitlementDefinition: { type: EntitlementType } }
  >

  return rows.map((row) => ({
    key: row.entitlementKey,
    type: row.entitlementDefinition.type,
    status: row.status,
    scope: row.scope,
    quantity: row.quantity ?? null,
    limitValue: toNumber(row.limitValue),
    limitUnit: row.limitUnit ?? null,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt ?? null,
    sourceType: row.sourceType,
    sourceReference: row.sourceReference,
    resourceType: row.resourceType ?? null,
    resourceId: row.resourceId ?? null,
    configuration: normalizeConfiguration(row.configuration),
  }))
}

// ── Standalone-purchase adapter (READ-ONLY) ───────────────────────────────────

/**
 * Adapts the EXISTING `CustomerEntitlement` access records into effective
 * entitlements without rewriting the standalone purchase domain. Sources:
 *   - orderId present        → STANDALONE_PURCHASE
 *   - subscriptionId present → SUBSCRIPTION (pre-existing sync; read-only)
 *   - neither               → ADMIN_GRANT
 * The product id becomes the stable key `product.<productId>`.
 */
export async function loadStandaloneGrants(userId: string): Promise<EffectiveEntitlement[]> {
  if (!userId) return []
  const now = new Date()
  const rows = await db.customerEntitlement.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  })

  const out: EffectiveEntitlement[] = []
  for (const row of rows) {
    if (!row.productId) continue
    const sourceType: EntitlementSourceType = row.orderId
      ? EntitlementSourceType.STANDALONE_PURCHASE
      : row.subscriptionId
        ? EntitlementSourceType.SUBSCRIPTION
        : EntitlementSourceType.ADMIN_GRANT
    const quota = normalizeConfiguration(row.quota)
    out.push({
      key: productEntitlementKey(row.productId),
      type: EntitlementType.PRODUCT,
      status: GrantStatus.ACTIVE,
      scope: EntitlementScope.OWNER,
      quantity: null,
      limitValue: null,
      limitUnit: null,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt ?? null,
      sourceType,
      sourceReference: row.orderId ?? row.subscriptionId ?? row.id,
      resourceType: "Product",
      resourceId: row.productId,
      // Surface quota as configuration without inventing limit semantics here.
      configuration: quota,
    })
  }
  return out
}

// ── Resolver ──────────────────────────────────────────────────────────────────

async function resolveUncached(subject: EntitlementSubject): Promise<EffectiveEntitlement[]> {
  const [native, standalone] =
    subject.type === "USER"
      ? await Promise.all([loadNativeGrants(subject), loadStandaloneGrants(subject.userId)])
      : [await loadNativeGrants(subject), [] as EffectiveEntitlement[]]

  const now = new Date()
  const merged = [...native, ...standalone]
    .filter((g) => isGrantUsableNow(g, now))
    .map((g) => serializeGrant(g))
  return merged
}

function serializeGrant(g: EffectiveEntitlement): EffectiveEntitlement {
  // Ensure cache round-trips dates as ISO on the way out; the resolver keeps
  // Date objects in-memory and re-parses on cache hits.
  return { ...g, configuration: normalizeConfiguration(g.configuration) }
}

function reviveGrants(rows: EffectiveEntitlement[]): EffectiveEntitlement[] {
  return rows.map((g) => ({
    ...g,
    startsAt: new Date(g.startsAt),
    expiresAt: g.expiresAt ? new Date(g.expiresAt) : null,
  }))
}

/**
 * All valid effective entitlements for a subject, from every source, after
 * expiry/status filtering. Cache-first; DB fallback. Bounded TTL.
 */
export async function getEffectiveEntitlements(
  subject: EntitlementSubject,
  options: ResolveOptions = {},
): Promise<EffectiveEntitlement[]> {
  assertSubject(subject)
  const key = entitlementCacheKey(subject)

  let grants: EffectiveEntitlement[] | null = null
  const cached = await cacheGet<EffectiveEntitlement[]>(key)
  if (cached) grants = reviveGrants(cached)
  if (!grants) {
    grants = await resolveUncached(subject)
    await cacheSet(key, grants, ENTITLEMENT_CACHE_TTL_SECONDS)
  }

  // Re-apply validity at read time (defends against any stale cache).
  const now = new Date()
  let result = grants.filter((g) => isGrantUsableNow(g, now))

  if (options.resourceId) {
    // Resource-scoped queries keep RESOURCE grants for the exact resource and
    // GLOBAL grants. OWNER grants (no resource context) do not resolve as
    // resource-scoped access — deterministic and cross-resource safe.
    result = result.filter((g) => {
      if (g.scope === EntitlementScope.GLOBAL) return true
      if (g.scope === EntitlementScope.RESOURCE) return g.resourceId === options.resourceId
      return false
    })
  }
  return result
}

/** Boolean access check: does the subject hold a usable grant for this key? */
export async function hasEntitlement(
  subject: EntitlementSubject,
  entitlementKey: string,
  options: ResolveOptions = {},
): Promise<boolean> {
  const grants = await getEffectiveEntitlements(subject, options)
  return grants.some((g) => g.key === entitlementKey)
}

/** The winning (usable) grant for a key, or null. Deterministic tie-break. */
export async function getEntitlement(
  subject: EntitlementSubject,
  entitlementKey: string,
  options: ResolveOptions = {},
): Promise<EffectiveEntitlement | null> {
  const grants = (await getEffectiveEntitlements(subject, options)).filter(
    (g) => g.key === entitlementKey,
  )
  if (grants.length === 0) return null
  return pickWinner(grants)
}

/**
 * Resolves a numeric limit for a limit key. Rule: HIGHEST valid limit wins
 * (never a blind sum). Returns null when no limit grant exists.
 */
export async function getLimit(
  subject: EntitlementSubject,
  entitlementKey: string,
  options: ResolveOptions = {},
): Promise<{ limitValue: number | null; limitUnit: string | null }> {
  const grants = (await getEffectiveEntitlements(subject, options)).filter(
    (g) => g.key === entitlementKey && isLimitEntitlementType(g.type),
  )
  if (grants.length === 0) return { limitValue: null, limitUnit: null }
  const winner = pickWinner(grants)
  return {
    limitValue: resolveLimitValue(grants.map((g) => g.limitValue)),
    limitUnit: winner.limitUnit,
  }
}

/**
 * Deterministic winner among overlapping usable grants for the same key:
 * latest expiry first (null = never expires wins), then latest startsAt,
 * then stable source ordering, then stable string compare for total order.
 */
function pickWinner(grants: EffectiveEntitlement[]): EffectiveEntitlement {
  const sourceRank: Record<EntitlementSourceType, number> = {
    SUBSCRIPTION: 0,
    STANDALONE_PURCHASE: 1,
    ADMIN_GRANT: 2,
    PROMOTIONAL: 3,
  }
  return [...grants].sort((a, b) => {
    const ae = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY
    const be = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY
    if (ae !== be) return be - ae
    if (a.startsAt.getTime() !== b.startsAt.getTime()) {
      return b.startsAt.getTime() - a.startsAt.getTime()
    }
    if (sourceRank[a.sourceType] !== sourceRank[b.sourceType]) {
      return sourceRank[a.sourceType] - sourceRank[b.sourceType]
    }
    return a.sourceReference.localeCompare(b.sourceReference)
  })[0]
}

function assertSubject(subject: EntitlementSubject): void {
  if (!subject || typeof subject !== "object") {
    throw new EntitlementError("INVALID_ENTITLEMENT", "A subject is required")
  }
  if (subject.type === "USER") {
    if (!subject.userId || typeof subject.userId !== "string") {
      throw new EntitlementError("INVALID_ENTITLEMENT", "A user subject requires userId")
    }
    return
  }
  if (subject.type === "TEAM") {
    if (!subject.teamId || typeof subject.teamId !== "string") {
      throw new EntitlementError("INVALID_ENTITLEMENT", "A team subject requires teamId")
    }
    return
  }
  throw new EntitlementError("INVALID_ENTITLEMENT", "Unknown subject type")
}
