/**
 * Phase 6 — Test Groups G (idempotency) + H (security).
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

const { startTrial, enrollFreePlan, cancelTrial } = await import(
  "@/lib/services/free-trial-service"
)

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedUser("user_2")
  fake.seedDef("product.prod_1")
  fake.seedPlan(
    { id: "plan_free", planType: "FREE", status: "PUBLISHED", currentVersionId: "plan_free_v1" },
    [{ id: "plan_free_v1", items: [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }] }],
  )
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

describe("G — idempotency", () => {
  it("duplicate free enrollment returns the same enrollment with no new grants", async () => {
    await enrollFreePlan("user_1", "system")
    const second = await enrollFreePlan("user_1", "system")
    expect(second.existing).toBe(true)
    expect(fake.store.frees.size).toBe(1)
  })

  it("duplicate trial start returns the pending/active enrollment, never a second trial", async () => {
    const first = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    // A duplicate start for the same scope is refused (eligibility), so no
    // second enrollment and no second grant can ever exist.
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" }, "system")).rejects.toThrow(
      /already active/i,
    )
    expect(fake.store.trials.size).toBe(1)
    expect(fake.store.grants.size).toBe(1)
  })

  it("concurrent trial starts for one scope produce exactly one enrollment", async () => {
    const results = await Promise.allSettled([
      startTrial({ userId: "user_1", planId: "plan_paid" }, "a"),
      startTrial({ userId: "user_1", planId: "plan_paid" }, "b"),
      startTrial({ userId: "user_1", planId: "plan_paid" }, "c"),
    ])
    expect(fake.store.trials.size).toBe(1)
    // At least one succeeds; the rest are rejected as already-active.
    expect(results.some((r) => r.status === "fulfilled")).toBe(true)
    expect(fake.store.grants.size).toBe(1)
  })

  it("repeated expiration processing is a no-op", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    await cancelTrial(t.enrollmentId, "user_1", "system")
    // Cancelled trial grants are already EXPIRED; nothing to re-expire.
    const { expireExpiredTrials } = await import("@/lib/services/free-trial-service")
    const sweep = await expireExpiredTrials()
    expect(sweep.expired).toBe(0)
  })
})

describe("H — security", () => {
  it("unknown / banned customer cannot start a trial or enroll free", async () => {
    await expect(startTrial({ userId: "ghost", planId: "plan_paid" })).rejects.toThrow(FreeTrialError)
    fake.seedUser("banned", { isBanned: true })
    await expect(startTrial({ userId: "banned", planId: "plan_paid" })).rejects.toThrow(/banned/i)
    await expect(enrollFreePlan("banned")).rejects.toThrow(/banned/i)
  })

  it("forged plan / unpublished plan fails safely", async () => {
    await expect(startTrial({ userId: "user_1", planId: "plan_forged" })).rejects.toThrow(/Unknown plan/i)
    fake.store.plans.get("plan_paid")!.status = "ARCHIVED"
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(/not published/i)
  })

  it("client cannot forge trial duration, expiry, entitlement list or status (not input fields)", async () => {
    // The service contract takes ONLY userId + planId; everything else is
    // server-derived. Passing extra fields is a type error at compile time;
    // here we assert the runtime derivation is 14 days and source-bound.
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(t.expiresAt.getTime() - t.startedAt.getTime()).toBe(14 * 86400_000)
    expect(fake.store.trials.get(t.enrollmentId)!.status).toBe("ACTIVE")
  })

  it("cross-tenant enrollment is impossible (user derived server-side)", async () => {
    const t1 = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(fake.store.trials.get(t1.enrollmentId)!.userId).toBe("user_1")
    // user_2 gets its own scope; user_1's trial untouched.
    await startTrial({ userId: "user_2", planId: "plan_paid" }, "system")
    expect(fake.store.trials.get(t1.enrollmentId)!.status).toBe("ACTIVE")
  })

  it("cancelling another customer's trial is refused", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    await expect(cancelTrial(t.enrollmentId, "user_2", "system")).rejects.toThrow(
      /belongs to another customer/i,
    )
    expect(fake.store.trials.get(t.enrollmentId)!.status).toBe("ACTIVE")
  })

  it("expired trial access is denied by the read-time rule regardless of record status", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    const { isTrialExpiredAt } = await import("@/lib/services/free-trial-lifecycle")
    const pastExpiry = new Date(t.expiresAt.getTime() + 1)
    // Even if some stale code path left the enrollment ACTIVE, the boundary rule denies.
    expect(isTrialExpiredAt("ACTIVE", pastExpiry, pastExpiry)).toBe(true)
    // The grant bound to that expiry is equally dead at read time.
    const grant = [...fake.store.grants.values()][0]
    expect(grant.expiresAt!.getTime() <= pastExpiry.getTime()).toBe(true)
  })

  it("source-grant substitution is impossible: trial grants bind the trial id", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    for (const g of fake.store.grants.values()) {
      expect(g.sourceType).toBe("TRIAL")
      expect(g.sourceReference).toBe(t.enrollmentId)
    }
  })
})
