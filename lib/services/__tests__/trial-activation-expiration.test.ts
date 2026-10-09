/**
 * Phase 6 — Test Groups C (activation) + D (expiration).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrialStatus } from "@prisma/client"
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

const { startTrial, expireExpiredTrials } = await import("@/lib/services/free-trial-service")

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedDef("limit.storage")
  fake.seedDef("limit.admin_users")
  fake.seedPlan(
    { id: "plan_paid", planType: "MONTHLY", status: "PUBLISHED", currentVersionId: "plan_paid_v1" },
    [
      {
        id: "plan_paid_v1",
        items: [
          { itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" },
          { itemType: "STORAGE", itemRefKey: "storage", limitValue: 1, limitUnit: "GB" },
          { itemType: "ADMIN_LIMIT", itemRefKey: "admin_users", limitValue: 1, limitUnit: "admins" },
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

describe("C — trial activation", () => {
  it("activates with an exact 14-day UTC window and the correct plan version", async () => {
    const before = Date.now()
    const result = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(result.planVersionId).toBe("plan_paid_v1")
    expect(result.expiresAt.getTime() - result.startedAt.getTime()).toBe(14 * 86400_000)
    expect(result.startedAt.getTime()).toBeGreaterThanOrEqual(before)
    const trial = fake.store.trials.get(result.enrollmentId)!
    expect(trial.userId).toBe("user_1")
    expect(trial.status).toBe("ACTIVE")
  })

  it("grants default trial benefits from the plan config: 1 product + 1 admin + 1GB, no SEO/AEO", async () => {
    const result = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(result.grantCount).toBe(3)
    const keys = [...fake.store.grants.values()].map((g) => g.entitlementKey).sort()
    expect(keys).toEqual(["limit.admin_users", "limit.storage", "product.prod_1"])
    const admin = [...fake.store.grants.values()].find((g) => g.entitlementKey === "limit.admin_users")!
    expect(admin.limitValue).toBe(1)
    const storage = [...fake.store.grants.values()].find((g) => g.entitlementKey === "limit.storage")!
    expect(storage.limitValue).toBe(1)
    expect(storage.limitUnit).toBe("GB")
    for (const g of fake.store.grants.values()) {
      expect(g.sourceType).toBe("TRIAL")
      expect(g.sourceReference).toBe(result.enrollmentId)
      expect(g.expiresAt!.getTime()).toBe(result.expiresAt.getTime())
    }
  })

  it("missing entitlement definitions fail activation — no false success", async () => {
    fake.store.defs.delete("product.prod_1")
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" }, "system")).rejects.toThrow(
      FreeTrialError,
    )
    expect(fake.store.grants.size).toBe(0)
    const trial = [...fake.store.trials.values()][0]
    expect(trial.status).toBe("PENDING")
    expect(trial.provisioningError).toBeTruthy()
  })

  it("provisioning failure recovery: pending trial retries and activates on retry", async () => {
    fake.failures.failGrantCreate = true
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" }, "system")).rejects.toThrow(/provisioning failed/i)
    fake.failures.failGrantCreate = false
    const retry = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(retry.status).toBe("ACTIVE")
    expect(retry.existing).toBe(true)
    expect(fake.store.grants.size).toBe(3)
  })

  it("client cannot set duration/expiry — boundary is server-derived", async () => {
    const result = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(result.expiresAt.getTime() - result.startedAt.getTime()).toBe(14 * 86400_000)
  })
})

describe("D — trial expiration", () => {
  it("denies access at and after the boundary even if cleanup never runs", async () => {
    const result = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    const { isTrialExpiredAt } = await import("@/lib/services/free-trial-lifecycle")
    const trial = fake.store.trials.get(result.enrollmentId)!
    expect(isTrialExpiredAt("ACTIVE", trial.expiresAt)).toBe(false)
    expect(isTrialExpiredAt("ACTIVE", trial.expiresAt, new Date(trial.expiresAt!.getTime() + 1))).toBe(true)
    // grant expiry is identical to trial expiry → resolver denies at read time.
    const grant = [...fake.store.grants.values()][0]
    expect(grant.expiresAt!.getTime()).toBe(trial.expiresAt!.getTime())
  })

  it("cleanup worker expires only the exact trial's grants (idempotent)", async () => {
    const result = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.trials.get(result.enrollmentId)!.expiresAt = new Date(Date.now() - 1000)
    const sweep = await expireExpiredTrials()
    expect(sweep.expired).toBe(1)
    expect(fake.store.trials.get(result.enrollmentId)!.status).toBe("EXPIRED")
    for (const g of fake.store.grants.values()) expect(g.status).toBe("EXPIRED")
    // Second sweep is a no-op.
    const again = await expireExpiredTrials()
    expect(again.expired).toBe(0)
  })

  it("an active future trial is never touched by the sweep", async () => {
    await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    const sweep = await expireExpiredTrials(new Date(Date.now() - 1000))
    expect(sweep.expired).toBe(0)
    expect([...fake.store.trials.values()][0].status).toBe("ACTIVE")
  })
})
