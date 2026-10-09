/**
 * Phase 5 — Test Groups F (overlapping grants) + G (idempotency) + H (atomicity).
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
  seedWorld()
})

describe("F — overlapping grants (source separation)", () => {
  it("expiring a subscription grant leaves the standalone grant effective", async () => {
    const NOW = Date.now()
    fake.seedSubscription({
      id: "usub_1",
      userId: "user_1",
      status: "EXPIRED",
      planVersionId: "ver_1",
      currentPeriodStart: new Date(NOW - 60 * 86_400_000),
      currentPeriodEnd: new Date(NOW - 1000),
    })
    // Standalone source grant (read-only legacy path) + subscription source grant.
    fake.seedGrant(
      { id: "g_standalone", entitlementKey: "product.prod_1", subjectUserId: "user_1", sourceType: "STANDALONE_PURCHASE", sourceReference: "order_1" },
      "order_1",
    )
    fake.seedGrant({ id: "g_sub", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW - 1000) }, "usub_1")
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "e" },
      "system",
    )
    expect(fake.store.grants.get("g_sub")!.status).toBe("EXPIRED")
    expect(fake.store.grants.get("g_standalone")!.status).toBe("ACTIVE")
  })

  it("expiring Subscription A leaves Subscription B's grant effective", async () => {
    const NOW = Date.now()
    fake.seedSubscription({
      id: "usub_1",
      userId: "user_1",
      status: "EXPIRED",
      planVersionId: "ver_1",
      currentPeriodStart: new Date(NOW - 60 * 86_400_000),
      currentPeriodEnd: new Date(NOW - 1000),
    })
    fake.seedSubscription({ id: "usub_b", userId: "user_1", status: "ACTIVE", planVersionId: "ver_1" })
    fake.seedGrant({ id: "g_a", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW - 1000) }, "usub_1")
    fake.seedGrant({ id: "g_b", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_b")
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "e" },
      "system",
    )
    expect(fake.store.grants.get("g_a")!.status).toBe("EXPIRED")
    expect(fake.store.grants.get("g_b")!.status).toBe("ACTIVE")
  })

  it("revoking via ACCESS_REVOCATION touches only the exact source", async () => {
    fake.seedGrant({ id: "g_only_a", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_1")
    fake.seedGrant({ id: "g_unrelated", entitlementKey: "product.prod_1", subjectUserId: "user_1", sourceType: "ADMIN_GRANT", sourceReference: "adm_1" }, "adm_1")
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.ACCESS_REVOCATION, periodRef: "r" },
      "system",
    )
    expect(fake.store.grants.get("g_only_a")!.status).toBe("REVOKED")
    expect(fake.store.grants.get("g_unrelated")!.status).toBe("ACTIVE")
  })
})

describe("G — idempotency", () => {
  it("repeated activation produces exactly one grant set", async () => {
    const first = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "ev_1" },
      "system",
    )
    const second = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "ev_1" },
      "system",
    )
    expect(first.status).toBe("SUCCEEDED")
    expect(second.duplicate).toBe(true)
    expect(fake.store.grants.size).toBe(1)
  })

  it("different billing periods are processed independently", async () => {
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "pay_1" },
      "system",
    )
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "pay_2" },
      "system",
    )
    expect(fake.store.provs.size).toBe(2)
  })

  it("an already-completed provisioning operation is replay-safe", async () => {
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "done" },
      "system",
    )
    const replay = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "done" },
      "system",
    )
    expect(replay.duplicate).toBe(true)
    expect(fake.store.provs.size).toBe(1)
  })
})

describe("H — database atomicity / partial provisioning", () => {
  it("a failure partway through a multi-item plan never reports a complete bundle", async () => {
    fake.seedVersion("ver_two", [
      { itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" },
      { itemType: "PRODUCT", itemRefId: "prod_2", itemRefKey: "prod_2" },
    ])
    fake.seedDef("product.prod_2")
    fake.seedSubscription({ id: "usub_two", userId: "user_1", status: "ACTIVE", planVersionId: "ver_two" })
    fake.failures.failGrantCreate = true // fails mid-bundle
    await expect(
      provisionSubscription({ subscriptionId: "usub_two", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "atomic" }),
    ).rejects.toThrow()
    const rec = [...fake.store.provs.values()].find((p) => p.periodRef === "atomic")
    expect(rec?.status).toBe("FAILED_RETRYABLE")
    // Recovery with the same identity completes exactly one correct bundle.
    fake.failures.failGrantCreate = false
    const retry = await provisionSubscription(
      { subscriptionId: "usub_two", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "atomic" },
      "system",
    )
    expect(retry.status).toBe("SUCCEEDED")
    expect([...fake.store.grants.values()]).toHaveLength(2)
  })
})
