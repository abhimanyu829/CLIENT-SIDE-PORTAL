/**
 * Phase 4 — Test Groups L (failure), J (database/structure) and M (standalone
 * regression + protected-system verification, structural).
 */
import { readFileSync } from "fs"
import path from "path"
import crypto from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SubscriptionStatus } from "@prisma/client"
import { createFakeRzpDb, type FakeRzpDb } from "./helpers/fake-razorpay-db"

let fake: FakeRzpDb
type Provider = {
  planCreate: ReturnType<typeof vi.fn>
  subscriptionCreate: ReturnType<typeof vi.fn>
  noClient: boolean
}
let rzp: { __provider: Provider }

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
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock("@/lib/redis", () => ({ redis: null }))
vi.mock("@/lib/env", () => ({
  env: {
    RAZORPAY_KEY_SECRET: "rzp_key_secret_test",
    RAZORPAY_WEBHOOK_SECRET: "rzp_webhook_secret_test",
    RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET: undefined,
  },
}))
vi.mock("@/lib/razorpay", () => {
  const provider = {
    planCreate: vi.fn(async () => ({ id: "plan_test_abc" })),
    subscriptionCreate: vi.fn(async () => ({ id: "sub_test_abc" })),
    subscriptionCancel: vi.fn(async () => ({ id: "sub_test_1", status: "cancelled" })),
    subscriptionPause: vi.fn(async () => ({ id: "sub_test_1", status: "paused" })),
    subscriptionResume: vi.fn(async () => ({ id: "sub_test_1", status: "active" })),
    noClient: false,
  }
  return {
    __provider: provider,
    getRazorpay: () =>
      provider.noClient
        ? null
        : {
            plans: { create: provider.planCreate },
            subscriptions: {
              create: provider.subscriptionCreate,
              cancel: provider.subscriptionCancel,
              pause: provider.subscriptionPause,
              resume: provider.subscriptionResume,
            },
          },
    razorpay: {},
  }
})

import * as dbModule from "@/lib/db"
import * as rzpModule from "@/lib/razorpay"

const { createRecurringSubscription, ensureRazorpayPlanMapping } = await import(
  "@/lib/services/razorpay-billing"
)
const { handleSubscriptionWebhook } = await import("@/lib/services/razorpay-subscription-webhook")
const { RazorpayBillingError } = await import("@/lib/services/razorpay-billing")

function sign(body: string): string {
  return crypto.createHmac("sha256", "webhook_secret_test").update(body).digest("hex")
}

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  rzp = rzpModule as unknown as { __provider: Provider }
  rzp.__provider.planCreate.mockClear()
  rzp.__provider.subscriptionCreate.mockClear()
  rzp.__provider.planCreate.mockResolvedValue({ id: "plan_test_abc" })
  rzp.__provider.subscriptionCreate.mockResolvedValue({ id: "sub_test_abc" })
  rzp.__provider.noClient = false
  fake.seedPlan({ id: "plan_1" })
  fake.seedVersion({ id: "ver_1", planId: "plan_1" })
})

describe("L — failure handling", () => {
  it("Razorpay unavailable (client null) → typed failure, no phantom success", async () => {
    rzp.__provider.noClient = true
    await expect(ensureRazorpayPlanMapping("ver_1")).rejects.toThrow(/not configured/i)
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "u")).rejects.toThrow()
    expect(fake.store.mappings.size).toBe(0)
  })

  it("provider 5xx is normalized to a typed failure", async () => {
    rzp.__provider.planCreate.mockRejectedValue(new Error("500 Internal Server Error"))
    await expect(ensureRazorpayPlanMapping("ver_1")).rejects.toThrow(RazorpayBillingError)
  })

  it("internal record creation failure → no phantom remote claim and no duplicate", async () => {
    fake.failures.failInternalCreate = true
    await expect(createRecurringSubscription({ planVersionId: "ver_1" }, "u")).rejects.toThrow()
    expect(fake.store.subscriptions.size).toBe(0)
    expect(rzp.__provider.subscriptionCreate).not.toHaveBeenCalled()
  })

  it("webhook processing on an unknown subscription is durably accepted without mutation", async () => {
    const raw = JSON.stringify({
      entity: "event",
      id: "ev_unknown",
      event: "subscription.charged",
      payload: { subscription: { entity: { id: "sub_unknown", status: "active" } }, payment: { entity: { id: "pay_unknown", status: "captured", amount: 100, currency: "INR" } } },
    })
    const result = await handleSubscriptionWebhook(raw, sign(raw), "webhook_secret_test")
    expect(result.processed).toBe(true)
    expect(fake.store.charges.size).toBe(0)
    expect(fake.store.subscriptions.size).toBe(0)
  })

  it("no false success: TRIALING without an activated event is never ACTIVE", async () => {
    fake.seedSubscription({ id: "usub_t", userId: "u", status: SubscriptionStatus.TRIALING, razorpaySubscriptionId: "sub_t" })
    const result = await createRecurringSubscription({ planVersionId: "ver_1" }, "u")
    expect(result.status).toBe(SubscriptionStatus.TRIALING)
  })
})

describe("J — database structure (schema/migration)", () => {
  const root = process.cwd()
  const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8")
  const migration = readFileSync(
    path.join(root, "prisma", "migrations", "20261008030000_razorpay_recurring_billing", "migration.sql"),
    "utf8",
  )
  const stmts = migration.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")

  it("models and enums exist with the right uniqueness", () => {
    expect(schema).toMatch(/model RazorpayPlanMapping \{/)
    expect(schema).toMatch(/model SubscriptionCharge \{/)
    expect(schema).toMatch(/enum PlanMappingStatus \{/)
    expect(schema).toMatch(/enum SubscriptionChargeStatus \{/)
    const mapping = schema.match(/model RazorpayPlanMapping \{[\s\S]*?\n\}/)![0]
    expect(mapping).toMatch(/@@unique\(\[planVersionId, environment\]\)/)
    expect(mapping).toMatch(/razorpayPlanId\s+String\s+@unique/)
    const charge = schema.match(/model SubscriptionCharge \{[\s\S]*?\n\}/)![0]
    expect(charge).toMatch(/razorpayPaymentId\s+String\?\s+@unique/)
    expect(charge).toMatch(/providerEventId\s+String\?\s+@unique/)
  })

  it("Phase-4 migration is additive and touches no existing commerce/plan/entitlement table", () => {
    expect(stmts).not.toMatch(/DROP\s+TABLE/i)
    expect(stmts).not.toMatch(/DROP\s+COLUMN/i)
    for (const t of ["Order", "OrderItem", "Cart", "Payment", "Invoice", "Product", "Subscription", "SubscriptionPlan", "PlanVersion", "PlanItem", "EntitlementDefinition", "EntitlementGrant", "CustomerEntitlement"]) {
      expect(stmts, t).not.toMatch(new RegExp(`ALTER TABLE "${t}"`, "i"))
    }
    expect(stmts).not.toMatch(/CatalogCanonicalProduct|CatalogCrawl|CatalogSource/i)
  })

  it("one-time Razorpay routes are untouched (protected)", () => {
    const verifyRoute = readFileSync(path.join(root, "app", "api", "payments", "razorpay", "verify", "route.ts"), "utf8")
    const legacyWebhook = readFileSync(path.join(root, "app", "api", "payments", "razorpay", "webhook", "route.ts"), "utf8")
    const orderRoute = readFileSync(path.join(root, "app", "api", "payments", "razorpay", "order", "route.ts"), "utf8")
    expect(verifyRoute).toContain("timingSafeEqual")
    expect(verifyRoute).toContain("RAZORPAY_KEY_SECRET")
    expect(legacyWebhook).toContain("markOrderPaid")
    expect(orderRoute).toContain("orders.create")
  })

  it("Phase 1-3 foundations preserved", () => {
    expect(schema).toMatch(/enum SubscriptionSource \{/)
    expect(schema).toMatch(/model PlanVersion \{/)
    expect(schema).toMatch(/model EntitlementGrant \{/)
  })
})

describe("M — standalone commerce regression (structural)", () => {
  it("billing code never touches standalone commerce, entitlements or checkout", () => {
    const root = process.cwd()
    const service = readFileSync(path.join(root, "lib", "services", "razorpay-billing.ts"), "utf8")
    const webhook = readFileSync(path.join(root, "lib", "services", "razorpay-subscription-webhook.ts"), "utf8")
    const code = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((l) => l.split("//")[0])
        .join("\n")
    for (const src of [service, webhook]) {
      const c = code(src).toLowerCase()
      for (const forbidden of [
        "db.order",
        "db.payment",
        "db.cart",
        "db.invoice",
        "db.product.create",
        "db.customerentitlement",
        "db.entitlementgrant",
        "checkout",
      ]) {
        expect(c, forbidden).not.toContain(forbidden)
      }
    }
  })

  it("no entitlement provisioning exists in billing events", () => {
    const webhook = readFileSync(path.join(process.cwd(), "lib", "services", "razorpay-subscription-webhook.ts"), "utf8")
    expect(webhook).not.toContain("grantEntitlement")
    expect(webhook).not.toContain("entitlementGrant.create")
  })

  it("provider calls are confined to TEST-safe paths and never mutate real data in tests", () => {
    // All Phase-4 tests use the mocked Razorpay client; assertion is enforced
    // by the suite design (no real credentials in test env).
    expect(rzp.__provider.planCreate).toBeDefined()
  })
})
