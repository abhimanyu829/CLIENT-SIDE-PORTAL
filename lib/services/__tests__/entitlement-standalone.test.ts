/**
 * Phase 3 — Test Group E: standalone purchase integration (READ-ONLY adapter).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementSourceType, EntitlementType } from "@prisma/client"
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

const { getEffectiveEntitlements, hasEntitlement } = await import(
  "@/lib/services/entitlement-resolver"
)

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
})

describe("E — standalone purchase integration", () => {
  it("adapts an existing purchase-record entitlement to a product key (read-only)", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_1",
      userId: "user_1",
      productId: "prod_school",
      orderId: "order_1",
      subscriptionId: null,
    })
    const eff = await getEffectiveEntitlements({ type: "USER", userId: "user_1" })
    expect(eff).toHaveLength(1)
    expect(eff[0].key).toBe("product.prod_school")
    expect(eff[0].type).toBe(EntitlementType.PRODUCT)
    expect(eff[0].sourceType).toBe(EntitlementSourceType.STANDALONE_PURCHASE)
    expect(eff[0].sourceReference).toBe("order_1")
    expect(eff[0].resourceId).toBe("prod_school")
  })

  it("subscription-backed access records adapt with SUBSCRIPTION source", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_2",
      userId: "user_1",
      productId: "prod_ecom",
      orderId: null,
      subscriptionId: "sub_9",
    })
    const eff = await getEffectiveEntitlements({ type: "USER", userId: "user_1" })
    expect(eff[0].sourceType).toBe(EntitlementSourceType.SUBSCRIPTION)
    expect(eff[0].sourceReference).toBe("sub_9")
  })

  it("admin-created access records (no order/subscription) adapt with ADMIN_GRANT source", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_3",
      userId: "user_1",
      productId: "prod_x",
      orderId: null,
      subscriptionId: null,
    })
    const eff = await getEffectiveEntitlements({ type: "USER", userId: "user_1" })
    expect(eff[0].sourceType).toBe(EntitlementSourceType.ADMIN_GRANT)
  })

  it("hasEntitlement works against adapted purchase access", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_4",
      userId: "user_1",
      productId: "prod_school",
      orderId: "order_1",
    })
    expect(await hasEntitlement({ type: "USER", userId: "user_1" }, "product.prod_school")).toBe(true)
    expect(await hasEntitlement({ type: "USER", userId: "user_1" }, "product.prod_other")).toBe(false)
  })

  it("another customer never sees the first customer's purchase access", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_5",
      userId: "user_1",
      productId: "prod_school",
      orderId: "order_1",
    })
    expect(await hasEntitlement({ type: "USER", userId: "user_999" }, "product.prod_school")).toBe(false)
  })

  it("expired purchase access is adapted away (no stale access)", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_6",
      userId: "user_1",
      productId: "prod_lapsed",
      orderId: "order_2",
      expiresAt: new Date(Date.now() - 1000),
    })
    const eff = await getEffectiveEntitlements({ type: "USER", userId: "user_1" })
    expect(eff).toHaveLength(0)
  })
})