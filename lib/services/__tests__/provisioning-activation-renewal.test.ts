/**
 * Phase 5 — Test Groups B (activation) + C (renewal).
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
  SUBSCRIPTION_JOBS: {
    EXPIRE_OVERDUE: "subscription.expire-overdue",
    RECONCILE: "subscription.reconcile",
    DUNNING_STEP: "dunning.step",
    SEND_EXPIRY_WARNING: "subscription.send-expiry-warning",
    REVOKE_ENTITLEMENTS: "subscription.revoke-entitlements",
    FULFILL_ORDER: "subscription.fulfill-order",
    PROVISION_SUBSCRIPTION: "subscription.provision",
  },
}))

import * as dbModule from "@/lib/db"

const { provisionSubscription, scheduleProvisioning } = await import(
  "@/lib/services/subscription-provisioning"
)
import * as queueNs from "@/lib/queue"

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedDef("product.prod_2")
  fake.seedDef("limit.storage")
  fake.seedVersion("ver_1", [
    { itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" },
    { itemType: "PRODUCT", itemRefId: "prod_2", itemRefKey: "prod_2" },
  ])
  const NOW = Date.now()
  fake.seedSubscription({
    id: "usub_1",
    userId: "user_1",
    status: "ACTIVE",
    planVersionId: "ver_1",
    currentPeriodStart: new Date(NOW - 86_400_000),
    currentPeriodEnd: new Date(NOW + 30 * 86_400_000),
  })
}

beforeEach(() => {
  fake = createFakeProvisioningDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("B — activation provisioning", () => {
  it("grants the complete entitlement bundle from the verified period", async () => {
    const result = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "ev_act" },
      "system",
    )
    expect(result.grantCount).toBe(2)
    const grant = [...fake.store.grants.values()].find((g) => g.entitlementKey === "product.prod_1")!
    expect(grant.sourceType).toBe("SUBSCRIPTION")
    expect(grant.sourceReference).toBe("usub_1")
    expect(grant.subjectUserId).toBe("user_1")
    expect(grant.startsAt.getTime()).toBe((fake.store.subs.get("usub_1")!.currentPeriodStart).getTime())
    expect(grant.expiresAt!.getTime()).toBe((fake.store.subs.get("usub_1")!.currentPeriodEnd).getTime())
    expect(grant.scope).toBe("RESOURCE")
    expect(grant.resourceId).toBe("prod_1")
  })

  it("resource-scoped product grants and global limit grants resolve distinctly", async () => {
    fake.seedVersion("ver_lim", [
      { itemType: "STORAGE", itemRefKey: "storage", limitValue: 20, limitUnit: "GB" },
    ])
    fake.seedSubscription({ id: "usub_lim", userId: "user_1", status: "ACTIVE", planVersionId: "ver_lim" })
    await provisionSubscription(
      { subscriptionId: "usub_lim", operation: ProvisioningOperation.INITIAL_ACTIVATION },
      "system",
    )
    const storage = [...fake.store.grants.values()][0]
    expect(storage.entitlementKey).toBe("limit.storage")
    expect(storage.scope).toBe("GLOBAL")
    expect(storage.limitValue).toBe(20)
    expect(storage.resourceId).toBeNull()
  })

  it("no grant occurs for a TRIALING (pending) subscription — no verified period", async () => {
    fake.seedSubscription({ id: "usub_pend", userId: "user_1", status: "TRIALING", planVersionId: "ver_1" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_pend", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/not ACTIVE/i)
    expect(fake.store.grants.size).toBe(0)
  })

  it("agrees with Phase-4 dup signal: activation retry after DB failure produces one result", async () => {
    fake.failures.failGrantCreate = true
    await expect(
      provisionSubscription({ subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "ev_r" }),
    ).rejects.toThrow(/entitlementGrant.create/)
    fake.failures.failGrantCreate = false
    const retry = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION, periodRef: "ev_r" },
      "system",
    )
    expect(retry.status).toBe("SUCCEEDED")
    expect([...fake.store.grants.values()]).toHaveLength(2)
  })
})

describe("B-queue — scheduling reuses BullMQ with a deterministic job id", () => {
  it("scheduleProvisioning enqueues exactly one job per operation identity", async () => {
    const add = vi.mocked(queueNs.subscriptionQueue.add as never) as unknown as ReturnType<typeof vi.fn>
    add.mockClear()
    await scheduleProvisioning({ subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "ev_x" })
    await scheduleProvisioning({ subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "ev_x" })
    expect(add).toHaveBeenCalledTimes(2) // BullMQ dedupes by jobId server-side
    const firstJobId = add.mock.calls[0][2].jobId as string
    const secondJobId = add.mock.calls[1][2].jobId as string
    expect(firstJobId).toBe(secondJobId)
  })
})

describe("C — renewal", () => {
  it("extends existing subscription grants to the new verified paid-through period", async () => {
    // Pre-existing grants from activation
    const NOW = Date.now()
    fake.seedGrant({ id: "g1", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW + 10 * 86_400_000) }, "usub_1")
    fake.seedGrant({ id: "g2", entitlementKey: "product.prod_2", subjectUserId: "user_1", expiresAt: new Date(NOW + 10 * 86_400_000) }, "usub_1")
    const before1 = fake.store.grants.get("g1")!.expiresAt!

    fake.store.subs.get("usub_1")!.currentPeriodStart = new Date(NOW + 29 * 86_400_000)
    fake.store.subs.get("usub_1")!.currentPeriodEnd = new Date(NOW + 60 * 86_400_000)

    const result = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "pay_1" },
      "system",
    )
    expect(result.grantCount).toBe(2)
    const after1 = fake.store.grants.get("g1")!.expiresAt!
    expect(after1.getTime()).toBeGreaterThan(before1.getTime())
    expect(after1.getTime()).toBe(NOW + 60 * 86_400_000)
    expect(fake.store.grants.size).toBe(2) // no duplicates
  })

  it("a failed/pending charge never extends access", async () => {
    fake.seedGrant({ id: "ga", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_1")
    const before = fake.store.grants.get("ga")!.expiresAt!
    // PAYMENT_HALT_UPDATE: no extension by design.
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.PAYMENT_HALT_UPDATE, periodRef: "failed_1" },
      "system",
    )
    expect(fake.store.grants.get("ga")!.expiresAt!.getTime()).toBe(before.getTime())
  })

  it("delayed renewal after the old boundary is still applied once, extending from the new period", async () => {
    const NOW = Date.now()
    fake.seedGrant({ id: "gd", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW - 86_400_000) }, "usub_1")
    fake.store.subs.get("usub_1")!.currentPeriodStart = new Date(NOW - 40 * 86_400_000)
    fake.store.subs.get("usub_1")!.currentPeriodEnd = new Date(NOW + 30 * 86_400_000)
    const result = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "late_1" },
      "system",
    )
    expect(result.status).toBe("SUCCEEDED")
    expect(fake.store.grants.get("gd")!.expiresAt!.getTime()).toBe(NOW + 30 * 86_400_000)
  })

  it("new items introduced in the bound version are granted on renewal (bundle stays complete)", async () => {
    const NOW = Date.now()
    fake.seedGrant({ id: "gx", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(NOW + 10 * 86_400_000) }, "usub_1")
    fake.store.subs.get("usub_1")!.currentPeriodEnd = new Date(NOW + 30 * 86_400_000)
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.SUCCESSFUL_RENEWAL, periodRef: "n_1" },
      "system",
    )
    const keys = [...fake.store.grants.values()].map((g) => g.entitlementKey)
    expect(keys).toContain("product.prod_1")
    expect(keys).toContain("product.prod_2")
    expect(fake.store.grants.size).toBe(2)
  })
})
