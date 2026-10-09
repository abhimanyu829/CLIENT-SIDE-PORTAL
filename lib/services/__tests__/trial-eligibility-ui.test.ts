/**
 * Phase 7 — server-computed trial eligibility (UI contract).
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

const { getTrialEligibility } = await import("@/lib/services/free-trial-service")
const { buildTrialScopeKey } = await import("@/lib/services/free-trial-lifecycle")

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

describe("server-computed trial eligibility (UI contract)", () => {
  it("reports eligible with the exact plan identifiers and duration", async () => {
    const info = await getTrialEligibility("user_1", "plan_paid")
    expect(info).toMatchObject({
      eligible: true,
      code: null,
      planId: "plan_paid",
      planName: "plan_paid",
      planVersionId: "plan_paid_v1",
      trialDays: 14,
    })
  })

  it("reports ineligible for an ACTIVE trial on the same scope", async () => {
    fake.seedTrial({ id: "tr_1", userId: "user_1", trialScopeKey: buildTrialScopeKey("user_1", "plan_paid_v1"), status: "ACTIVE", planVersionId: "plan_paid_v1" })
    const info = await getTrialEligibility("user_1", "plan_paid")
    expect(info.eligible).toBe(false)
    expect(info.code).toBe("TRIAL_ALREADY_ACTIVE")
  })

  it("reports consumed for an EXPIRED previous trial", async () => {
    fake.seedTrial({ id: "tr_2", userId: "user_1", trialScopeKey: buildTrialScopeKey("user_1", "plan_paid_v1"), status: TrialStatus.EXPIRED, planVersionId: "plan_paid_v1" })
    const info = await getTrialEligibility("user_1", "plan_paid")
    expect(info.eligible).toBe(false)
    expect(info.code).toBe("TRIAL_ALREADY_USED")
  })

  it("reports ineligible for an unverified account and existing paid subscription", async () => {
    fake.seedUser("unv", { isVerified: false })
    expect((await getTrialEligibility("unv", "plan_paid")).eligible).toBe(false)
    fake.store.usubs.push({ id: "usub_1", userId: "user_1", planVersionId: "plan_paid_v1", status: "ACTIVE" })
    expect((await getTrialEligibility("user_1", "plan_paid")).eligible).toBe(false)
  })

  it("reports unavailable for unknown/unpublished/FREE plans without throwing", async () => {
    const missing = await getTrialEligibility("user_1", "plan_ghost")
    expect(missing.eligible).toBe(false)
    expect(missing.planVersionId).toBeNull()
    expect(missing.code).toBeTruthy()
  })

  it("never throws for unknown users (UI-safe)", async () => {
    const info = await getTrialEligibility("ghost", "plan_paid")
    expect(info.eligible).toBe(false)
  })
})
