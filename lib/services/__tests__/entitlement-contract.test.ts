/**
 * Phase 3 — Test Group F: subscription / plan-version contract.
 * Plan Version → Plan Items → entitlement representation. No Razorpay.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementSourceType, PlanItemType } from "@prisma/client"
import {
  describePlanItemEntitlement,
  EntitlementError,
} from "@/lib/services/entitlement-lifecycle"
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

const { grantEntitlement } = await import("@/lib/services/entitlement-service")
const { getEffectiveEntitlements } = await import("@/lib/services/entitlement-resolver")

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
  fake.seedUser("user_1")
})

const VERIFIED_PLAN_ITEMS = [
  { itemType: PlanItemType.PRODUCT, itemRefId: "prod_a" },
  { itemType: PlanItemType.PRODUCT, itemRefId: "prod_b" },
  { itemType: PlanItemType.AI_CAPABILITY, itemRefId: "agent_1" },
  { itemType: PlanItemType.STORAGE, limitValue: 20, limitUnit: "GB" },
  { itemType: PlanItemType.ADMIN_LIMIT, limitValue: 5, limitUnit: "admins" },
  { itemType: PlanItemType.SUPPORT, itemRefKey: "priority" },
]

describe("F — plan-version → entitlement contract", () => {
  it("describes the full verified composition deterministically (no grants created)", async () => {
    const descriptors = VERIFIED_PLAN_ITEMS.map((item) => describePlanItemEntitlement(item as never))
    expect(descriptors.map((d) => d.key)).toEqual([
      "product.prod_a",
      "product.prod_b",
      "ai.agent_1",
      "limit.storage",
      "limit.admin_users",
      "support.priority",
    ])
    expect(fake.store.grants.size).toBe(0)
  })

  it("rejects unmappable plan item types", () => {
    expect(() =>
      describePlanItemEntitlement({ itemType: "SOMETHING_ELSE" } as never),
    ).toThrow(EntitlementError)
  })

  it("a future provisioning flow can convert descriptors into grants (Phase-5 contract)", async () => {
    const descriptors = VERIFIED_PLAN_ITEMS.map((item) => describePlanItemEntitlement(item as never))
    for (const key of ["product.prod_a", "product.prod_b", "ai.agent_1", "support.priority"]) {
      fake.store.definitions.set(`def_${key}`, {
        id: `def_${key}`,
        key,
        name: key,
        description: null,
        type: key.startsWith("product") ? "PRODUCT" : key.startsWith("ai") ? "AI_CAPABILITY" : "SUPPORT",
        resourceType: null,
        configuration: {},
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    for (const d of descriptors.filter((x) => x.type !== "STORAGE" && x.type !== "ADMIN_LIMIT")) {
      await grantEntitlement(
        {
          entitlementKey: d.key,
          subjectType: "USER",
          subjectUserId: "user_1",
          sourceType: EntitlementSourceType.SUBSCRIPTION,
          sourceReference: "sub_future",
        },
        "provisioner",
      )
    }
    const eff = await getEffectiveEntitlements({ type: "USER", userId: "user_1" })
    expect(eff.map((g) => g.key).sort()).toEqual([
      "ai.agent_1",
      "product.prod_a",
      "product.prod_b",
      "support.priority",
    ])
  })
})
