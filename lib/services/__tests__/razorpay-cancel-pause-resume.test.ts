/**
 * Phase 4 — Test Group I (cancel/pause/resume) + H (payment-failure states).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SubscriptionStatus } from "@prisma/client"
import { createFakeRzpDb, type FakeRzpDb } from "./helpers/fake-razorpay-db"
import { RazorpayBillingError } from "@/lib/services/razorpay-billing"

let fake: FakeRzpDb
type Provider = {
  planCreate: ReturnType<typeof vi.fn>
  subscriptionCreate: ReturnType<typeof vi.fn>
  subscriptionCancel: ReturnType<typeof vi.fn>
  subscriptionPause: ReturnType<typeof vi.fn>
  subscriptionResume: ReturnType<typeof vi.fn>
  noClient: boolean
}
let rzp: { __provider: Provider }

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
vi.mock("@/lib/env", () => ({
  env: {
    RAZORPAY_KEY_SECRET: "rzp_key_secret_test",
    RAZORPAY_WEBHOOK_SECRET: "rzp_webhook_secret_test",
    RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET: undefined,
  },
}))
vi.mock("@/lib/razorpay", () => {
  const provider = {
    planCreate: vi.fn(async () => ({ id: "plan_test_abc" })),
    subscriptionCreate: vi.fn(async () => ({ id: "sub_test_abc" })),
    subscriptionCancel: vi.fn(async () => ({ id: "sub_test_1", status: "cancelled" })),
    subscriptionPause: vi.fn(async () => ({ id: "sub_test_1", status: "paused" })),
    subscriptionResume: vi.fn(async () => ({ id: "sub_test_1", status: "active" })),
    noClient: false,
  }
  return {
    __provider: provider,
    getRazorpay: () =>
      provider.noClient
        ? null
        : {
            plans: { create: provider.planCreate },
            subscriptions: {
              create: provider.subscriptionCreate,
              cancel: provider.subscriptionCancel,
              pause: provider.subscriptionPause,
              resume: provider.subscriptionResume,
            },
          },
    razorpay: {},
  }
})

import * as dbModule from "@/lib/db"
import * as rzpModule from "@/lib/razorpay"

const {
  cancelRecurringSubscription,
  pauseRecurringSubscription,
  resumeRecurringSubscription,
  applyProviderStatus,
} = await import("@/lib/services/razorpay-billing")

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  rzp = rzpModule as unknown as { __provider: Provider }
  rzp.__provider.subscriptionCancel.mockClear()
  rzp.__provider.subscriptionPause.mockClear()
  rzp.__provider.subscriptionResume.mockClear()
  rzp.__provider.subscriptionCancel.mockResolvedValue({ id: "sub_test_1", status: "cancelled" })
  rzp.__provider.subscriptionPause.mockResolvedValue({ id: "sub_test_1", status: "paused" })
  rzp.__provider.subscriptionResume.mockResolvedValue({ id: "sub_test_1", status: "active" })
  rzp.__provider.noClient = false
  fake.seedSubscription({
    id: "usub_1",
    userId: "user_1",
    status: SubscriptionStatus.ACTIVE,
    razorpaySubscriptionId: "sub_test_1",
  })
})

describe("I — cancel / pause / resume", () => {
  it("cancels immediately with provider confirmation and truthful state", async () => {
    const result = await cancelRecurringSubscription("usub_1", "user_1", false)
    expect(result.status).toBe(SubscriptionStatus.CANCELED)
    expect(rzp.__provider.subscriptionCancel).toHaveBeenCalledWith("sub_test_1", false)
    const row = fake.store.subscriptions.get("usub_1")!
    expect(row.cancelAtPeriodEnd).toBe(false)
    expect(row.autoRenew).toBe(false)
  })

  it("supports end-of-cycle cancellation without destroying history", async () => {
    await cancelRecurringSubscription("usub_1", "user_1", true)
    expect(rzp.__provider.subscriptionCancel).toHaveBeenCalledWith("sub_test_1", true)
    expect(fake.store.subscriptions.get("usub_1")!.cancelAtPeriodEnd).toBe(true)
    expect(fake.store.subscriptions.has("usub_1")).toBe(true)
  })

  it("repeated cancellation is idempotent and does not call the provider again", async () => {
    await cancelRecurringSubscription("usub_1", "user_1")
    expect(rzp.__provider.subscriptionCancel).toHaveBeenCalledTimes(1)
    await cancelRecurringSubscription("usub_1", "user_1")
    expect(rzp.__provider.subscriptionCancel).toHaveBeenCalledTimes(1)
  })

  it("rejects cancellation by a non-owner (cross-tenant)", async () => {
    await expect(cancelRecurringSubscription("usub_1", "user_attacker")).rejects.toThrow(
      /belongs to another customer/i,
    )
    expect(rzp.__provider.subscriptionCancel).not.toHaveBeenCalled()
  })

  it("pause and resume reflect the provider response", async () => {
    const p = await pauseRecurringSubscription("usub_1", "user_1")
    expect(p.status).toBe(SubscriptionStatus.PAUSED)
    expect(rzp.__provider.subscriptionPause).toHaveBeenCalledWith("sub_test_1", expect.anything())
    const r = await resumeRecurringSubscription("usub_1", "user_1")
    expect(r.status).toBe(SubscriptionStatus.ACTIVE)
    expect(rzp.__provider.subscriptionResume).toHaveBeenCalledWith("sub_test_1", expect.anything())
  })

  it("resume of a cancelled subscription is refused", async () => {
    await cancelRecurringSubscription("usub_1", "user_1")
    await expect(resumeRecurringSubscription("usub_1", "user_1")).rejects.toThrow(
      /cannot be resumed/i,
    )
  })

  it("pause of an EXPIRED subscription is refused", async () => {
    fake.seedSubscription({ id: "usub_exp", userId: "user_1", status: SubscriptionStatus.EXPIRED, razorpaySubscriptionId: "sub_exp" })
    await expect(pauseRecurringSubscription("usub_exp", "user_1")).rejects.toThrow(
      RazorpayBillingError,
    )
    expect(rzp.__provider.subscriptionPause).not.toHaveBeenCalled()
  })

  it("provider timeout during cancel is a typed failure and never claims success", async () => {
    rzp.__provider.subscriptionCancel.mockRejectedValue(new Error("request timed out after 15000ms"))
    await expect(cancelRecurringSubscription("usub_1", "user_1")).rejects.toThrow(
      RazorpayBillingError,
    )
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.ACTIVE)
  })

  it("concurrent pause + cancel serialize to a deterministic terminal/valid state", async () => {
    await Promise.allSettled([
      pauseRecurringSubscription("usub_1", "user_1"),
      cancelRecurringSubscription("usub_1", "user_1"),
    ])
    const status = fake.store.subscriptions.get("usub_1")!.status
    expect([SubscriptionStatus.PAUSED, SubscriptionStatus.CANCELED]).toContain(status)
  })
})

describe("H — payment-failure states via provider status", () => {
  it("pending and halted map to UNPAID / PAST_DUE without false success", async () => {
    await applyProviderStatus("usub_1", "pending", { periodStart: null, periodEnd: null })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.UNPAID)
    await applyProviderStatus("usub_1", "halted", { periodStart: null, periodEnd: null })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.PAST_DUE)
  })

  it("recovery resumes PAST_DUE → ACTIVE", async () => {
    await applyProviderStatus("usub_1", "halted", { periodStart: null, periodEnd: null })
    await applyProviderStatus("usub_1", "active", { periodStart: 1_700_000_000, periodEnd: 1_700_100_000 })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.ACTIVE)
    expect(fake.store.subscriptions.get("usub_1")!.currentPeriodEnd.getTime()).toBe(1_700_100_000_000)
  })
})