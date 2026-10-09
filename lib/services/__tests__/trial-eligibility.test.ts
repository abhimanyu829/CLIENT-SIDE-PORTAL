/**
 * Phase 6 — Test Group B: trial eligibility.
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

const { startTrial } = await import("@/lib/services/free-trial-service")

function seedWorld(over: Partial<{ planType: string | null; planStatus: string; versionStatus: string }> = {}) {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedPlan(
    {
      id: "plan_paid",
      planType: over.planType === undefined ? "MONTHLY" : over.planType,
      status: over.planStatus ?? "PUBLISHED",
      currentVersionId: "plan_paid_v1",
    },
    [
      {
        id: "plan_paid_v1",
        status: over.versionStatus ?? "PUBLISHED",
        items: [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }],
      },
    ],
  )
}

beforeEach(() => {
  fake = createFakeFreeTrialDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("B — trial eligibility", () => {
  it("eligible verified customer starts a trial for a published paid plan", async () => {
    const result = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(result.status).toBe(TrialStatus.ACTIVE)
    expect(result.expiresAt.getTime() - result.startedAt.getTime()).toBe(14 * 86_400_000)
    expect(fake.store.grants.size).toBe(1)
    expect([...fake.store.grants.values()][0].sourceType).toBe("TRIAL")
  })

  it("unverified account is not eligible", async () => {
    fake.seedUser("user_unv", { isVerified: false })
    await expect(startTrial({ userId: "user_unv", planId: "plan_paid" })).rejects.toThrow(/not eligible/i)
  })

  it("an already ACTIVE trial for the same scope blocks a second", async () => {
    await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" }, "system")).rejects.toThrow(
      /already active|not eligible/i,
    )
    expect(fake.store.trials.size).toBe(1)
    expect(fake.store.grants.size).toBe(1)
  })

  it("consumed trial (expired/cancelled/converted) cannot be restarted on the same scope", async () => {
    const first = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.trials.get(first.enrollmentId)!.status = TrialStatus.EXPIRED
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" }, "system")).rejects.toThrow(
      /already used|not eligible/i,
    )
  })

  it("existing active paid subscription makes the customer ineligible", async () => {
    fake.store.usubs.push({ id: "usub_pay", userId: "user_1", planVersionId: "plan_paid_v1", status: "ACTIVE" })
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(FreeTrialError)
    expect(fake.store.grants.size).toBe(0)
  })

  it("FREE plan cannot be a trial eligibility source", async () => {
    seedWorld({ planType: "FREE" })
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(/cannot be trial eligibility/i)
  })

  it("unpublished plan or unpublished version is ineligible", async () => {
    seedWorld({ planStatus: "ARCHIVED" })
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(/not published/i)
    seedWorld({ planStatus: "PUBLISHED", versionStatus: "DRAFT" })
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(/no published version/i)
  })

  it("wrong/banned customer cannot trial for another account", async () => {
    fake.seedUser("user_2")
    const forUser1 = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    // user_2 has its own scope — eligible separately; user_1's trial is untouched.
    const forUser2 = await startTrial({ userId: "user_2", planId: "plan_paid" }, "system")
    expect(forUser1.enrollmentId).not.toBe(forUser2.enrollmentId)
    fake.seedUser("banned", { isBanned: true })
    await expect(startTrial({ userId: "banned", planId: "plan_paid" })).rejects.toThrow(/banned/i)
  })
})