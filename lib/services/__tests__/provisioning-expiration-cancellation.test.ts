/**
 * Phase 5 — Test Groups D (expiration) + E (cancellation).
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
  fake.seedSubscription({
    id: "usub_1",
    userId: "user_1",
    status: "ACTIVE",
    planVersionId: "ver_1",
    currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
  })
}

beforeEach(() => {
  fake = createFakeProvisioningDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("D — expiration", () => {
  it("expires subscription grants at the verified paid-through boundary", async () => {
    const now = Date.now()
    fake.seedGrant(
      { id: "g1", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: new Date(now - 1000), status: "ACTIVE" },
      "usub_1",
    )
    const result = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "boundary" },
      "system",
    )
    expect(result.grantCount).toBe(1)
    expect(fake.store.grants.get("g1")!.status).toBe("EXPIRED")
  })

  it("a future-dated grant at expiry time stays ACTIVE", async () => {
    const future = new Date(Date.now() + 86400_000)
    fake.seedGrant({ id: "g2", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: future }, "usub_1")
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "early" },
      "system",
    )
    expect(fake.store.grants.get("g2")!.status).toBe("ACTIVE")
  })

  it("a late expiry job never shortens a newly renewed period", async () => {
    const NOW = Date.now()
    const future = new Date(NOW + 60 * 86_400_000)
    fake.seedGrant({ id: "g3", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: future }, "usub_1")
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "late-run" },
      "system",
    )
    expect(fake.store.grants.get("g3")!.expiresAt!.getTime()).toBe(NOW + 60 * 86_400_000)
    expect(fake.store.grants.get("g3")!.status).toBe("ACTIVE")
  })

  it("permanent (no expiry) subscription grants are untouched by expiry", async () => {
    fake.seedGrant({ id: "g4", entitlementKey: "product.prod_1", subjectUserId: "user_1", expiresAt: null }, "usub_1")
    await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.EXPIRATION, periodRef: "perm" },
      "system",
    )
    expect(fake.store.grants.get("g4")!.status).toBe("ACTIVE")
  })
})

describe("E — cancellation", () => {
  it("period-end cancellation preserves access (grants ride out the paid-through)", async () => {
    fake.seedSubscription({
      id: "usub_pe",
      userId: "user_1",
      status: "CANCELED",
      cancelAtPeriodEnd: true,
      planVersionId: "ver_1",
    })
    fake.seedGrant({ id: "g5", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_pe")
    const result = await provisionSubscription(
      { subscriptionId: "usub_pe", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "end" },
      "system",
    )
    expect(result.grantCount).toBe(0)
    expect(fake.store.grants.get("g5")!.status).toBe("ACTIVE")
  })

  it("immediate cancellation revokes only this subscription's grants", async () => {
    fake.seedSubscription({ id: "usub_ic", userId: "user_1", status: "CANCELED", cancelAtPeriodEnd: false, planVersionId: "ver_1" })
    fake.seedGrant({ id: "g6", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_ic")
    await provisionSubscription(
      { subscriptionId: "usub_ic", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "now" },
      "system",
    )
    expect(fake.store.grants.get("g6")!.status).toBe("REVOKED")
  })

  it("cancelling one subscription never touches another subscription's grants", async () => {
    fake.seedSubscription({ id: "usub_ic2", userId: "user_1", status: "CANCELED", cancelAtPeriodEnd: false, planVersionId: "ver_1" })
    fake.seedGrant({ id: "g_other", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_OTHER")
    await provisionSubscription(
      { subscriptionId: "usub_ic2", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "x" },
      "system",
    )
    expect(fake.store.grants.get("g_other")!.status).toBe("ACTIVE")
  })

  it("duplicate cancellation events are idempotent", async () => {
    fake.seedSubscription({ id: "usub_dup", userId: "user_1", status: "CANCELED", cancelAtPeriodEnd: false, planVersionId: "ver_1" })
    fake.seedGrant({ id: "g7", entitlementKey: "product.prod_1", subjectUserId: "user_1" }, "usub_dup")
    const first = await provisionSubscription(
      { subscriptionId: "usub_dup", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "e1" },
      "system",
    )
    const second = await provisionSubscription(
      { subscriptionId: "usub_dup", operation: ProvisioningOperation.CANCELLATION_UPDATE, periodRef: "e1" },
      "system",
    )
    expect(first.status).toBe("SUCCEEDED")
    expect(second.duplicate).toBe(true)
    expect(fake.store.grants.get("g7")!.status).toBe("REVOKED")
  })
})
