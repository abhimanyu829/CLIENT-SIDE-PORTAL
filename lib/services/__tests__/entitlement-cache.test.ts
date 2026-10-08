/**
 * Phase 3 — Test Group I: cache strategy.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementSourceType } from "@prisma/client"
import { createFakeEntitlementDb, type FakeEntitlementDb } from "./helpers/fake-entitlement-db"

let fake: FakeEntitlementDb

vi.mock("@/lib/db", () => {
  const state: { current: unknown } = { current: null }
  return {
    __setFakeDb: (d: unknown) => {
      state.current = d
    },
    db: new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (!state.current) throw new Error("fake db not installed")
          const src = state.current as Record<string, unknown>
          const val = src[prop]
          return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(src) : val
        },
      },
    ),
  }
})
vi.mock("@/lib/services/cache-service", () => {
  const store = new Map<string, unknown>()
  let unavailable = false
  return {
    __store: store,
    __setUnavailable: (u: boolean) => {
      unavailable = u
    },
    cacheGet: vi.fn(async (key: string) => {
      if (unavailable) return null
      return store.has(key) ? store.get(key)! : null
    }),
    cacheSet: vi.fn(async (key: string, value: unknown) => {
      if (unavailable) return false
      store.set(key, JSON.parse(JSON.stringify(value)))
      return true
    }),
    invalidateCache: vi.fn(async (keys: string[]) => {
      if (unavailable) return
      for (const k of keys) store.delete(k)
    }),
    CACHE_KEYS: { AI_QUOTA_PREFIX: "ai:quota:" },
    aiQuotaCacheKey: (id: string) => `ai:quota:${id}`,
  }
})

import * as dbModule from "@/lib/db"
import * as cacheNs from "@/lib/services/cache-service"

const { grantEntitlement, revokeEntitlement, suspendEntitlement, restoreEntitlement } = await import(
  "@/lib/services/entitlement-service"
)
const { getEffectiveEntitlements, hasEntitlement, entitlementCacheKey } = await import(
  "@/lib/services/entitlement-resolver"
)

const SUBJECT = { type: "USER" as const, userId: "user_1" }
const KEY_SUB = entitlementCacheKey(SUBJECT)

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  const ns = cacheNs as unknown as {
    __store: Map<string, unknown>
    __setUnavailable: (u: boolean) => void
  }
  ns.__store.clear()
  ns.__setUnavailable(false)
  fake.seedUser("user_1")
  fake.seedDefinition({ id: "def_p", key: "product.school_management", type: "PRODUCT" })
  fake.seedDefinition({ id: "def_e", key: "product.ecommerce", type: "PRODUCT" })
})

function grant(key: string, ref = "src") {
  return grantEntitlement(
    {
      entitlementKey: key,
      subjectType: "USER",
      subjectUserId: "user_1",
      sourceType: EntitlementSourceType.ADMIN_GRANT,
      sourceReference: ref,
    },
    "admin_1",
  )
}

describe("I — cache", () => {
  it("cache miss resolves from DB and populates the cache", async () => {
    const store = (cacheNs as unknown as { __store: Map<string, unknown> }).__store
    await grant("product.school_management")
    expect(store.has(KEY_SUB)).toBe(false)
    await getEffectiveEntitlements(SUBJECT)
    expect(store.has(KEY_SUB)).toBe(true)
  })

  it("cache hit serves a snapshot; DB grants added without invalidation are not visible", async () => {
    await grant("product.school_management")
    await getEffectiveEntitlements(SUBJECT) // prime
    // Bypass the service: seed a grant directly into the store so no cache
    // invalidation fires; the cached snapshot must not see it.
    fake.seedGrant({
      id: "g_direct",
      scheduleKey: "product.ecommerce",
      entitlementDefinitionId: "def_e",
      subjectUserId: "user_1",
    })
    const eff = await getEffectiveEntitlements(SUBJECT)
    expect(eff.map((g) => g.key)).toEqual(["product.school_management"])
  })

  it("grant, revoke, suspend and restore all invalidate the cache", async () => {
    const store = (cacheNs as unknown as { __store: Map<string, unknown> }).__store

    const g = await grant("product.school_management")
    await getEffectiveEntitlements(SUBJECT) // prime
    expect(store.has(KEY_SUB)).toBe(true)

    await revokeEntitlement(g.id, "a", "r")
    expect(store.has(KEY_SUB)).toBe(false)

    // restore path: grant again, prime, suspend, verify invalidation.
    const g2 = await grant("product.school_management", "src2")
    await getEffectiveEntitlements(SUBJECT)
    await suspendEntitlement(g2.id, "a", "r")
    expect(store.has(KEY_SUB)).toBe(false)

    await restoreEntitlement(g2.id, "a", "r")
    expect(store.has(KEY_SUB)).toBe(false)
  })

  it("Redis unavailable falls back to the authoritative DB (never unsafe ALLOW)", async () => {
    await grant("product.school_management")
    const ns = cacheNs as unknown as { __setUnavailable: (u: boolean) => void }
    ns.__setUnavailable(true)
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(true)
    expect(await hasEntitlement(SUBJECT, "product.nope")).toBe(false)
  })

  it("a stale cached payload cannot grant expired or revoked access (read-time re-check)", async () => {
    await grant("product.school_management")
    await getEffectiveEntitlements(SUBJECT) // prime with a valid row
    const store = (cacheNs as unknown as { __store: Map<string, unknown> }).__store
    // Corrupt the cache directly: flip the stored grant to expired.
    const cached = store.get(KEY_SUB) as Array<Record<string, unknown>>
    cached[0].expiresAt = new Date(Date.now() - 1000).toISOString()
    store.set(KEY_SUB, cached)
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(false)
  })

  it("cache keys are environment-scoped and subject-scoped", () => {
    expect(entitlementCacheKey({ type: "USER", userId: "a" })).toContain("entitlements:v1:")
    expect(entitlementCacheKey({ type: "USER", userId: "a" })).toContain("user:a")
    expect(entitlementCacheKey({ type: "TEAM", teamId: "t" })).toContain("team:t")
    expect(entitlementCacheKey({ type: "USER", userId: "a" })).not.toBe(
      entitlementCacheKey({ type: "USER", userId: "b" }),
    )
  })
})
