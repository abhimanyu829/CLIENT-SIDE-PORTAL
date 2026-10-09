/**
 * Phase 5 — Test Group A: plan-version resolution and item validation.
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

const { provisionSubscription, buildProvisioningDedupeKey } = await import(
  "@/lib/services/subscription-provisioning"
)

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedDef("product.prod_2")
  fake.seedDef("limit.storage")
  fake.seedVersion("ver_1", [
    { itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" },
    { itemType: "PRODUCT", itemRefId: "prod_2", itemRefKey: "prod_2" },
    { itemType: "STORAGE", itemRefKey: "storage", limitValue: 20, limitUnit: "GB" },
  ])
  fake.seedSubscription({ id: "usub_1", userId: "user_1", status: "ACTIVE", planVersionId: "ver_1" })
}

beforeEach(() => {
  fake = createFakeProvisioningDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("A — plan resolution", () => {
  it("resolves the immutable bound plan version and its full bundle", async () => {
    const result = await provisionSubscription(
      { subscriptionId: "usub_1", operation: ProvisioningOperation.INITIAL_ACTIVATION },
      "system",
    )
    expect(result.status).toBe("SUCCEEDED")
    expect(result.grantCount).toBe(3)
    expect(fake.store.grants.size).toBe(3)
    const keys = [...fake.store.grants.values()].map((g) => g.entitlementKey).sort()
    expect(keys).toEqual(["limit.storage", "product.prod_1", "product.prod_2"])
  })

  it("rejects a missing plan version on the subscription", async () => {
    fake.seedSubscription({ id: "usub_nover", userId: "user_1", status: "ACTIVE", planVersionId: null })
    await expect(
      provisionSubscription({ subscriptionId: "usub_nover", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/no bound plan version/i)
  })

  it("rejects an unknown subscription and invalid owner", async () => {
    await expect(
      provisionSubscription({ subscriptionId: "usub_missing", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(ProvisioningError)
    fake.seedUser("banned", { isBanned: true })
    fake.seedSubscription({ id: "usub_b", userId: "banned", status: "ACTIVE", planVersionId: "ver_1" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_b", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/banned/i)
  })

  it("rejects a DRAFT plan version (never provisionable)", async () => {
    fake.seedVersion("ver_draft", [{ itemType: "FEATURE", itemRefKey: "x" }], "DRAFT")
    fake.seedSubscription({ id: "usub_d", userId: "user_1", status: "ACTIVE", planVersionId: "ver_draft" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_d", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/DRAFT/i)
    expect(fake.store.grants.size).toBe(0)
  })

  it("accepts superseded (ARCHIVED) versions for historical subscriptions", async () => {
    fake.seedVersion("ver_v1", [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }], "ARCHIVED")
    fake.seedSubscription({ id: "usub_hist", userId: "user_1", status: "ACTIVE", planVersionId: "ver_v1" })
    const result = await provisionSubscription(
      { subscriptionId: "usub_hist", operation: ProvisioningOperation.INITIAL_ACTIVATION },
      "system",
    )
    expect(result.status).toBe("SUCCEEDED")
    expect(fake.store.grants.size).toBe(1)
    expect([...fake.store.grants.values()][0].entitlementKey).toBe("product.prod_1")
  })

  it("fails safely when an entitlement definition is missing (permanent, no partial bundle)", async () => {
    fake.seedVersion("ver_bad", [
      { itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" },
      { itemType: "AI_CAPABILITY", itemRefId: "agent_1", itemRefKey: "agent_1" },
    ])
    fake.seedSubscription({ id: "usub_bad", userId: "user_1", status: "ACTIVE", planVersionId: "ver_bad" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_bad", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/No active entitlement definition/i)
    expect(fake.store.grants.size).toBe(0)
    const rec = fake.store.provs.get(
      buildProvisioningDedupeKey("usub_bad", ProvisioningOperation.INITIAL_ACTIVATION),
    )
    expect(rec?.status).toBe("FAILED_PERMANENT")
    expect(rec?.errorCode).toBe("PROVISIONING_DEFINITION_MISSING")
  })

  it("rejects an unmappable plan item safely", async () => {
    fake.seedVersion("ver_weird", [{ itemType: "SOMETHING_UNKNOWN" } as never])
    fake.seedSubscription({ id: "usub_w", userId: "user_1", status: "ACTIVE", planVersionId: "ver_weird" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_w", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/Unsupported plan item/i)
    expect(fake.store.grants.size).toBe(0)
  })

  it("records environment mismatch as permanent", async () => {
    fake.seedSubscription({ id: "usub_live", userId: "user_1", status: "ACTIVE", planVersionId: "ver_1", environment: "production" })
    await expect(
      provisionSubscription({ subscriptionId: "usub_live", operation: ProvisioningOperation.INITIAL_ACTIVATION }),
    ).rejects.toThrow(/environment mismatch/i)
  })
})
