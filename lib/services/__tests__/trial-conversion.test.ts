/**
 * Phase 6 — Test Group E: trial-to-paid conversion (Phase 4/5 authoritative).
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

const { startTrial, confirmTrialConversion } = await import("@/lib/services/free-trial-service")

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

describe("E — conversion", () => {
  it("no conversion without authoritative paid subscription", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    await expect(confirmTrialConversion(t.enrollmentId, "system")).rejects.toThrow(
      /No verified ACTIVE paid subscription/i,
    )
    expect(fake.store.trials.get(t.enrollmentId)!.status).toBe("ACTIVE")
  })

  it("checkout initiated / payment pending never converts", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.usubs.push({ id: "usub_pending", userId: "user_1", planVersionId: "plan_paid_v1", status: "UNPAID" })
    await expect(confirmTrialConversion(t.enrollmentId, "system")).rejects.toThrow(
      /No verified ACTIVE paid subscription/i,
    )
  })

  it("verified paid subscription WITHOUT provisioned paid grants = conversion pending", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.usubs.push({ id: "usub_act", userId: "user_1", planVersionId: "plan_paid_v1", status: "ACTIVE" })
    await expect(confirmTrialConversion(t.enrollmentId, "system")).rejects.toThrow(
      /Paid entitlements not provisioned yet/i,
    )
  })

  it("converts after paid grants exist; trial grants retired AFTER paid access", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.usubs.push({ id: "usub_act", userId: "user_1", planVersionId: "plan_paid_v1", status: "ACTIVE" })
    // Phase-5 would have provisioned a SUBSCRIPTION-source grant.
    fake.seedGrant(
      { id: "g_paid", entitlementKey: "product.prod_1", status: "ACTIVE" },
      { subjectUserId: "user_1", sourceType: "SUBSCRIPTION", sourceReference: "usub_act" },
    )
    const result = await confirmTrialConversion(t.enrollmentId, "system")
    expect(result.status).toBe("CONVERTED")
    const trialGrants = [...fake.store.grants.values()].filter((g) => g.sourceType === "TRIAL")
    expect(trialGrants).toHaveLength(1)
    expect(trialGrants[0].status).toBe("EXPIRED")
    const paidGrant = [...fake.store.grants.values()].find((g) => g.sourceType === "SUBSCRIPTION")!
    expect(paidGrant.status).toBe("ACTIVE")
  })

  it("duplicate conversion events are idempotent", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.usubs.push({ id: "usub_act", userId: "user_1", planVersionId: "plan_paid_v1", status: "ACTIVE" })
    fake.seedGrant(
      { id: "g_paid2", entitlementKey: "product.prod_1", status: "ACTIVE" },
      { subjectUserId: "user_1", sourceType: "SUBSCRIPTION", sourceReference: "usub_act" },
    )
    await confirmTrialConversion(t.enrollmentId, "system")
    const again = await confirmTrialConversion(t.enrollmentId, "system")
    expect(again.duplicate).toBe(true)
  })

  it("conversion + expiration race: expired trial cannot convert, never leaves phantom paid access", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.store.trials.get(t.enrollmentId)!.status = TrialStatus.EXPIRED
    await expect(confirmTrialConversion(t.enrollmentId, "system")).rejects.toThrow(/Trial is EXPIRED/i)
  })

  it("no silent auto-charging: starting a trial creates no subscription and no charge", async () => {
    await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(fake.store.usubs).toHaveLength(0)
  })
})
