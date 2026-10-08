/**
 * Phase 3 — Test Groups G+H: expiration and revocation semantics.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementSourceType, GrantStatus } from "@prisma/client"
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
  return {
    __store: store,
    cacheGet: vi.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    cacheSet: vi.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)))
      return true
    }),
    invalidateCache: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k)
    }),
    CACHE_KEYS: { AI_QUOTA_PREFIX: "ai:quota:" },
    aiQuotaCacheKey: (id: string) => `ai:quota:${id}`,
  }
})

import * as dbModule from "@/lib/db"
import * as cacheNs from "@/lib/services/cache-service"

const { grantEntitlement, revokeEntitlement, expireStaleGrants } = await import(
  "@/lib/services/entitlement-service"
)
const { getEffectiveEntitlements, hasEntitlement, entitlementCacheKey } = await import(
  "@/lib/services/entitlement-resolver"
)

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
  fake.seedUser("user_1")
  fake.seedDefinition({ id: "def_p", key: "product.school_management", type: "PRODUCT" })
})

function grant(expiresAt?: Date, ref = "src") {
  const now = Date.now()
  return grantEntitlement(
    {
      entitlementKey: "product.school_management",
      subjectType: "USER",
      subjectUserId: "user_1",
      sourceType: EntitlementSourceType.ADMIN_GRANT,
      sourceReference: ref,
      ...(expiresAt
        ? { startsAt: new Date(now - 2 * 86_400_000), expiresAt }
        : {}),
    },
    "admin_1",
  )
}

describe("G — expiration", () => {
  it("DENIES after expiration even while cached", async () => {
    await grant(new Date(Date.now() - 1000), "expired_1")
    // Prime the cache, then read again: the read-time rule must still deny.
    await getEffectiveEntitlements({ type: "USER", userId: "user_1" })
    expect(await hasEntitlement({ type: "USER", userId: "user_1" }, "product.school_management")).toBe(false)
  })

  it("still ALLOWS before expiration", async () => {
    await grant(new Date(Date.now() + 60_000), "future_1")
    expect(await hasEntitlement({ type: "USER", userId: "user_1" }, "product.school_management")).toBe(true)
  })

  it("permanent grants never expire", async () => {
    await grant(undefined, "perm_1")
    expect(await hasEntitlement({ type: "USER", userId: "user_1" }, "product.school_management")).toBe(true)
  })

  it("worker marks stale ACTIVE grants EXPIRED (cleanup only; access already denied)", async () => {
    await grant(new Date(Date.now() - 1000), "stale_1")
    const result = await expireStaleGrants()
    expect(result.expired).toBe(1)
    const rows = [...fake.store.grants.values()]
    expect(rows[0].status).toBe(GrantStatus.EXPIRED)
  })
})

describe("H — revocation", () => {
  it("revoke DENIES immediately and invalidates the cache", async () => {
    const g = await grant(undefined, "rev_1")
    const key = entitlementCacheKey({ type: "USER", userId: "user_1" })
    await getEffectiveEntitlements({ type: "USER", userId: "user_1" }) // prime cache
    const store = (cacheNs as unknown as { __store: Map<string, unknown> }).__store
    expect(store.has(key)).toBe(true)

    await revokeEntitlement(g.id, "admin_1", "refund")

    expect(store.has(key)).toBe(false)
    expect(await hasEntitlement({ type: "USER", userId: "user_1" }, "product.school_management")).toBe(false)
    // The row is preserved as REVOKED (history), not deleted.
    expect(fake.store.grants.get(g.id)!.status).toBe(GrantStatus.REVOKED)
  })

  it("revoked grants from one source do not remove another source's grant", async () => {
    const subGrant = await grant(undefined, "sub_1")
    const standaloneGrant = await grantEntitlement(
      {
        entitlementKey: "product.school_management",
        subjectType: "USER",
        subjectUserId: "user_1",
        sourceType: EntitlementSourceType.STANDALONE_PURCHASE,
        sourceReference: "order_1",
      },
      "a",
    )
    await revokeEntitlement(subGrant.id, "a", "sub cancelled")
    expect(
      await hasEntitlement({ type: "USER", userId: "user_1" }, "product.school_management"),
    ).toBe(true)
    expect(fake.store.grants.get(standaloneGrant.id)!.status).toBe(GrantStatus.ACTIVE)
  })
})
