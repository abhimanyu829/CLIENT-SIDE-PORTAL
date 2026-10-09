/**
 * Phase 6 — Test Group F: overlapping access sources stay independent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrialStatus } from "@prisma/client"
import { createFakeFreeTrialDb, type FakeFreeTrialDb } from "./helpers/fake-free-trial-db"

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

const { startTrial, cancelTrial, expireExpiredTrials } = await import(
  "@/lib/services/free-trial-service"
)

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedPlan(
    { id: "plan_paid", planType: "MONTHLY", status: "PUBLISHED", currentVersionId: "plan_paid_v1" },
    [{ id: "plan_paid_v1", items: [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }] }],
  )
}

beforeEach(() => {
  fake = createFakeFreeTrialDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("F — overlapping grants (mandatory source separation)", () => {
  it("trial expiry never touches the standalone purchase grant", async () => {
    fake.seedGrant(
      { id: "g_standalone", entitlementKey: "product.prod_1", status: "ACTIVE", expiresAt: null },
      { subjectUserId: "user_1", sourceType: "STANDALONE_PURCHASE", sourceReference: "order_1" },
    )
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.trials.get(t.enrollmentId)!.expiresAt = new Date(Date.now() - 1000)
    await expireExpiredTrials()
    const trialGrant = [...fake.store.grants.values()].find((g) => g.sourceType === "TRIAL")!
    expect(trialGrant.status).toBe("EXPIRED")
    expect(fake.store.grants.get("g_standalone")!.status).toBe("ACTIVE")
  })

  it("trial cancellation never touches the free or subscription grants", async () => {
    fake.seedGrant(
      { id: "g_free", entitlementKey: "product.prod_1", status: "ACTIVE", expiresAt: null },
      { subjectUserId: "user_1", sourceType: "FREE_PLAN", sourceReference: "free_1" },
    )
    fake.seedGrant(
      { id: "g_sub", entitlementKey: "product.prod_1", status: "ACTIVE" },
      { subjectUserId: "user_1", sourceType: "SUBSCRIPTION", sourceReference: "usub_1" },
    )
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    await cancelTrial(t.enrollmentId, "user_1", "system")
    expect([...fake.store.grants.values()].find((g) => g.sourceType === "TRIAL")!.status).toBe("EXPIRED")
    expect(fake.store.grants.get("g_free")!.status).toBe("ACTIVE")
    expect(fake.store.grants.get("g_sub")!.status).toBe("ACTIVE")
  })

  it("expiring one trial never touches a second active trial with a different scope", async () => {
    fake.seedPlan(
      { id: "plan_b", planType: "THREE_MONTH", status: "PUBLISHED", currentVersionId: "plan_b_v1" },
      [{ id: "plan_b_v1", items: [{ itemType: "PRODUCT", itemRefId: "prod_2", itemRefKey: "prod_2" }] }],
    )
    fake.seedDef("product.prod_2")
    const a = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    const b = await startTrial({ userId: "user_1", planId: "plan_b" }, "system")
    fake.store.trials.get(a.enrollmentId)!.expiresAt = new Date(Date.now() - 1000)
    await expireExpiredTrials()
    expect(fake.store.trials.get(a.enrollmentId)!.status).toBe("EXPIRED")
    expect(fake.store.trials.get(b.enrollmentId)!.status).toBe("ACTIVE")
    expect([...fake.store.grants.values()].filter((g) => g.sourceType === "TRIAL" && g.status === "ACTIVE")).toHaveLength(1)
  })

  it("standalone + free + paid + trial all coexist; each source retires independently", async () => {
    fake.seedGrant(
      { id: "s", entitlementKey: "product.prod_1", status: "ACTIVE", expiresAt: null },
      { subjectUserId: "user_1", sourceType: "STANDALONE_PURCHASE", sourceReference: "o1" },
    )
    fake.seedGrant(
      { id: "f", entitlementKey: "product.prod_1", status: "ACTIVE", expiresAt: null },
      { subjectUserId: "user_1", sourceType: "FREE_PLAN", sourceReference: "fe1" },
    )
    fake.seedGrant(
      { id: "p", entitlementKey: "product.prod_1", status: "ACTIVE", expiresAt: new Date("2030-01-01T00:00:00Z") },
      { subjectUserId: "user_1", sourceType: "SUBSCRIPTION", sourceReference: "us_1" },
    )
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.trials.get(t.enrollmentId)!.expiresAt = new Date(Date.now() - 1000)
    await expireExpiredTrials()
    const remain = [...fake.store.grants.values()].filter((g) => g.status === "ACTIVE").map((g) => g.sourceType).sort()
    expect(remain).toEqual(["FREE_PLAN", "STANDALONE_PURCHASE", "SUBSCRIPTION"])
  })
})
