/**
 * Phase 1 — Subscription foundation service tests.
 * In-memory fake DB, no network.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SubStatus } from "@prisma/client"
import { createFakeDb, type FakeDb } from "./helpers/fake-db"

// ── Mock wiring ────────────────────────────────────────────────────────────────
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

const { createFoundationSubscription, getSubscriptionForOwner, transitionSubscriptionStatus } =
  await import("@/lib/services/subscription-domain")
const { SubscriptionTransitionError, SubscriptionValidationError } = await import(
  "@/lib/services/subscription-state-machine"
)

function seedWorld() {
  fake.seedUser("user_ok")
  fake.seedUser("user_banned", { isBanned: true })
  fake.seedProduct("prod_1")
  fake.seedTier("tier_1", "prod_1", true)
  fake.seedTier("tier_inactive", "prod_1", false)
  fake.seedTier("tier_other_product", "prod_other", true)
  fake.seedProduct("prod_other")
}

const VALID_INPUT = {
  userId: "user_ok",
  productId: "prod_1",
  tierId: "tier_1",
  source: "CHECKOUT",
  environment: "production",
}

beforeEach(() => {
  fake = createFakeDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("createFoundationSubscription — valid creation", () => {
  it("creates a TRIALING foundation record with controlled fields", async () => {
    const result = await createFoundationSubscription(VALID_INPUT)
    expect(result.id).toMatch(/^sub_/)
    expect(result.status).toBe(SubStatus.TRIALING)
    expect(result.source).toBe("CHECKOUT")
    expect(result.environment).toBe("production")

    const row = fake.store.subscriptions.get(result.id)!
    expect(row.userId).toBe("user_ok")
    expect(row.productId).toBe("prod_1")
    expect(row.tierId).toBe("tier_1")
    expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(row.currentPeriodStart.getTime())
  })

  it("honors explicit ACTIVE initial status and custom period", async () => {
    const start = new Date("2026-01-01T00:00:00Z")
    const end = new Date("2026-02-01T00:00:00Z")
    const result = await createFoundationSubscription({
      ...VALID_INPUT,
      source: "ADMIN",
      environment: "development",
      initialStatus: "ACTIVE",
      currentPeriodStart: start,
      currentPeriodEnd: end,
    })
    expect(result.status).toBe("ACTIVE")
    const row = fake.store.subscriptions.get(result.id)!
    expect(row.currentPeriodStart.toISOString()).toBe(start.toISOString())
    expect(row.currentPeriodEnd.toISOString()).toBe(end.toISOString())
    expect(row.source).toBe("ADMIN")
    expect(row.environment).toBe("development")
  })

  it("stores externalReference inside metadata, not a provider column", async () => {
    const result = await createFoundationSubscription({
      ...VALID_INPUT,
      externalReference: "ext_abc",
    })
    const row = fake.store.subscriptions.get(result.id)!
    expect(row.metadata).toEqual({ externalReference: "ext_abc" })
    expect(row.stripeSubId).toBeNull()
    expect(row.razorpaySubId).toBeNull()
  })
})

describe("createFoundationSubscription — ownership and referential integrity", () => {
  it("rejects unknown owner", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, userId: "user_missing" }),
    ).rejects.toThrow(SubscriptionValidationError)
    expect(fake.store.subscriptions.size).toBe(0)
  })

  it("rejects banned owner", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, userId: "user_banned" }),
    ).rejects.toThrow("Owner is banned")
  })

  it("rejects unknown product", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, productId: "prod_missing" }),
    ).rejects.toThrow(SubscriptionValidationError)
  })

  it("rejects unknown tier", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, tierId: "tier_missing" }),
    ).rejects.toThrow(SubscriptionValidationError)
  })

  it("rejects tier that belongs to a different product", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, tierId: "tier_other_product" }),
    ).rejects.toThrow("does not belong to product")
  })

  it("rejects inactive tier", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, tierId: "tier_inactive" }),
    ).rejects.toThrow("Tier is inactive")
  })

  it("rejects period end before or equal to start", async () => {
    const start = new Date("2026-02-01T00:00:00Z")
    const end = new Date("2026-01-01T00:00:00Z")
    await expect(
      createFoundationSubscription({
        ...VALID_INPUT,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      }),
    ).rejects.toThrow("currentPeriodEnd must be after currentPeriodStart")
  })
})

describe("createFoundationSubscription — controlled input contract", () => {
  it("rejects unknown keys (strict schema)", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, status: "ACTIVE", hacked: true }),
    ).rejects.toThrow(SubscriptionValidationError)
  })

  it("rejects forged status field — initialStatus limited to TRIALING/ACTIVE", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, initialStatus: "CANCELLED" }),
    ).rejects.toThrow(SubscriptionValidationError)
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, initialStatus: "PAST_DUE" }),
    ).rejects.toThrow(SubscriptionValidationError)
  })

  it("rejects unknown source", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, source: "PAYPAL" }),
    ).rejects.toThrow(SubscriptionValidationError)
  })

  it("rejects unknown environment", async () => {
    await expect(
      createFoundationSubscription({ ...VALID_INPUT, environment: "staging" }),
    ).rejects.toThrow(SubscriptionValidationError)
  })

  it("rejects malformed owner/product/tier identifiers", async () => {
    for (const bad of ["", "   ", 42, null, undefined]) {
      await expect(
        createFoundationSubscription({ ...VALID_INPUT, userId: bad as string }),
      ).rejects.toThrow(SubscriptionValidationError)
    }
  })
})

describe("getSubscriptionForOwner — ownership-checked read", () => {
  it("returns the record for the true owner", async () => {
    const created = await createFoundationSubscription(VALID_INPUT)
    const found = await getSubscriptionForOwner(created.id, "user_ok")
    expect(found).not.toBeNull()
    expect(found!.userId).toBe("user_ok")
  })

  it("returns null for a different user (cross-tenant denial)", async () => {
    const created = await createFoundationSubscription(VALID_INPUT)
    expect(await getSubscriptionForOwner(created.id, "user_attacker")).toBeNull()
  })

  it("returns null for unknown subscription (anti-enumeration)", async () => {
    expect(await getSubscriptionForOwner("sub_missing", "user_ok")).toBeNull()
  })

  it("returns null for forged/empty identifiers instead of throwing", async () => {
    expect(await getSubscriptionForOwner("", "user_ok")).toBeNull()
    expect(await getSubscriptionForOwner("sub_x", "")).toBeNull()
    expect(await getSubscriptionForOwner(undefined as unknown as string, "user_ok")).toBeNull()
  })
})

describe("transitionSubscriptionStatus — compare-and-set guarded transition", () => {
  it("performs a legal transition and writes an audit entry", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_ok" })
    const result = await transitionSubscriptionStatus(
      "sub_1",
      SubStatus.ACTIVE,
      SubStatus.PAUSED,
      "actor_admin",
      "operator pause",
    )
    expect(result).toEqual({ changed: true, status: SubStatus.PAUSED })
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.PAUSED)
    expect(fake.store.auditLogs).toHaveLength(1)
    expect(fake.store.auditLogs[0]).toMatchObject({
      userId: "actor_admin",
      action: "SUBSCRIPTION_STATUS_TRANSITIONED",
      entity: "Subscription",
      entityId: "sub_1",
      beforeJson: { status: SubStatus.ACTIVE },
      afterJson: { status: SubStatus.PAUSED, reason: "operator pause" },
    })
  })

  it("refuses illegal transition BEFORE any write", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED })
    await expect(
      transitionSubscriptionStatus("sub_1", SubStatus.CANCELLED, SubStatus.PAST_DUE, "a", "r"),
    ).rejects.toThrow(SubscriptionTransitionError)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.CANCELLED)
    expect(fake.store.auditLogs).toHaveLength(0)
  })

  it("is idempotent when the row is already in the target state", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.CANCELLED })
    const result = await transitionSubscriptionStatus(
      "sub_1",
      SubStatus.ACTIVE, // stale expectation
      SubStatus.CANCELLED,
      "a",
      "r",
    )
    expect(result).toEqual({ changed: false, status: SubStatus.CANCELLED })
    expect(fake.store.auditLogs).toHaveLength(0)
  })

  it("throws a conflict when the row moved to a different state", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.PAUSED })
    await expect(
      transitionSubscriptionStatus("sub_1", SubStatus.ACTIVE, SubStatus.CANCELLED, "a", "r"),
    ).rejects.toThrow(SubscriptionTransitionError)
  })

  it("throws validation error for unknown subscription id", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE })
    await expect(
      transitionSubscriptionStatus("sub_missing", SubStatus.ACTIVE, SubStatus.PAUSED, "a", "r"),
    ).rejects.toThrow("Unknown subscription")
  })

  it("rejects garbage status values", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE })
    await expect(
      transitionSubscriptionStatus(
        "sub_1",
        "HACKED" as unknown as SubStatus,
        SubStatus.PAUSED,
        "a",
        "r",
      ),
    ).rejects.toThrow(SubscriptionValidationError)
  })
})
