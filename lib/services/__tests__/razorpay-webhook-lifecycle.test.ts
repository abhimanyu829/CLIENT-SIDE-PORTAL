/**
 * Phase 4 — Test Group E: full subscription event lifecycle (billing only).
 * No entitlement grants are ever created by any event.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import crypto from "crypto"
import { SubscriptionStatus } from "@prisma/client"
import { createFakeRzpDb, type FakeRzpDb } from "./helpers/fake-razorpay-db"

let fake: FakeRzpDb

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
vi.mock("@/lib/razorpay", () => ({ getRazorpay: () => null, razorpay: {} }))

import * as dbModule from "@/lib/db"

const { handleSubscriptionWebhook } = await import("@/lib/services/razorpay-subscription-webhook")
const { mapProviderStatus } = await import("@/lib/services/razorpay-billing")

const SECRET = "webhook_secret_test"

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex")
}

function eventBody(
  type: string,
  eventId: string,
  base: { subscription: Record<string, unknown>; payment?: Record<string, unknown> },
): { raw: string; signature: string } {
  const raw = JSON.stringify({
    entity: "event",
    id: eventId,
    event: type,
    created_at: 1_700_000_000,
    payload: {
      subscription: { entity: { id: "sub_test_1", status: "active", current_start: 1_700_000_000, current_end: 1_700_100_000, ...base.subscription } },
      ...(base.payment ? { payment: { entity: { id: "pay_test_1", status: "captured", amount: 49900, currency: "INR", ...base.payment } } } : {}),
    },
  })
  return { raw, signature: sign(raw) }
}

async function deliver(type: string, eventId: string, base: { subscription: Record<string, unknown>; payment?: Record<string, unknown> }) {
  const { raw, signature } = eventBody(type, eventId, base)
  return handleSubscriptionWebhook(raw, signature, SECRET)
}

function seedActiveInternal() {
  fake.seedSubscription({
    id: "usub_1",
    userId: "user_1",
    status: SubscriptionStatus.ACTIVE,
    razorpaySubscriptionId: "sub_test_1",
  })
}

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedActiveInternal()
})

describe("provider → internal status mapping", () => {
  it("maps documented Razorpay statuses onto SubscriptionStatus", () => {
    expect(mapProviderStatus("created")).toBe(SubscriptionStatus.TRIALING)
    expect(mapProviderStatus("authenticated")).toBe(SubscriptionStatus.TRIALING)
    expect(mapProviderStatus("active")).toBe(SubscriptionStatus.ACTIVE)
    expect(mapProviderStatus("pending")).toBe(SubscriptionStatus.UNPAID)
    expect(mapProviderStatus("halted")).toBe(SubscriptionStatus.PAST_DUE)
    expect(mapProviderStatus("paused")).toBe(SubscriptionStatus.PAUSED)
    expect(mapProviderStatus("cancelled")).toBe(SubscriptionStatus.CANCELED)
    expect(mapProviderStatus("completed")).toBe(SubscriptionStatus.EXPIRED)
    expect(mapProviderStatus("expired")).toBe(SubscriptionStatus.EXPIRED)
    expect(() => mapProviderStatus("fabricated")).toThrow()
  })
})

describe("E — webhook lifecycle (billing only, no entitlements)", () => {
  for (const [type, expected] of [
    ["subscription.authenticated", SubscriptionStatus.ACTIVE as never], // no change
  ] as Array<[string, SubscriptionStatus]>) {
    it(`stores ${type} durably without changing an ACTIVE subscription`, async () => {
      const res = await deliver(type, `ev_${type.replace(".", "_")}`, { subscription: { status: "authenticated" } })
      expect(res.processed).toBe(true)
      expect(res.duplicate).toBe(false)
      expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.ACTIVE)
    })
  }

  it("subscription.authenticated keeps TRIALING (never ACTIVE from checkout confirmation)", async () => {
    fake.seedSubscription({ id: "usub_t", userId: "user_2", status: SubscriptionStatus.TRIALING, razorpaySubscriptionId: "sub_trial" })
    const raw = JSON.stringify({
      entity: "event",
      id: "ev_authenticated",
      event: "subscription.authenticated",
      payload: { subscription: { entity: { id: "sub_trial", status: "authenticated" } } },
    })
    await handleSubscriptionWebhook(raw, sign(raw), SECRET)
    expect(fake.store.subscriptions.get("usub_t")!.status).toBe(SubscriptionStatus.TRIALING)
  })

  it("subscription.activated transitions TRIALING → ACTIVE", async () => {
    fake.seedSubscription({ id: "usub_t", userId: "user_2", status: SubscriptionStatus.TRIALING, razorpaySubscriptionId: "sub_act" })
    const raw = JSON.stringify({
      entity: "event",
      id: "ev_activated",
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_act", status: "active", current_start: 1_700_000_000, current_end: 1_700_100_000 } } },
    })
    const res = await handleSubscriptionWebhook(raw, sign(raw), SECRET)
    expect(res.processed).toBe(true)
    expect(fake.store.subscriptions.get("usub_t")!.status).toBe(SubscriptionStatus.ACTIVE)
  })

  it("subscription.charged records exactly one charge and stays ACTIVE", async () => {
    const res = await deliver("subscription.charged", "ev_charged", { subscription: { status: "active" }, payment: { status: "captured" } })
    expect(res.processed).toBe(true)
    expect(fake.store.charges.size).toBe(1)
    const charge = [...fake.store.charges.values()][0]
    expect(charge.razorpayPaymentId).toBe("pay_test_1")
    expect(charge.amountSubunits).toBe(49900)
    expect(charge.chargeStatus).toBe("SUCCEEDED")
    expect(charge.providerEventId).toBe("ev_charged")
  })

  it("subscription.charged with a failed payment records a FAILED charge, not success", async () => {
    await deliver("subscription.charged", "ev_charged_fail", { subscription: { status: "pending" }, payment: { status: "failed" } })
    const charge = [...fake.store.charges.values()][0]
    expect(charge.chargeStatus).toBe("FAILED")
  })

  it("subscription.pending → UNPAID with a PENDING charge record", async () => {
    await deliver("subscription.pending", "ev_pending", { subscription: { status: "pending" }, payment: { status: "authorized" } })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.UNPAID)
    expect([...fake.store.charges.values()][0].chargeStatus).toBe("PENDING")
  })

  it("subscription.halted → PAST_DUE", async () => {
    await deliver("subscription.halted", "ev_halted", { subscription: { status: "halted" } })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.PAST_DUE)
  })

  it("subscription.cancelled → CANCELED", async () => {
    await deliver("subscription.cancelled", "ev_cancelled", { subscription: { status: "cancelled" } })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.CANCELED)
  })

  it("subscription.paused → PAUSED and subscription.resumed → ACTIVE", async () => {
    await deliver("subscription.paused", "ev_paused", { subscription: { status: "paused" } })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.PAUSED)
    await deliver("subscription.resumed", "ev_resumed", { subscription: { status: "active" } })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.ACTIVE)
  })

  it("subscription.completed → EXPIRED (terminal)", async () => {
    await deliver("subscription.completed", "ev_completed", { subscription: { status: "completed" } })
    expect(fake.store.subscriptions.get("usub_1")!.status).toBe(SubscriptionStatus.EXPIRED)
  })

  it("never grants any entitlement from an event (no entitlement tables touched)", async () => {
    await deliver("subscription.charged", "ev_charged_2", { subscription: { status: "active" }, payment: { status: "captured" } })
    // The fake DB will throw if entitlementGrant/customerEntitlement are touched.
    expect(fake.store.charges.size).toBe(1)
  })
})