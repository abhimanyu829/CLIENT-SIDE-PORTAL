/**
 * Phase 7 — customer subscription view builder (UI contract, read-only).
 * The entitlement resolver is mocked here; the view service itself is tested.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FakeFreeTrialDb } from "./helpers/fake-free-trial-db"

let fake: FakeFreeTrialDb

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
vi.mock("@/lib/services/entitlement-resolver", () => ({
  getEffectiveEntitlements: vi.fn(async () => [
    { key: "product.prod_1", type: "PRODUCT", status: "ACTIVE", scope: "RESOURCE", quantity: null, limitValue: null, limitUnit: null, startsAt: new Date(), expiresAt: null, sourceType: "SUBSCRIPTION", sourceReference: "u1", resourceType: null, resourceId: "prod_1", configuration: {} },
  ]),
  getLimit: vi.fn(async (_s: never, key: string) =>
    key === "limit.storage" ? { limitValue: 5, limitUnit: "GB" } : { limitValue: 1, limitUnit: "admins" },
  ),
}))
vi.mock("@/lib/services/plan-catalog-service", () => ({
  listPlans: vi.fn(async (filter?: { status?: string }) => {
    const all = [
      {
      id: "plan_pub",
      name: "Launch",
      tagline: null,
      description: null,
      planType: "MONTHLY",
      currency: "INR",
      price: { toNumber: () => 999 },
      billingIntervalMonths: 1,
      durationMonths: null,
      status: "PUBLISHED",
      currentVersionId: "v_pub",
      versions: [{ id: "v_pub", status: "PUBLISHED", items: [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1", label: null, quantity: 1, limitValue: null, limitUnit: null }] }],
    },
      {
      id: "plan_draft",
      name: "Hidden",
      tagline: null,
      description: null,
      planType: "MONTHLY",
      currency: "INR",
      price: { toNumber: () => 1 },
      billingIntervalMonths: 1,
      durationMonths: null,
      status: "DRAFT",
      currentVersionId: null,
      versions: [],
      },
    ]
    return filter?.status ? all.filter((p) => p.status === filter.status) : all
  }),
}))
vi.mock("@/lib/services/cache-service", () => ({
  invalidateCache: vi.fn(async () => undefined),
  CACHE_KEYS: {},
}))
vi.mock("@/lib/redis", () => ({ redis: null }))

import * as dbModule from "@/lib/db"
import { createFakeFreeTrialDb } from "./helpers/fake-free-trial-db"

const { getCustomerSubscriptionOverview, listCustomerPlans } = await import(
  "@/lib/services/customer-subscription-view"
)

beforeEach(() => {
  fake = createFakeFreeTrialDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
})

describe("listCustomerPlans — UI catalog contract", () => {
  it("exposes PUBLISHED plans only (draft never surfaced)", async () => {
    const plans = await listCustomerPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe("plan_pub")
    expect(plans[0].versionId).toBe("v_pub")
    expect(plans[0].price.amount).toBe("999.00")
    expect(plans[0].items).toHaveLength(1)
  })
})

describe("getCustomerSubscriptionOverview — composed read", () => {
  it("returns normalized, owned records with access and limits", async () => {
    const now = new Date()
    fake.store.usubs.push({
      id: "usub_1",
      userId: "user_1",
      planId: "plan_pub",
      planVersionId: "v_pub",
      status: "ACTIVE",
      environment: "test",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86400_000),
      razorpaySubscriptionId: "sub_test_1",
      metadata: {},
    })
    fake.seedTrial({
      id: "tr_1",
      userId: "user_1",
      trialScopeKey: "x",
      status: "ACTIVE",
      planVersionId: "v_pub",
      expiresAt: new Date(now.getTime() + 14 * 86400_000),
    })
    fake.seedFree({ id: "fe_1", userId: "user_1", dedupeKey: "d" })

    const overview = await getCustomerSubscriptionOverview("user_1")
    expect(overview.paidSubscriptions).toHaveLength(1)
    expect(overview.paidSubscriptions[0]).toMatchObject({
      id: "usub_1",
      status: "ACTIVE",
      planVersionId: "v_pub",
      cancelAtPeriodEnd: false,
      nextChargeLabel: expect.stringContaining("Renews"),
    })
    expect(overview.trials[0].status).toBe("ACTIVE")
    expect(overview.freeEnrollments[0].status).toBe("ACTIVE")
    expect(overview.access.entitlementKeys).toEqual(["product.prod_1"])
    expect(overview.access.storageLimit).toEqual({ limitValue: 5, limitUnit: "GB" })
    expect(overview.access.adminLimit).toEqual({ limitValue: 1, limitUnit: "admins" })
  })

  it("handles an empty customer (no records) without throwing", async () => {
    const overview = await getCustomerSubscriptionOverview("user_1")
    expect(overview.paidSubscriptions).toHaveLength(0)
    expect(overview.trials).toHaveLength(0)
    expect(overview.freeEnrollments).toHaveLength(0)
    expect(overview.billing).toHaveLength(0)
  })
})
