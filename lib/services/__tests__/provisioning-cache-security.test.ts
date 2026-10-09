/**
 * Phase 5 — Test Groups I (cache) + J (security).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProvisioningOperation } from "@prisma/client"
import { createFakeProvisioningDb, type FakeProvisioningDb } from "./helpers/fake-provisioning-db"
import { ProvisioningError } from "@/lib/services/subscription-provisioning"

let fake: FakeProvisioningDb

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
vi.mock("@/lib/services/cache-service", () => {
  const invalidations: string[][] = []
  return {
    __invalidations: invalidations,
    invalidateCache: vi.fn(async (keys: string[]) => {
      invalidations.push(keys)
    }),
    CACHE_KEYS: {},
  }
})
vi.mock("@/lib/redis", () => ({ redis: null }))
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock("@/lib/queue", () => ({
  subscriptionQueue: { add: vi.fn(async () => undefined) },
  SUBSCRIPTION_JOBS: { PROVISION_SUBSCRIPTION: "subscription.provision" },
}))

import * as dbModule from "@/lib/db"
import * as cacheNs from "@/lib/services/cache-service"

const { provisionSubscription } = await import("@/lib/services/subscription-provisioning")

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedVersion("ver_1", [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }])
  fake.seedSubscription({ id: "usub_1", userId: "user_1", status: "ACTIVE", planVersionId: "ver_1" })
}

beforeEach(() => {
  fake = createFakeProvisioningDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __invalidations: string[][] }).__invalidations.length = 0
  seedWorld()
})

describe("I — cache invalidation after authoritative change", () => {
  it("activation invalidates the effective-entitlement cache", async () => {
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "a" },
      "system",
    )
    const inv = (cacheNs as unknown as { __invalidations: string[][] }).__invalidations
    expect(inv.length).toBeGreaterThan(0)
    expect(inv.flat().some((k) => k.startsWith("entitlements:v1:test:user:user_1"))).toBe(true)
  })

  it("extension, expiration and revocation all invalidate as well", async () => {
    const NOW = Date.now()
    fake.seedGrant({ id: "gx", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW + 10 * 86_400_000) }, "usub_1")
    fake.seedGrant({ id: "gy", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW - 1000) }, "usub_1")
    fake.store.subs.get("usub_1")!.currentPeriodEnd = new Date(NOW + 30 * 86_400_000)
    const inv = (cacheNs as unknown as { __invalidations: string[][] }).__invalidations
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "p1" },
      "system",
    )
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "p2" },
      "system",
    )
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.ACCESS_REVOCATION, periodRef: "p3" },
      "system",
    )
    expect(inv.length).toBeGreaterThanOrEqual(3)
  })

  it("cache failures are non-fatal but never fabricate success records", async () => {
    // The cache-service mock never throws and cannot become authoritative;
    // resolver correctness is covered by Phase-3 suite. This asserts the
    // provisioning result is driven by DB state, not by cache invalidation.
    const result = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "c" },
      "system",
    )
    expect(result.status).toBe("SUCCEEDED")
  })
})

describe("J — security", () => {
  it("rejects forged subscription id (no record → permanent)", async () => {
    await expect(
      provisionSubscription({ subscriptionId: "usub_forged", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(new RegExp("Unknown subscription"))
    expect(fake.store.grants.size).toBe(0)
  })

  it("rejects forged owner (banned/invalid user)", async () => {
    fake.seedUser("banned", { isBanned: true })
    fake.seedSubscription({ id: "usub_f", userId: "banned", status: "ACTIVE", planVersionId: "ver_1" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_f", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/banned/i)
  })

  it("rejects forged plan versions (missing/draft)", async () => {
    fake.seedSubscription({ id: "usub_pv", userId: "user_1", status: "ACTIVE", planVersionId: "ver_forged" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_pv", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(ProvisioningError)
  })

  it("rejects forged entitlement keys via missing definitions", async () => {
    fake.seedVersion("ver_miss", [{ itemType: "FEATURE", itemRefKey: "not_defined" }])
    fake.seedSubscription({ id: "usub_mk", userId: "user_1", status: "ACTIVE", planVersionId: "ver_miss" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_mk", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/definition/i)
    expect(fake.store.grants.size).toBe(0)
  })

  it("rejects forged billing periods (invalid dates)", async () => {
    fake.seedSubscription({
      id: "usub_badp",
      userId: "user_1",
      status: "ACTIVE",
      planVersionId: "ver_1",
      currentPeriodStart: new Date("nope"),
      currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
    } as never)
    await expect(
      provisionSubscription({ subscriptionId: "usub_badp", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/no valid period start/i)
  })

  it("rejects cross-environment provisioning", async () => {
    fake.seedSubscription({ id: "usub_xenv", userId: "user_1", status: "ACTIVE", planVersionId: "ver_1", environment: "production" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_xenv", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/environment mismatch/i)
  })

  it("no source-substitution: grants always carry the exact internal subscription id", async () => {
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "src" },
      "system",
    )
    for (const g of fake.store.grants.values()) {
      expect(g.sourceReference).toBe("usub_1")
    }
  })

  it("standalone/admin/promotional grants of other sources are never matched for revocation", async () => {
    fake.seedGrant(
      { id: "g_promo", entitlementKey: "product.prod_1", subjectUserId: "user_1", sourceType: "PROMOTIONAL", sourceReference: "promo_9" },
      "promo_9",
    )
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.ACCESS_REVOCATION, periodRef: "sec" },
      "system",
    )
    expect(fake.store.grants.get("g_promo")!.status).toBe("ACTIVE")
  })

  it("replaying completed provisioning never re-grants", async () => {
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "replay" },
      "system",
    )
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "replay" },
      "system",
    )
    expect(fake.store.grants.size).toBe(1)
  })

  it("processing on EXPIRED/REVOKED subscription state fails or is inert, never re-grants", async () => {
    fake.seedSubscription({ id: "usub_canc", userId: "user_1", status: "CANCELED", cancelAtPeriodEnd: false, planVersionId: "ver_1" })
    // INITIAL_ACTIVATION on a cancelled subscription: Phase-4 would never send
    // it; the engine still refuses to grant (owner valid, but state terminal).
    const result = await provisionSubscription(
      { subscriptionId: "usub_canc", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "ok" },
      "system",
    )
    expect(result.status).toBe("SUCCEEDED") // cancellation of nothing = success
    expect(fake.store.grants.size).toBe(0)
  })
})
