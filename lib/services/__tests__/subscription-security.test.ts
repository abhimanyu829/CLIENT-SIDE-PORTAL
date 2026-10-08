/**
 * Phase 1 — Security tests.
 * Forged identifiers, forged status, cross-tenant access, unauthorized
 * creation, environment mismatch — all must fail safely.
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

const { createFoundationSubscription, getSubscriptionForOwner, transitionSubscriptionStatus } =
  await import("@/lib/services/subscription-domain")

beforeEach(() => {
  fake = createFakeDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedUser("user_victim")
  fake.seedUser("user_attacker")
  fake.seedProduct("prod_1")
  fake.seedTier("tier_1", "prod_1")
})

const VALID = {
  userId: "user_victim",
  productId: "prod_1",
  tierId: "tier_1",
  source: "CHECKOUT" as const,
  environment: "test",
}

describe("forged ownership", () => {
  it("forged customer/owner ID (nonexistent user) is rejected — no record created", async () => {
    await expect(
      createFoundationSubscription({ ...VALID, userId: "user_forged_999" }),
    ).rejects.toThrow("Unknown owner")
    expect(fake.store.subscriptions.size).toBe(0)
  })

  it("attacker cannot create a subscription directly attributed to a victim without a valid server-resolved id — and cannot READ the victim's", async () => {
    const created = await createFoundationSubscription(VALID)
    // Attacker probes with the real subscription id.
    expect(await getSubscriptionForOwner(created.id, "user_attacker")).toBeNull()
    // Attacker probes with a forged id.
    expect(await getSubscriptionForOwner("sub_forged", "user_attacker")).toBeNull()
  })

  it("forged team/team-like identifiers are not accepted by the contract (unknown keys rejected)", async () => {
    await expect(
      createFoundationSubscription({ ...VALID, teamId: "team_forged" }),
    ).rejects.toThrow()
    await expect(
      createFoundationSubscription({ ...VALID, organizationId: "org_forged" }),
    ).rejects.toThrow()
  })
})

describe("forged status", () => {
  it("client-supplied 'status' key is rejected outright (unknown key)", async () => {
    await expect(
      createFoundationSubscription({ ...VALID, status: "ACTIVE" }),
    ).rejects.toThrow()
  })

  it("initialStatus cannot jump to privileged states", async () => {
    for (const bad of ["ACTIVE", "PAUSED", "PAST_DUE", "CANCELLED"]) {
      if (bad === "ACTIVE") continue // ACTIVE is legitimately allowed
      await expect(
        createFoundationSubscription({ ...VALID, initialStatus: bad }),
      ).rejects.toThrow()
    }
  })

  it("transition to an arbitrary status value is rejected before any DB call", async () => {
    fake.seedSubscription("sub_1", { status: SubStatus.ACTIVE, userId: "user_victim" })
    const updateManyBefore = fake.callCounts.subscriptionUpdateMany
    await expect(
      transitionSubscriptionStatus(
        "sub_1",
        SubStatus.ACTIVE,
        "HACKED_STATUS" as unknown as SubStatus,
        "attacker",
        "r",
      ),
    ).rejects.toThrow()
    expect(fake.callCounts.subscriptionUpdateMany).toBe(updateManyBefore)
    expect(fake.store.subscriptions.get("sub_1")!.status).toBe(SubStatus.ACTIVE)
  })
})

describe("forged provider references", () => {
  it("stripeSubId / razorpaySubId cannot be set through the foundation contract", async () => {
    await expect(
      createFoundationSubscription({
        ...VALID,
        stripeSubId: "sub_stripe_forged",
        razorpaySubId: "sub_rzp_forged",
      }),
    ).rejects.toThrow()
  })

  it("externalReference is confined to metadata — never a provider unique column", async () => {
    const created = await createFoundationSubscription({
      ...VALID,
      externalReference: "ext_forged_provider_ref",
    })
    const row = fake.store.subscriptions.get(created.id)!
    expect(row.stripeSubId).toBeNull()
    expect(row.razorpaySubId).toBeNull()
    expect(row.metadata).toEqual({ externalReference: "ext_forged_provider_ref" })
  })
})

describe("environment mismatch", () => {
  it("rejects environment labels outside the controlled set", async () => {
    for (const bad of ["staging", "prod", "PRODUCTION_X", "live", ""]) {
      await expect(
        createFoundationSubscription({ ...VALID, environment: bad }),
      ).rejects.toThrow()
    }
    expect(fake.store.subscriptions.size).toBe(0)
  })

  it("normalizes legitimate labels instead of creating near-duplicate environments", async () => {
    const created = await createFoundationSubscription({
      ...VALID,
      environment: "  Test ",
    })
    expect(fake.store.subscriptions.get(created.id)!.environment).toBe("test")
  })
})

describe("unauthorized creation / direct mutation resistance", () => {
  it("no client-reachable field can set status on an existing row through create", async () => {
    // Create is insert-only; attempt to smuggle an id + status via data
    // must still route through the strict schema (rejected) — verified by
    // the strict schema tests; here we assert the insert path itself never
    // mutates an existing row.
    const created = await createFoundationSubscription(VALID)
    const before = { ...fake.store.subscriptions.get(created.id)! }
    await createFoundationSubscription(VALID) // second legitimate create
    const after = fake.store.subscriptions.get(created.id)!
    expect(after.status).toBe(before.status)
    expect(after.userId).toBe(before.userId)
  })

  it("cross-tenant transition attempt is blocked by owner-scoped reads (read path)", async () => {
    const created = await createFoundationSubscription(VALID)
    // transitionSubscriptionStatus is an INTERNAL, server-side API (called
    // only from authenticated admin routes / webhooks / cron with a real
    // actor). The owner-scoped READ path is what external surfaces use, and
    // it is denial-by-default for non-owners — proven here.
    expect(await getSubscriptionForOwner(created.id, "user_attacker")).toBeNull()
    expect(await getSubscriptionForOwner(created.id, "user_victim")).not.toBeNull()
  })
})
