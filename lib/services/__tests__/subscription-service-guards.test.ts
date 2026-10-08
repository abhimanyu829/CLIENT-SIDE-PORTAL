/**
 * Phase 1 — Guard hardening tests for the EXISTING subscription-service.
 *
 * Proves the transition guards were wired in without changing any legal
 * behaviour, and that the one intentional behaviour change works:
 *   a CANCELLED subscription can no longer be revived by a late
 *   "payment failed" event (CANCELLED -> PAST_DUE is blocked).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SubStatus } from "@prisma/client"
import { createFakeDb, type FakeDb } from "./helpers/fake-db"

let fake: FakeDb

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
vi.mock("@/lib/redis", () => ({ redis: null }))

import * as dbModule from "@/lib/db"

const {
  cancelSubscription,
  pauseSubscription,
  reactivateSubscription,
  markSubscriptionPastDue,
  activateSubscription,
  changePlan,
  startGracePeriod,
  expireOverdueSubscriptions,
} = await import("@/lib/services/subscription-service")

beforeEach(() => {
  fake = createFakeDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedUser("user_ok")
  fake.seedProduct("prod_1")
  fake.seedTier("tier_1", "prod_1")
})

describe("guard: cancelSubscription", () => {
  it("cancels an ACTIVE subscription (existing behaviour preserved)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })
    const result = await cancelSubscription("sub_1", "admin_1", "requested")
    expect(result.success).toBe(true)
    const row = fake.store.subscriptions.get("sub_1")!
    expect(row.status).toBe(SubStatus.CANCELLED)
    expect(row.cancelledAt).toBeInstanceOf(Date)
    expect(fake.store.auditLogs.length).toBeGreaterThanOrEqual(1)
  })

  it("is idempotent on already-CANCELLED (webhook retry safe)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    const result = await cancelSubscription("sub_1", "admin_1", "retry")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.CANCELLED)
  })
})

describe("guard: pauseSubscription", () => {
  it("pauses an ACTIVE subscription", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })
    const result = await pauseSubscription("sub_1", "admin_1", "requested")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.PAUSED)
  })

  it("refuses to PAUSE a CANCELLED subscription (hardening)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    const result = await pauseSubscription("sub_1", "admin_1", "nope")
    expect(result.success).toBe(false)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.CANCELLED)
  })
})

describe("guard: reactivateSubscription", () => {
  it("reactivates a CANCELLED subscription (legal exit from terminal state)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    const result = await reactivateSubscription("sub_1", "admin_1")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
  })
})

describe("guard: markSubscriptionPastDue (the key hardening)", () => {
  it("marks an ACTIVE subscription PAST_DUE (existing webhook behaviour preserved)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })
    const result = await markSubscriptionPastDue("sub_1", "system", "card failed")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.PAST_DUE)
  })

  it("refuses to mark a CANCELLED subscription PAST_DUE (intentional Phase-1 fix)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    const result = await markSubscriptionPastDue("sub_1", "system", "late failure webhook")
    expect(result.success).toBe(false)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.CANCELLED)
    // No audit entry for a refused transition.
    expect(fake.store.auditLogs).toHaveLength(0)
  })
})

describe("guard: activateSubscription", () => {
  it("activates a TRIALING subscription with a future period", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.TRIALING, userId: "user_ok" })
    const result = await activateSubscription("sub_1", "system")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
  })

  it("activates a CANCELLED subscription (legal reactivation edge, e.g. repurchase)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    const result = await activateSubscription("sub_1", "system")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
  })
})

describe("guard: changePlan", () => {
  it("changes plan on an ACTIVE subscription", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })
    fake.seedTier("tier_2", "prod_1")
    const result = await changePlan("sub_1", "tier_2", "admin_1", "upgrade")
    expect(result.success).toBe(true)
    const row = fake.store.subscriptions.get("sub_1")!
    expect(row.tierId).toBe("tier_2")
    expect(row.status).toBe(SubStatus.ACTIVE)
  })

  it("changePlan on a CANCELLED subscription reactivates it (documented legal edge)", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    fake.seedTier("tier_2", "prod_1")
    const result = await changePlan("sub_1", "tier_2", "admin_1", "upgrade")
    expect(result.success).toBe(true)
    expect(fake.store.subscriptions.get("sub_1")!.tierId).toBe("tier_2")
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
  })
})

describe("guard: startGracePeriod", () => {
  it("starts a grace period on a PAST_DUE subscription", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.PAST_DUE, userId: "user_ok" })
    const result = await startGracePeriod("sub_1", "system", "retrying", 3)
    expect(result.success).toBe(true)
    expect(result.gracePeriodEnd.getTime()).toBeGreaterThan(Date.now())
    const row = fake.store.subscriptions.get("sub_1")!
    expect(row.status).toBe(SubStatus.PAST_DUE)
    expect((row.metadata as any).gracePeriodEnd).toBeTruthy()
  })

  it("refuses grace period on a CANCELLED subscription", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED, userId: "user_ok" })
    const result = await startGracePeriod("sub_1", "system", "r", 3)
    expect(result.success).toBe(false)
  })
})

describe("guard: expireOverdueSubscriptions", () => {
  it("expires only overdue ACTIVE/TRIALING/PAST_DUE rows; cancelled rows untouched", async () => {
    const past = new Date(Date.now() - 86400_000)
    fake.seedSubscription("sub_overdue", { status: SubStatus.ACTIVE, userId: "user_ok", currentPeriodEnd: past })
    fake.seedSubscription("sub_cancelled", { status: SubStatus.CANCELLED, userId: "user_ok", currentPeriodEnd: past })
    fake.seedSubscription("sub_fresh", { status: SubStatus.ACTIVE, userId: "user_ok" })

    const result = await expireOverdueSubscriptions()
    expect(result.expired).toBe(1)
    expect(fake.store.subscriptions.get("sub_overdue")!.status).toBe(SubStatus.CANCELLED)
    expect(fake.store.subscriptions.get("sub_cancelled")!.status).toBe(SubStatus.CANCELLED)
    expect(fake.store.subscriptions.get("sub_fresh")!.status).toBe(SubStatus.ACTIVE)
  })
})
