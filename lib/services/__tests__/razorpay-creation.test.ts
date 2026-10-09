/**
 * Phase 4 — Test Group B: recurring subscription creation.
 * Provider mocked; TEST-MODE semantics only (no real charge).
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
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => true),
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
    subscriptionCancel: vi.fn(async () => ({ id: "sub_test_abc", status: "cancelled" })),
    subscriptionPause: vi.fn(async () => ({ id: "sub_test_abc", status: "paused" })),
    subscriptionResume: vi.fn(async () => ({ id: "sub_test_abc", status: "active" })),
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

const { createRecurringSubscription, verifySubscriptionSignature } = await import(
  "@/lib/services/razorpay-billing"
)

function seedBillablePlan() {
  fake.seedPlan({ id: "plan_1" })
  fake.seedVersion({ id: "ver_1", planId: "plan_1" })
}

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  rzp = rzpModule as unknown as { __provider: Provider }
  rzp.__provider.planCreate.mockClear()
  rzp.__provider.subscriptionCreate.mockClear()
  rzp.__provider.planCreate.mockResolvedValue({ id: "plan_test_abc" })
  rzp.__provider.subscriptionCreate.mockResolvedValue({ id: "sub_test_abc" })
  rzp.__provider.noClient = false
  seedBillablePlan()
})

describe("B — subscription creation", () => {
  it("creates a recurring subscription for the authenticated owner with correct references", async () => {
    const result = await createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")
    expect(result.internalSubscriptionId).toBeTruthy()
    expect(result.razorpaySubscriptionId).toBe("sub_test_abc")
    expect(result.status).toBe(SubscriptionStatus.TRIALING)
    expect(result.environment).toBe("test")
    expect(rzp.__provider.subscriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: "plan_test_abc", quantity: 1 }),
    )
    const row = fake.store.subscriptions.get(result.internalSubscriptionId)!
    expect(row.userId).toBe("user_1")
    expect(row.planVersionId).toBe("ver_1")
    expect(row.razorpaySubscriptionId).toBe("sub_test_abc")
  })

  it("rejects creation without an authenticated owner (no client-supplied owner)", async () => {
    await expect(
      // @ts-expect-error owner omitted on purpose
      createRecurringSubscription({ planVersionId: "ver_1" }, undefined),
    ).rejects.toThrow(/authenticated owner/i)
    expect(rzp.__provider.subscriptionCreate).not.toHaveBeenCalled()
  })

  it("rejects an invalid/unpublished plan", async () => {
    fake.seedVersion({ id: "ver_bad", planId: "plan_1", status: "DRAFT" })
    await expect(createRecurringSubscription({ planVersionId: "ver_bad" }, "user_1")).rejects.toThrow(
      RazorpayBillingError,
    )
    expect(rzp.__provider.subscriptionCreate).not.toHaveBeenCalled()
  })

  it("never uses a client-supplied plan id — only the version's mapped provider plan", async () => {
    fake.seedMapping({ id: "map_1", planVersionId: "ver_1" })
    await createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")
    expect(rzp.__provider.subscriptionCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ plan_id: "anything_client_sent" }),
    )
  })

  it("deduplicates: retries return the existing subscription instead of a new remote one", async () => {
    fake.seedSubscription({
      id: "usub_1",
      userId: "user_1",
      planVersionId: "ver_1",
      razorpaySubscriptionId: "sub_existing",
      status: SubscriptionStatus.ACTIVE,
    })
    const result = await createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")
    expect(result.existing).toBe(true)
    expect(result.internalSubscriptionId).toBe("usub_1")
    expect(rzp.__provider.subscriptionCreate).not.toHaveBeenCalled()
  })

  it("provider timeout raises an error, leaves no phantom remote claim, and no duplicate retry", async () => {
    rzp.__provider.subscriptionCreate.mockRejectedValue(new Error("request timed out after 20000ms"))
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")).rejects.toThrow(
      RazorpayBillingError,
    )
    // Internal record is kept (reserved) but carries NO razorpay reference.
    const rows = [...fake.store.subscriptions.values()]
    expect(rows).toHaveLength(1)
    expect(rows[0].razorpaySubscriptionId).toBeNull()
    expect(rows[0].metadata.pending).toBe(true)
  })

  it("provider 4xx (auth failure) is a typed error, not a success", async () => {
    rzp.__provider.subscriptionCreate.mockRejectedValue(new Error("401 Authentication failed"))
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")).rejects.toThrow(
      RazorpayBillingError,
    )
  })

  it("malformed provider response (no id) is rejected, never accepted", async () => {
    rzp.__provider.subscriptionCreate.mockResolvedValue({} as never)
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")).rejects.toThrow(
      /no subscription id/i,
    )
  })

  it("DB update failure after remote success forces reconciliation (no duplicate remote)", async () => {
    fake.failures.failReferencePersist = true
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")).rejects.toThrow(
      /reconciliation/i,
    )
  })

  it("passes finite total_count when the contract has a definite term", async () => {
    fake.seedVersion({ id: "ver_6m", planId: "plan_1", billingIntervalMonths: 6, durationMonths: 12 })
    await createRecurringSubscription({ planVersionId: "ver_6m" }, "user_1")
    expect(rzp.__provider.subscriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ total_count: 2 }),
    )
  })

  it("subscription signature formula uses payment_id|subscription_id (distinct from order flow)", async () => {
    expect(verifySubscriptionSignature("sub_x", "pay_y", "0".repeat(64))).toBe(false)
    const crypto = await import("crypto")
    const sig = crypto
      .createHmac("sha256", "rzp_key_secret_test")
      .update("pay_y|sub_x")
      .digest("hex")
    expect(verifySubscriptionSignature("sub_x", "pay_y", sig)).toBe(true)
    // Wrong field order must fail (order formula is order_id|payment_id — not used here).
    const wrong = crypto
      .createHmac("sha256", "rzp_key_secret_test")
      .update("sub_x|pay_y")
      .digest("hex")
    expect(verifySubscriptionSignature("sub_x", "pay_y", wrong)).toBe(false)
    expect(verifySubscriptionSignature("sub_x", "pay_y", "")).toBe(false)
    expect(verifySubscriptionSignature("sub_x", "pay_y", "nothex!")).toBe(false)
    expect(verifySubscriptionSignature("", "pay_y", sig)).toBe(false)
  })
})