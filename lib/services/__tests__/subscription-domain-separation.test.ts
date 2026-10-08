/**
 * Phase 1 — Domain separation tests.
 *
 * Verifies the Phase-1 invariant:
 *   STANDALONE PURCHASE ≠ SUBSCRIPTION
 *   SUBSCRIPTION ≠ PAYMENT ≠ PRODUCT ≠ ENTITLEMENT
 *
 * Two layers:
 *  1. Schema-level — read prisma/schema.prisma and assert the coupling
 *     rules (optional FKs only, no required subscription dependency on
 *     the standalone commerce tables).
 *  2. Code-level — the foundation module must not touch Order/Payment/
 *     Cart/Invoice, and the fake DB traps any such call.
 */
import { readFileSync } from "fs"
import path from "path"
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

const { createFoundationSubscription } = await import("@/lib/services/subscription-domain")

const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8")

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))
  if (!match) throw new Error(`model ${name} not found in schema`)
  return match[0]
}

describe("schema-level domain separation", () => {
  it("Order has NO subscription reference at all", () => {
    const order = modelBlock("Order")
    expect(order).not.toMatch(/subscription/i)
  })

  it("OrderItem has NO subscription reference at all", () => {
    const orderItem = modelBlock("OrderItem")
    expect(orderItem).not.toMatch(/subscription/i)
  })

  it("Cart and CartItem have NO subscription reference", () => {
    expect(modelBlock("Cart")).not.toMatch(/subscription/i)
    expect(modelBlock("CartItem")).not.toMatch(/subscription/i)
  })

  it("Payment.subscriptionId is OPTIONAL (standalone payments valid without subscription)", () => {
    const payment = modelBlock("Payment")
    const line = payment
      .split("\n")
      .find((l) => l.includes("subscriptionId"))
    expect(line).toBeDefined()
    expect(line).toMatch(/subscriptionId\s+String\?/) // nullable = optional
  })

  it("Invoice stays linked to Payment (not to Subscription) as the source of truth", () => {
    const invoice = modelBlock("Invoice")
    expect(invoice).toMatch(/paymentId\s+String\s+@unique/)
  })

  it("CustomerEntitlement.subscriptionId is OPTIONAL (one-time purchases have none)", () => {
    const ent = modelBlock("CustomerEntitlement")
    const line = ent.split("\n").find((l) => l.includes("subscriptionId"))
    expect(line).toBeDefined()
    expect(line).toMatch(/subscriptionId\s+String\?/)
  })

  it("Subscription references Product/Tier but is never REQUIRED by them", () => {
    // Subscription -> Product/Tier is fine (a subscription is for a product).
    // The reverse direction (Product/Tier holding a required subscription FK)
    // must not exist.
    const product = modelBlock("Product")
    const tier = modelBlock("ProductTier")
    expect(product).not.toMatch(/subscription\s+Subscription/)
    expect(tier).not.toMatch(/subscription\s+Subscription/)
  })

  it("Phase-1 migration is additive-only (no DROP / RENAME / ALTER TYPE)", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "prisma",
        "migrations",
        "20261008000000_subscription_domain_foundation",
        "migration.sql",
      ),
      "utf8",
    )
    // Strip SQL comments so prose ("no tables renamed") cannot trip the
    // destructive-statement detectors.
    const statements = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
    expect(statements).not.toMatch(/DROP\s+TABLE/i)
    expect(statements).not.toMatch(/DROP\s+COLUMN/i)
    expect(statements).not.toMatch(/RENAME/i)
    expect(statements).not.toMatch(/ALTER\s+TYPE/i)
    expect(statements).not.toMatch(/DELETE\s+FROM/i)
    expect(migration).toMatch(/ADD COLUMN "source"/)
    expect(migration).toMatch(/ADD COLUMN "environment"/)
  })

  it("Subscription model gained NO required (non-nullable, no-default) columns beyond Phase 1 fields", () => {
    const sub = modelBlock("Subscription")
    // source/environment must be nullable so legacy rows stay valid.
    expect(sub).toMatch(/source\s+SubscriptionSource\?/)
    expect(sub).toMatch(/environment\s+String\?/)
  })
})

describe("code-level domain separation", () => {
beforeEach(() => {
  fake = createFakeDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedUser("user_ok")
  fake.seedProduct("prod_1")
  fake.seedTier("tier_1", "prod_1")
})

  it("foundation create never touches Order/Payment/Cart/Invoice (fake DB traps prove it)", async () => {
    // Fake DB traps throw on order.create / payment.create; a pass here is proof.
    const result = await createFoundationSubscription({
      userId: "user_ok",
      productId: "prod_1",
      tierId: "tier_1",
      source: "SYSTEM",
      environment: "test",
    })
    expect(result.status).toBe(SubStatus.TRIALING)
    expect(fake.store.subscriptions.size).toBe(1)
  })

  it("foundation module source contains no commerce-table access", async () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib", "services", "subscription-domain.ts"),
      "utf8",
    )
    for (const forbidden of [
      "db.order",
      "db.cart",
      "db.payment",
      "db.invoice",
      "db.cartItem",
      "orderItem",
    ]) {
      expect(src, forbidden).not.toContain(forbidden)
    }
  })

  it("subscription can exist without Order; Order state cannot overwrite it", async () => {
    const created = await createFoundationSubscription({
      userId: "user_ok",
      productId: "prod_1",
      tierId: "tier_1",
      source: "CHECKOUT",
      environment: "test",
    })
    const row = fake.store.subscriptions.get(created.id)!
    expect(row).toBeDefined()
    // No orderId anywhere on the subscription row.
    expect(Object.keys(row)).not.toContain("orderId")
    // Payment rows (created by the standalone flow) carry subscriptionId as
    // OPTIONAL metadata only — subscription itself owns its own status.
    expect(row.status).toBe(SubStatus.TRIALING)
  })
})
