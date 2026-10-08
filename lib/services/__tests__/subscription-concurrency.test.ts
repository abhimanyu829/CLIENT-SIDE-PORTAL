/**
 * Phase 1 — Concurrency tests.
 * Deterministic interleavings against the in-memory fake (CAS semantics).
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

const { createFoundationSubscription, transitionSubscriptionStatus } = await import(
  "@/lib/services/subscription-domain"
)
const { SubscriptionTransitionError } = await import("@/lib/services/subscription-state-machine")

beforeEach(() => {
  fake = createFakeDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedUser("user_ok")
  fake.seedProduct("prod_1")
  fake.seedTier("tier_1", "prod_1")
})

describe("concurrent subscription creation", () => {
  it("parallel creations produce distinct deterministic records", async () => {
    const input = {
      userId: "user_ok",
      productId: "prod_1",
      tierId: "tier_1",
      source: "CHECKOUT" as const,
      environment: "test",
    }
    const results = await Promise.all([
      createFoundationSubscription(input),
      createFoundationSubscription(input),
      createFoundationSubscription(input),
      createFoundationSubscription(input),
      createFoundationSubscription(input),
    ])
    const ids = new Set(results.map((r) => r.id))
    expect(ids.size).toBe(5)
    expect(fake.store.subscriptions.size).toBe(5)
    for (const r of results) expect(r.status).toBe(SubStatus.TRIALING)
  })
})

describe("concurrent state transitions (compare-and-set)", () => {
  it("two racing transitions from the same expected state: exactly one wins", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })

    const [a, b] = await Promise.allSettled([
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.PAUSED, "actor_a", "pause"),
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.CANCELLED, "actor_b", "cancel"),
    ])

    const outcomes = [a, b]
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled")
    const rejected = outcomes.filter((o) => o.status === "rejected")

    // Exactly one CAS wins; the loser sees a conflict (row moved elsewhere).
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      SubscriptionTransitionError,
    )

    const finalStatus = fake.store.subscriptions.get("sub_1")!.status
    const winner = (fulfilled[0] as PromiseFulfilledResult<{ status: SubStatus }>).value
    expect(finalStatus).toBe(winner.status)
  })

  it("racing identical transitions stay deterministic and idempotent", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })

    const results = await Promise.all([
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.PAUSED, "a", "r"),
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.PAUSED, "a", "r"),
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.PAUSED, "a", "r"),
    ])
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.PAUSED)
    const changedCount = results.filter((r) => r.changed).length
    expect(changedCount).toBeGreaterThanOrEqual(1)
    for (const r of results) expect(r.status).toBe(SubStatus.PAUSED)
  })

  it("stale actor cannot yank a subscription back into an old state via wrong expectation", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })
    await transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.CANCELLED, "a", "cancel")

    // Actor still believes status is ACTIVE (stale read) — CAS must fail.
    await expect(
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.PAUSED, "stale", "r"),
    ).rejects.toThrow(SubscriptionTransitionError)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.CANCELLED)
  })

  it("duplicate externalReference handling: foundation metadata is per-record, no shared unique key collision", async () => {
    const input = {
      userId: "user_ok",
      productId: "prod_1",
      tierId: "tier_1",
      source: "RAZORPAY_WEBHOOK" as const,
      environment: "test",
      externalReference: "same_ext_ref",
    }
    const [r1, r2] = await Promise.all([
      createFoundationSubscription(input),
      createFoundationSubscription(input),
    ])
    // Foundation layer is provider-independent: externalReference is a
    // metadata hint, NOT a unique provider column — provider phases own
    // the real unique constraint (stripeSubId/razorpaySubId remain null).
    expect(r1.id).not.toBe(r2.id)
    expect(fake.store.subscriptions.get(r1.id)!.stripeSubId).toBeNull()
    expect(fake.store.subscriptions.get(r2.id)!.razorpaySubId).toBeNull()
  })
})
