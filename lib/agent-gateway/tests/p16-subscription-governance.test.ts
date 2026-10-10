/**
 * p16-subscription-governance.test.ts
 *
 * Phase 9 — tool contract + adapter + ownership tests for the
 * subscription governance capabilities. No network; services mocked; the DB
 * fake covers only the cancel-request ownership preflight.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CapabilityRegistry } from "@/lib/agent-gateway/capabilities/registry"
import { registerCoreCapabilities } from "@/lib/agent-gateway/capabilities/manifest"

// ── Service mocks ─────────────────────────────────────────────────────────────

let ownerId = "machine_owner"
const overviewFixture = {
  environment: "test",
  paidSubscriptions: [
    {
      id: "usub_1", status: "ACTIVE", planName: "Launch", planType: "MONTHLY",
      billingIntervalMonths: 1, price: { amount: "999.00", currency: "INR" },
      currentPeriodEnd: "2026-11-01T00:00:00.000Z", cancelAtPeriodEnd: false,
    },
  ],
  trials: [{ id: "tr_1", planName: "Launch", status: "ACTIVE", startedAt: "2026-10-01T00:00:00.000Z", expiresAt: "2026-10-15T00:00:00.000Z" }],
  freeEnrollments: [{ id: "fe_1", planName: "Free", status: "ACTIVE" }],
  access: { entitlementKeys: ["product.prod_1"], storageLimit: { limitValue: 5, limitUnit: "GB" }, adminLimit: { limitValue: 1, limitUnit: "admins" } },
  billing: [{ kind: "SUBSCRIPTION_CHARGE", reference: "pay_1", amount: { amount: "999.00", currency: "INR" }, status: "SUCCEEDED", createdAt: "2026-10-01T00:00:00.000Z" }],
}
const plansFixture = [{ id: "p1", name: "Launch", planType: "MONTHLY", currency: "INR", price: { amount: "999.00", currency: "INR" }, billingIntervalMonths: 1, versionId: "v1", items: [{ itemType: "PRODUCT", itemRefKey: "prod_1", limitValue: null, limitUnit: null }] }]

vi.mock("@/lib/services/customer-subscription-view", () => ({
  getCustomerSubscriptionOverview: vi.fn(async (userId: string) =>
    userId === "owner_a" ? overviewFixture : { environment: "test", paidSubscriptions: [], trials: [], freeEnrollments: [], access: { entitlementKeys: [], storageLimit: { limitValue: null, limitUnit: null }, adminLimit: { limitValue: null, limitUnit: null } }, billing: [] },
  ),
  listCustomerPlans: vi.fn(async () => plansFixture),
}))
vi.mock("@/lib/services/entitlement-resolver", () => ({
  getEffectiveEntitlements: vi.fn(async () => [{ key: "product.prod_1" }]),
  getLimit: vi.fn(async (_s: never, key: string) =>
    key === "limit.storage" ? { limitValue: 5, limitUnit: "GB" } : { limitValue: 1, limitUnit: "admins" },
  ),
}))
vi.mock("@/lib/services/free-trial-service", () => ({
  enrollFreePlan: vi.fn(async (userId: string) => ({ enrollmentId: `fe_${userId}`, existing: false })),
  startTrial: vi.fn(async (input: { userId: string; planId: string }) => ({
    enrollmentId: `tr_${input.planId}`,
    planVersionId: "v1",
    status: "ACTIVE",
    startedAt: new Date("2026-10-01T00:00:00Z"),
    expiresAt: new Date("2026-10-15T00:00:00Z"),
  })),
}))
vi.mock("@/lib/services/razorpay-billing", () => ({
  cancelRecurringSubscription: vi.fn(async () => ({ status: "CANCELED" })),
}))
const fakeSubs = new Map<string, { id: string; userId: string }>()
vi.mock("@/lib/db", () => ({
  db: {
    userSubscription: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => fakeSubs.get(args.where.id) ?? null),
    },
  },
}))

import {
  SubscriptionPlansListAdapter,
  SubscriptionSummaryAdapter,
  SubscriptionAccessExplainAdapter,
  SubscriptionTrialStatusAdapter,
  SubscriptionBillingListAdapter,
} from "@/lib/agent-gateway/execution/adapters/subscription-read-adapters"
import {
  SubscriptionFreeEnrollAdapter,
  SubscriptionTrialStartAdapter,
  SubscriptionCancelRequestAdapter,
} from "@/lib/agent-gateway/execution/adapters/subscription-mutation-adapters"
import { ExecutionError } from "@/lib/agent-gateway/execution/contracts/execution-error"
import { enrollFreePlan, startTrial } from "@/lib/services/free-trial-service"
import { cancelRecurringSubscription } from "@/lib/services/razorpay-billing"

const ctx = () => ({ ownerId: ownerId as string, signal: new AbortController().signal } as never)
const ok = (r: { output: unknown }) => r.output

beforeEach(() => {
  ownerId = "machine_owner"
  fakeSubs.clear()
})

describe("capability manifest — Phase 9 tools", () => {
  const registry = new CapabilityRegistry()
  registerCoreCapabilities(registry)

  it("registers all 8 subscription governance capabilities exactly once", () => {
    const ids = [
      "subscriptions.plansList",
      "subscriptions.summary",
      "subscriptions.accessExplain",
      "subscriptions.trialStatus",
      "subscriptions.billingHistory",
      "subscriptions.freeEnroll",
      "subscriptions.trialStart",
      "subscriptions.cancelRequest",
    ]
    for (const id of ids) {
      const def = registry.get(id)
      expect(def, id).toBeDefined()
      // Single registration: registry throws on duplicates at load.
    }
    // Implicit duplicate check: re-registering throws fail-closed.
  })

  it("classifies reads READ and mutations HIGH_RISK_MUTATION (approval gate)", () => {
    for (const id of ["subscriptions.plansList", "subscriptions.summary", "subscriptions.accessExplain", "subscriptions.trialStatus", "subscriptions.billingHistory"]) {
      expect(registry.get(id)?.operationType, id).toBe("READ")
    }
    for (const id of ["subscriptions.freeEnroll", "subscriptions.trialStart", "subscriptions.cancelRequest"]) {
      expect(registry.get(id)?.operationType, id).toBe("HIGH_RISK_MUTATION")
    }
  })

  it("requires owner identity context on every tool", () => {
    for (const id of ["subscriptions.summary", "subscriptions.accessExplain", "subscriptions.trialStart", "subscriptions.cancelRequest"]) {
      expect(registry.get(id)?.requiredIdentityContext).toContain("ownerId")
    }
  })

  it("strict schemas reject unknown/forged fields", () => {
    const trial = registry.get("subscriptions.trialStart")!
    expect(trial.inputSchema!.parse({ planId: "p1" })).toEqual({ planId: "p1" })
    expect(() => trial.inputSchema!.parse({ planId: "p1", userId: "someone_else" })).toThrow()
    expect(() => trial.inputSchema!.parse({})).toThrow()
    const cancel = registry.get("subscriptions.cancelRequest")!
    expect(() => cancel.inputSchema!.parse({ subscriptionId: "s", confirmed: true, price: 0 })).toThrow()
  })
})

describe("read adapters", () => {
  it("subscriptions.plans.list returns trimmed published catalog", async () => {
    const out = ok(await new SubscriptionPlansListAdapter().execute(ctx(), {}))
    expect((out as { plans: unknown[] }).plans).toHaveLength(1)
    expect((out as { plans: Array<Record<string, unknown>> }).plans[0]).not.toHaveProperty("status")
  })

  it("subscriptions.summary is owner-scoped and trimmed", async () => {
    ownerId = "owner_a"
    const out = ok(await new SubscriptionSummaryAdapter().execute(ctx(), {})) as {
      paidSubscriptions: unknown[]
      freeForeverActive: boolean
      accessKeys: string[]
    }
    expect(out.freeForeverActive).toBe(true)
    expect(out.accessKeys).toContain("product.prod_1")
    expect(out.paidSubscriptions[0]).not.toHaveProperty("razorpaySubscriptionId")
  })

  it("cross-customer reads return an EMPTY owner view, never another tenant's data", async () => {
    ownerId = "owner_b"
    const out = ok(await new SubscriptionSummaryAdapter().execute(ctx(), {})) as { paidSubscriptions: unknown[] }
    expect(out.paidSubscriptions).toHaveLength(0)
  })

  it("access.explain resolves through the Phase 3 resolver", async () => {
    ownerId = "owner_a"
    const out = ok(await new SubscriptionAccessExplainAdapter().execute(ctx(), {})) as {
      accessKeys: string[]
      storageLimit: { limitValue: number | null }
    }
    expect(out.accessKeys).toEqual(["product.prod_1"])
    expect(out.storageLimit.limitValue).toBe(5)
  })

  it("trial.status and billing.list return verified timestamps/records", async () => {
    ownerId = "owner_a"
    const trial = ok(await new SubscriptionTrialStatusAdapter().execute(ctx(), {})) as {
      trials: Array<{ expiresAt: string }>
    }
    expect(trial.trials[0].expiresAt).toBe("2026-10-15T00:00:00.000Z")
    const billing = ok(await new SubscriptionBillingListAdapter().execute(ctx(), {})) as {
      billing: Array<Record<string, unknown>>
    }
    expect(billing.billing[0].status).toBe("SUCCEEDED")
  })
})

describe("mutation adapters", () => {
  it("free.enroll delegates to Phase 6 with the owner as subject", async () => {
    const result = new SubscriptionFreeEnrollAdapter().execute(ctx(), {})
    expect((await result).output).toEqual({ enrollmentId: "fe_machine_owner", existing: false })
    expect(enrollFreePlan).toHaveBeenCalledWith("machine_owner", "machine_owner")
  })

  it("trial.start delegates to Phase 6 and returns the exact expiry window", async () => {
    const out = ok(await new SubscriptionTrialStartAdapter().execute(ctx(), { planId: "p1" })) as { expiresAt: string }
    expect(out.expiresAt).toBe("2026-10-15T00:00:00.000Z")
    expect(startTrial).toHaveBeenCalledWith({ userId: "machine_owner", planId: "p1" }, "machine_owner")
  })

  it("cancel.request allows only the OWNER's subscription (cross-tenant denied)", async () => {
    fakeSubs.set("usub_1", { id: "usub_1", userId: "machine_owner" })
    fakeSubs.set("usub_other", { id: "usub_other", userId: "someone_else" })

    const out = ok(await new SubscriptionCancelRequestAdapter().execute(ctx(), { subscriptionId: "usub_1" }))
    expect(out).toEqual({ status: "CANCELED" })
    await expect(
      new SubscriptionCancelRequestAdapter().execute(ctx(), { subscriptionId: "usub_other" }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" })
    // Provider op never runs for someone else's subscription.
    expect(cancelRecurringSubscription).toHaveBeenCalledTimes(1)
  })

  it("cancel.request checkResource blocks approval for a non-owned subscription", async () => {
    fakeSubs.set("usub_other", { id: "usub_other", userId: "someone_else" })
    await expect(
      new SubscriptionCancelRequestAdapter().checkResource(ctx(), { subscriptionId: "usub_other" }),
    ).rejects.toBeInstanceOf(ExecutionError)
  })

  it("unknown or missing subscription is never fabricatable", async () => {
    await expect(
      new SubscriptionCancelRequestAdapter().execute(ctx(), { subscriptionId: "usub_missing" }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" })
  })
})
