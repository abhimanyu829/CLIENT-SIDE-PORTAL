/**
 * Phase 1 — Failure tests.
 * DB unavailable / transaction failure / constraint failure / malformed input:
 * no partial unsafe subscription state may survive.
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

beforeEach(() => {
  fake = createFakeDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedUser("user_ok")
  fake.seedProduct("prod_1")
  fake.seedTier("tier_1", "prod_1")
})

const VALID = {
  userId: "user_ok",
  productId: "prod_1",
  tierId: "tier_1",
  source: "CHECKOUT" as const,
  environment: "test",
}

describe("DB failure handling", () => {
  it("subscription.create failure propagates and leaves zero partial state", async () => {
    fake.failures.failCreateOnCall = 1
    await expect(createFoundationSubscription(VALID)).rejects.toThrow(
      "simulated DB failure on subscription.create",
    )
    expect(fake.store.subscriptions.size).toBe(0)
    expect(fake.store.auditLogs).toHaveLength(0)
  })

  it("$transaction failure during transition leaves status untouched and no audit", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE })
    fake.failures.failTransaction = true
    await expect(
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.PAUSED, "a", "r"),
    ).rejects.toThrow("simulated DB failure on $transaction")
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
    expect(fake.store.auditLogs).toHaveLength(0)
  })

  it("updateMany failure inside transition leaves status untouched", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE })
    fake.failures.failUpdateManyOnCall = 1
    await expect(
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.CANCELLED, "a", "r"),
    ).rejects.toThrow("simulated DB failure on subscription.updateMany")
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
  })
})

describe("constraint failure handling", () => {
  it("duplicate primary key surfaces as a thrown constraint error, no overwrite", async () => {
    fake.seedSubscription("sub_fixed", { status: SubStatus.ACTIVE })
    // Force the next create to reuse the same id via data injection path:
    // createFoundationSubscription generates its own cuid — emulate the
    // constraint by directly invoking the delegate with a colliding id.
    await expect(
      fake.db.subscription.create({
        data: {
          id: "sub_fixed",
          userId: "user_ok",
          productId: "prod_1",
          tierId: "tier_1",
          status: SubStatus.TRIALING,
        },
      }),
    ).rejects.toThrow("Unique constraint failed on Subscription.id")
    expect(fake.store.subscriptions.get("sub_fixed")!.status).toBe(SubStatus.ACTIVE)
  })
})

describe("malformed input handling (fail-fast, DB never touched)", () => {
  it.each([
    ["null input", null],
    ["undefined input", undefined],
    ["array input", []],
    ["string input", "sub"],
    ["empty object", {}],
    ["missing tier", { userId: "user_ok", productId: "prod_1", source: "CHECKOUT", environment: "test" }],
  ])("%s rejected before any DB call", async (_label, input) => {
    const createCallsBefore = fake.callCounts.subscriptionCreate
    await expect(createFoundationSubscription(input)).rejects.toThrow()
    expect(fake.callCounts.subscriptionCreate).toBe(createCallsBefore)
    expect(fake.store.subscriptions.size).toBe(0)
  })
})

describe("no partial unsafe state — invariant sweep", () => {
  it("after any failed operation the store contains only fully-valid rows", async () => {
    // One good create
    const good = await createFoundationSubscription(VALID)
    // Several failing attempts
    fake.failures.failCreateOnCall = fake.callCounts.subscriptionCreate + 1
    await expect(createFoundationSubscription(VALID)).rejects.toThrow()
    await expect(
      createFoundationSubscription({ ...VALID, userId: "ghost" }),
    ).rejects.toThrow()
    delete fake.failures.failCreateOnCall

    for (const row of fake.store.subscriptions.values()) {
      expect(row.userId).toBeTruthy()
      expect(row.productId).toBeTruthy()
      expect(row.tierId).toBeTruthy()
      expect(Object.values(SubStatus)).toContain(row.status)
      expect(["development", "test", "production"]).toContain(row.environment)
    }
    expect(fake.store.subscriptions.has(good.id)).toBe(true)
    expect(fake.store.subscriptions.size).toBe(1)
  })
})
