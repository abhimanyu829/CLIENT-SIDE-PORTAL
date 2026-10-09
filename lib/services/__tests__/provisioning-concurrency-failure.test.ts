/**
 * Phase 5 — Test Groups K (concurrency) + L (failure).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProvisioningOperation } from "@prisma/client"
import { createFakeProvisioningDb, type FakeProvisioningDb } from "./helpers/fake-provisioning-db"

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
vi.mock("@/lib/services/cache-service", () => ({
  invalidateCache: vi.fn(async () => undefined),
  CACHE_KEYS: {},
}))
vi.mock("@/lib/redis", () => ({ redis: null }))
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock("@/lib/queue", () => ({
  subscriptionQueue: { add: vi.fn(async () => undefined) },
  SUBSCRIPTION_JOBS: { PROVISION_SUBSCRIPTION: "subscription.provision" },
}))

import * as dbModule from "@/lib/db"

const { provisionSubscription, ProvisioningError } = await import(
  "@/lib/services/subscription-provisioning"
)

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedVersion("ver_1", [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }])
  fake.seedSubscription({ id: "usub_1", userId: "user_1", status: "ACTIVE", planVersionId: "ver_1" })
}

beforeEach(() => {
  fake = createFakeProvisioningDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("K — concurrency", () => {
  it("concurrent duplicate activations collapse to exactly one grant", async () => {
    const results = await Promise.allSettled([
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "race" }, "a"),
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "race" }, "b"),
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "race" }, "c"),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length
    expect(ok).toBeGreaterThanOrEqual(1)
    expect(fake.store.grants.size).toBe(1)
  })

  it("renewal + expiration race keeps the renewed period (deterministic)", async () => {
    const NOW = Date.now()
    fake.seedGrant({ id: "gr", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW - 1000) }, "usub_1")
    fake.store.subs.get("usub_1")!.currentPeriodEnd = new Date(NOW + 60 * 86_400_000)
    await Promise.allSettled([
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "r1" }, "a"),
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "e1" }, "b"),
    ])
    // The renewal extends the grant; expiration only expires grants at/before now.
    const finalGrant = fake.store.grants.get("gr")!
    expect(finalGrant.status).toBe("ACTIVE")
    expect(finalGrant.expiresAt!.getTime()).toBe(NOW + 60 * 86_400_000)
  })

  it("cancel + renew race is resolved by the idempotency record, never both grants", async () => {
    fake.seedSubscription({ id: "usub_r", userId: "user_1", status: "CANCELED", cancelAtPeriodEnd: false, planVersionId: "ver_1" })
    await Promise.allSettled([
      provisionSubscription({ subscriptionId: "usub_r", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "c" }, "a"),
      provisionSubscription({ subscriptionId: "usub_r", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "r" }, "b"),
    ])
    // Renewal on a cancelled subscription is contractually refused at Phase-4
    // boundary; the engine simply never fabricates grants: assert no phantom.
    expect([...fake.store.grants.values()].filter((g) => g.sourceReference === "usub_r")).toHaveLength(0)
  })
})

describe("L — failure", () => {
  it("provisioning record persistence failure is surfaced, not silently granted", async () => {
    fake.failures.failProvisioningCreate = true
    await expect(
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "f" }),
    ).rejects.toThrow(/claim provisioning operation/i)
    expect(fake.store.grants.size).toBe(0)
  })

  it("entitlement read failure is classified retryable and leaves no success", async () => {
    const NOW = Date.now()
    fake.seedSubscription({
      id: "usub_1",
      userId: "user_1",
      status: "EXPIRED",
      planVersionId: "ver_1",
      currentPeriodStart: new Date(NOW - 60 * 86_400_000),
      currentPeriodEnd: new Date(NOW - 1000),
    })
    fake.failures.failEntitlementRead = true
    await expect(
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "f2" }),
    ).rejects.toThrow(/entitlementGrant.findMany/)
    const rec = [...fake.store.provs.values()].find((p) => p.periodRef === "f2")
    expect(rec?.status).toBe("FAILED_RETRYABLE")
  })

  it("malformed plan (missing version) is permanent, not endlessly retried", async () => {
    fake.seedSubscription({ id: "usub_m", userId: "user_1", status: "ACTIVE", planVersionId: "ver_gone" })
    let caught: unknown
    try {
      await provisionSubscription({ subscriptionId: "usub_m", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "m" })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ProvisioningError)
    expect((caught as { code?: string }).code).toBe("PROVISIONING_MISSING_PLAN_VERSION")
    const rec = [...fake.store.provs.values()].find((p) => p.periodRef === "m")
    expect(rec?.status).toBe("FAILED_PERMANENT")
  })

  it("no unsafe grant on any failure: grants stay empty across failure scenarios", async () => {
    const before = fake.store.grants.size
    fake.failures.failGrantCreate = true
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "fail" },
      "system",
    ).catch(() => undefined)
    expect(fake.store.grants.size).toBe(before)
  })
})
