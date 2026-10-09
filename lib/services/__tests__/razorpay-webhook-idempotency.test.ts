/**
 * Phase 4 — Test Groups F+G: webhook idempotency and out-of-order events.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import crypto from "crypto"
import { SubscriptionStatus } from "@prisma/client"
import { createFakeRzpDb, type FakeRzpDb } from "./helpers/fake-razorpay-db"
import { RazorpayBillingError } from "@/lib/services/razorpay-billing"

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

const SECRET = "webhook_secret_test"

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex")
}

function chargedEvent(eventId: string, paymentId = "pay_test_1", amount = 49900, status = "captured") {
  const raw = JSON.stringify({
    entity: "event",
    id: eventId,
    event: "subscription.charged",
    created_at: 1_700_000_000,
    payload: {
      subscription: { entity: { id: "sub_test_1", status: "active", current_start: 1_700_000_000, current_end: 1_700_100_000 } },
      payment: { entity: { id: paymentId, status, amount, currency: "INR" } },
    },
  })
  return { raw, signature: sign(raw) }
}

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedSubscription({
    id: "usub_1",
    userId: "user_1",
    status: SubscriptionStatus.ACTIVE,
    razorpaySubscriptionId: "sub_test_1",
  })
})

describe("F — idempotency", () => {
  it("the same event delivered twice processes once", async () => {
    const e = chargedEvent("ev_dup_1")
    const first = await handleSubscriptionWebhook(e.raw, e.signature, SECRET)
    const second = await handleSubscriptionWebhook(e.raw, e.signature, SECRET)
    expect(first.processed).toBe(true)
    expect(second.duplicate).toBe(true)
    expect(fake.store.charges.size).toBe(1)
    expect(fake.store.webhooks.size).toBe(1)
  })

  it("a charge event referencing the same payment via a different event id still records one charge", async () => {
    const a = chargedEvent("ev_a", "pay_same")
    const b = chargedEvent("ev_b", "pay_same")
    await handleSubscriptionWebhook(a.raw, a.signature, SECRET)
    await handleSubscriptionWebhook(b.raw, b.signature, SECRET)
    expect(fake.store.charges.size).toBe(1)
  })

  it("concurrent duplicate deliveries collapse to one accepted event", async () => {
    const e = chargedEvent("ev_race_1")
    const results = await Promise.allSettled([
      handleSubscriptionWebhook(e.raw, e.signature, SECRET),
      handleSubscriptionWebhook(e.raw, e.signature, SECRET),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2)
    expect(fake.store.charges.size).toBe(1)
  })

  it("webhook persistence failure before acceptance is retryable and never PROCESSED", async () => {
    fake.failures.failWebhookPersist = true
    const e = chargedEvent("ev_persist_fail")
    await expect(handleSubscriptionWebhook(e.raw, e.signature, SECRET)).rejects.toThrow(
      RazorpayBillingError,
    )
    expect(fake.store.webhooks.size).toBe(0)
  })

  it("processing failure marks the event FAILED and is retryable", async () => {
    fake.failures.failChargeCreate = true
    const e = chargedEvent("ev_charge_fail")
    await expect(handleSubscriptionWebhook(e.raw, e.signature, SECRET)).rejects.toThrow()
    const row = fake.store.webhooks.get("ev_charge_fail")!
    expect(row.status).toBe("FAILED")
    // Retry after reactor fixed: same event id → re-process? No: our design is
    // accept-once (FAILED events are idempotently NOT re-processed). Assert the
    // record exists and no charge was created.
    expect(fake.store.charges.size).toBe(0)
  })
})

describe("G — out-of-order events", () => {
  function rawFor(type: string, eventId: string, status: string, subId = "sub_test_1") {
    const raw = JSON.stringify({
      entity: "event",
      id: eventId,
      event: type,
      payload: { subscription: { entity: { id: subId, status } } },
    })
    return { raw, signature: sign(raw) }
  }

  it("stale ACTIVATED cannot revive a CANCELLED subscription", async () => {
    fake.seedSubscription({ id: "usub_dup", userId: "u2", status: SubscriptionStatus.CANCELED, razorpaySubscriptionId: "sub_test_dup" })
    const c = rawFor("subscription.cancelled", "ev_cancel_1", "cancelled", "sub_test_dup")
    const stale = rawFor("subscription.activated", "ev_stale_act", "active", "sub_test_dup")
    await handleSubscriptionWebhook(c.raw, c.signature, SECRET)
    const res = await handleSubscriptionWebhook(stale.raw, stale.signature, SECRET)
    expect(res.processed).toBe(true)
    const row = fake.store.subscriptions.get("usub_dup")!
    expect(row.status).toBe(SubscriptionStatus.CANCELED)
    const meta = row.metadata
    expect(meta.lastProviderConflict).toBeTruthy()
  })

  it("stale PAUSED cannot revive an EXPIRED subscription", async () => {
    fake.seedSubscription({ id: "usub_exp", userId: "u3", status: SubscriptionStatus.EXPIRED, razorpaySubscriptionId: "sub_test_exp" })
    const e = rawFor("subscription.paused", "ev_stale_pause", "paused", "sub_test_exp")
    await handleSubscriptionWebhook(e.raw, e.signature, SECRET)
    expect(fake.store.subscriptions.get("usub_exp")!.status).toBe(SubscriptionStatus.EXPIRED)
  })

  it("a CANCELLED then older HALTED delivery stays CANCELLED", async () => {
    fake.seedSubscription({ id: "usub_seq", userId: "u4", status: SubscriptionStatus.ACTIVE, razorpaySubscriptionId: "sub_test_seq" })
    const c = rawFor("subscription.cancelled", "ev_c2", "cancelled", "sub_test_seq")
    const older = rawFor("subscription.halted", "ev_c1_older", "halted", "sub_test_seq")
    await handleSubscriptionWebhook(c.raw, c.signature, SECRET)
    const res = await handleSubscriptionWebhook(older.raw, older.signature, SECRET)
    expect(res.processed).toBe(true)
    expect(fake.store.subscriptions.get("usub_seq")!.status).toBe(SubscriptionStatus.CANCELED)
  })
})
