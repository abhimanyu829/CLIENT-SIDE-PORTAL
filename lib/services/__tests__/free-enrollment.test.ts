/**
 * Phase 6 — Test Group A: Free Forever enrollment.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeFreeTrialDb, type FakeFreeTrialDb } from "./helpers/fake-free-trial-db"
import { FreeTrialError } from "@/lib/services/free-trial-lifecycle"

let fake: FakeFreeTrialDb

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
vi.mock("@/lib/services/event-bus", () => ({
  emitEvent: vi.fn(async () => undefined),
  EVENTS: new Proxy({}, { get: (_t, prop: string) => prop }),
}))
vi.mock("@/lib/services/cache-service", () => ({
  invalidateCache: vi.fn(async () => undefined),
  CACHE_KEYS: {},
}))
vi.mock("@/lib/redis", () => ({ redis: null }))
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock("@/lib/queue", () => ({
  subscriptionQueue: { add: vi.fn(async () => undefined) },
  SUBSCRIPTION_JOBS: { TRIAL_EXPIRE: "subscription.trial-expire" },
}))

import * as dbModule from "@/lib/db"

const { enrollFreePlan } = await import("@/lib/services/free-trial-service")

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedDef("limit.storage")
  fake.seedPlan(
    { id: "plan_free", planType: "FREE", status: "PUBLISHED", currentVersionId: "plan_free_v1" },
    [
      {
        id: "plan_free_v1",
        items: [
          { itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" },
          { itemType: "STORAGE", itemRefKey: "storage", limitValue: 1, limitUnit: "GB" },
        ],
      },
    ],
  )
}

beforeEach(() => {
  fake = createFakeFreeTrialDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("A — free Forever", () => {
  it("enrolls and grants ONLY the published free-plan bundle (permanent, no payment)", async () => {
    const result = await enrollFreePlan("user_1", "system")
    expect(result.existing).toBe(false)
    expect(result.grantCount).toBe(2)
    const keys = [...fake.store.grants.values()].map((g) => g.entitlementKey).sort()
    expect(keys).toEqual(["limit.storage", "product.prod_1"])
    for (const g of fake.store.grants.values()) {
      expect(g.sourceType).toBe("FREE_PLAN")
      expect(g.expiresAt).toBeNull() // Free Forever: no automatic expiration
      expect(g.subjectUserId).toBe("user_1")
    }
  })

  it("repeated enrollment is idempotent (no duplicate grants)", async () => {
    await enrollFreePlan("user_1", "system")
    const second = await enrollFreePlan("user_1", "system")
    expect(second.existing).toBe(true)
    expect(fake.store.grants.size).toBe(2)
  })

  it("fails safely when no published FREE plan exists", async () => {
    fake.store.plans.delete("plan_free")
    await expect(enrollFreePlan("user_1", "system")).rejects.toThrow(FreeTrialError)
  })

  it("fails safely when the FREE plan has no published version", async () => {
    fake.store.plans.get("plan_free")!.currentVersionId = "plan_free_v2"
    fake.store.plans.get("plan_free")!.versions = [
      { id: "plan_free_v2", version: 2, status: "DRAFT", items: [] },
    ]
    await expect(enrollFreePlan("user_1", "system")).rejects.toThrow(/no published version/i)
    expect(fake.store.grants.size).toBe(0)
  })

  it("banned/unknown customer cannot enroll", async () => {
    fake.seedUser("bad_user", { isBanned: true })
    await expect(enrollFreePlan("bad_user")).rejects.toThrow(/banned/i)
    await expect(enrollFreePlan("ghost")).rejects.toThrow(FreeTrialError)
    expect(fake.store.frees.size).toBe(0)
  })

  it("free grants honor the plan's configured resource limits", async () => {
    await enrollFreePlan("user_1", "system")
    const storage = [...fake.store.grants.values()].find((g) => g.entitlementKey === "limit.storage")!
    expect(storage.limitValue).toBe(1)
    expect(storage.limitUnit).toBe("GB")
  })

  it("free enrollment creates NO subscription, payment or charge records", async () => {
    await enrollFreePlan("user_1", "system")
    expect(fake.store.usubs).toHaveLength(0)
    // Commerce/billing tables are trapped in the fake and would throw.
  })
})
