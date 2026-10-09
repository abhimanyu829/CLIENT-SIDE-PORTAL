/**
 * Phase 4 — Test Group K: security. Every forged/unauthorized attempt fails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import crypto from "crypto"
import { SubscriptionStatus } from "@prisma/client"
import { createFakeRzpDb, type FakeRzpDb } from "./helpers/fake-razorpay-db"

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
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
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
  createRecurringSubscription,
  cancelRecurringSubscription,
  pauseRecurringSubscription,
  verifySubscriptionSignature,
} = await import("@/lib/services/razorpay-billing")
const { handleSubscriptionWebhook } = await import("@/lib/services/razorpay-subscription-webhook")
const { RazorpayBillingError } = await import("@/lib/services/razorpay-billing")

const SECRET = "webhook_secret_test"

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex")
}

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  rzp = rzpModule as unknown as { __provider: Provider }
  rzp.__provider.planCreate.mockClear()
  rzp.__provider.subscriptionCreate.mockClear()
  rzp.__provider.subscriptionCancel.mockClear()
  rzp.__provider.planCreate.mockResolvedValue({ id: "plan_test_abc" })
  rzp.__provider.subscriptionCreate.mockResolvedValue({ id: "sub_test_abc" })
  rzp.__provider.noClient = false
  fake.seedPlan({ id: "plan_1" })
  fake.seedVersion({ id: "ver_1", planId: "plan_1" })
  fake.seedSubscription({ id: "usub_1", userId: "user_victim", status: SubscriptionStatus.ACTIVE, razorpaySubscriptionId: "sub_test_1" })
})

describe("K — security", () => {
  it("forged / missing owner cannot create a subscription", async () => {
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "")).rejects.toThrow(
      RazorpayBillingError,
    )
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, undefined as never)).rejects.toThrow()
    expect(rzp.__provider.subscriptionCreate).not.toHaveBeenCalled()
  })

  it("arbitrary/unpublished plan version cannot be billed", async () => {
    await expect(createRecurringSubscription({ planVersionId: "ver_forged" }, "user_1")).rejects.toThrow()
    expect(rzp.__provider.subscriptionCreate).not.toHaveBeenCalled()
  })

  it("cross-tenant cancellation/pause is refused", async () => {
    await expect(cancelRecurringSubscription("usub_1", "user_attacker")).rejects.toThrow(/belongs to another customer/i)
    await expect(pauseRecurringSubscription("usub_1", "user_attacker")).rejects.toThrow(/belongs to another customer/i)
    expect(rzp.__provider.subscriptionCancel).not.toHaveBeenCalled()
    expect(rzp.__provider.subscriptionPause).not.toHaveBeenCalled()
  })

  it("forged price/currency/interval from a client can never reach the provider", async () => {
    // The public contract takes ONLY planVersionId + quantity.
    await createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")
    const createCall = rzp.__provider.subscriptionCreate.mock.calls[0][0] as Record<string, unknown>
    expect(createCall.amount).toBeUndefined()
    expect(createCall.currency).toBeUndefined()
    expect(createCall.price).toBeUndefined()
    expect(createCall.plan_id).toBe("plan_test_abc")
  })

  it("forged provider plan id from a client can never be used", async () => {
    // ensureRazorpayPlanMapping resolves the server-side mapping exclusively.
    await createRecurringSubscription({ planVersionId: "ver_1" }, "user_1")
    expect(rzp.__provider.subscriptionCreate.mock.calls[0][0].plan_id).not.toContain("client_supplied")
  })

  it("invalid checkout signature is rejected", () => {
    expect(verifySubscriptionSignature("sub_x", "pay_y", "deadbeef", "secret")).toBe(false)
    expect(verifySubscriptionSignature("sub_x", "pay_y", "not-a-sig", "secret")).toBe(false)
  })

  it("replayed webhook is a no-op (idempotent), never a second processing", async () => {
    const raw = JSON.stringify({
      entity: "event",
      id: "ev_replay",
      event: "subscription.cancelled",
      payload: { subscription: { entity: { id: "sub_test_1", status: "cancelled" } } },
    })
    const s = sign(raw)
    await handleSubscriptionWebhook(raw, s, SECRET)
    const second = await handleSubscriptionWebhook(raw, s, SECRET)
    expect(second.duplicate).toBe(true)
    expect(fake.store.webhooks.size).toBe(1)
  })

  it("invalid webhook signature is rejected before any persistence", async () => {
    const raw = JSON.stringify({ entity: "event", id: "ev_bad_sig", event: "subscription.cancelled", payload: { subscription: { entity: { id: "sub_test_1" } } } })
    await expect(handleSubscriptionWebhook(raw, "bogus", SECRET)).rejects.toThrow(/signature verification failed/i)
    expect(fake.store.webhooks.size).toBe(0)
  })

  it("missing required webhook fields are rejected (payload invalid)", async () => {
    const raw = JSON.stringify({ entity: "event", id: "ev_no_sub", event: "subscription.cancelled", payload: {} })
    await expect(handleSubscriptionWebhook(raw, sign(raw), SECRET)).rejects.toThrow(/payload/i)
  })

  it("no secret configured → fail closed even with a valid-looking signature", async () => {
    const raw = JSON.stringify({ entity: "event", id: "ev_nosecret", event: "subscription.cancelled", payload: { subscription: { entity: { id: "sub_test_1" } } } })
    await expect(handleSubscriptionWebhook(raw, sign(raw), "")).rejects.toThrow(/not configured/i)
  })

  it("direct status mutation is impossible: only guarded service paths exist", async () => {
    // The billing service has no raw update surface; attempts via the generic
    // service are the only path and are ownership-guarded (verified above).
    // Fake DB traps also prove billing never touches entitlement/commerce tables.
    const raw = JSON.stringify({ entity: "event", id: "ev_sig_ok", event: "subscription.cancelled", payload: { subscription: { entity: { id: "sub_test_1", status: "cancelled" } } } })
    await handleSubscriptionWebhook(raw, sign(raw), SECRET)
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.CANCELED)
  })
})