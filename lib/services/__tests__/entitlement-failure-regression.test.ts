/**
 * Phase 3 — Test Groups L+M: failure handling and regression/protected-system
 * verification (schema + structural).
 */
import { readFileSync } from "fs"
import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementSourceType } from "@prisma/client"
import { createFakeEntitlementDb, type FakeEntitlementDb } from "./helpers/fake-entitlement-db"

let fake: FakeEntitlementDb

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
vi.mock("@/lib/services/cache-service", () => {
  const store = new Map<string, unknown>()
  return {
    __store: store,
    cacheGet: vi.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    cacheSet: vi.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)))
      return true
    }),
    invalidateCache: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k)
    }),
    CACHE_KEYS: { AI_QUOTA_PREFIX: "ai:quota:" },
    aiQuotaCacheKey: (id: string) => `ai:quota:${id}`,
  }
})

import * as dbModule from "@/lib/db"
import * as cacheNs from "@/lib/services/cache-service"

const { grantEntitlement, createDefinition } = await import("@/lib/services/entitlement-service")
const { getEffectiveEntitlements, hasEntitlement } = await import(
  "@/lib/services/entitlement-resolver"
)
const { EntitlementError } = await import("@/lib/services/entitlement-lifecycle")

const SUBJECT = { type: "USER" as const, userId: "user_1" }

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
  fake.seedUser("user_1")
  fake.seedDefinition({ id: "def_p", key: "product.school_management", type: "PRODUCT" })
})

const GRANT = {
  entitlementKey: "product.school_management",
  subjectType: "USER" as const,
  subjectUserId: "user_1",
  sourceType: EntitlementSourceType.ADMIN_GRANT,
  sourceReference: "src_1",
}

describe("L — failure handling", () => {
  it("grant.create failure leaves no grant and no unsafe partial state", async () => {
    fake.failures.failGrantCreate = true
    await expect(grantEntitlement(GRANT, "a")).rejects.toThrow(/entitlementGrant.create/)
    expect(fake.store.grants.size).toBe(0)
  })

  it("definition.create failure leaves no definition", async () => {
    fake.failures.failDefinitionCreate = true
    await expect(
      createDefinition({ key: "feature.rag", name: "RAG", type: "FEATURE" }, "a"),
    ).rejects.toThrow(/entitlementDefinition.create/)
    expect(fake.store.definitions.size).toBe(1) // only the seed
  })

  it("source lookup failure (customerEntitlement read) never yields unsafe ALLOW", async () => {
    fake.seedCustomerEntitlement({
      id: "ce_1",
      userId: "user_1",
      productId: "prod_x",
      orderId: "order_1",
    })
    fake.failures.failCustomerEntitlementRead = true
    // DB error → resolver surfaces a typed failure instead of guessing ALLOW.
    await expect(getEffectiveEntitlements(SUBJECT)).rejects.toThrow(/customerEntitlement.findMany/)
  })

  it("malformed grant input is rejected before any DB write", async () => {
    for (const bad of [null, undefined, [], "x", 42, {}]) {
      await expect(grantEntitlement(bad, "a")).rejects.toThrow(EntitlementError)
    }
    expect(fake.store.grants.size).toBe(0)
  })

  it("revoke transaction failure leaves the grant ACTIVE (no silent revoke)", async () => {
    const grant = await grantEntitlement(GRANT, "a")
    fake.failures.failGrantUpdateMany = true
    const { revokeEntitlement } = await import("@/lib/services/entitlement-service")
    await expect(revokeEntitlement(grant.id, "a", "r")).rejects.toThrow()
    expect(fake.store.grants.get(grant.id)!.status).toBe("ACTIVE")
  })
})

describe("M — regression & protected systems (structural)", () => {
  const root = process.cwd()
  const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8")
  const migration = readFileSync(
    path.join(root, "prisma", "migrations", "20261008020000_entitlement_engine", "migration.sql"),
    "utf8",
  )
  const statements = migration
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
  const resolverSource = readFileSync(path.join(root, "lib", "services", "entitlement-resolver.ts"), "utf8")
  const serviceSource = readFileSync(path.join(root, "lib", "services", "entitlement-service.ts"), "utf8")
  const code = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.split("//")[0])
      .join("\n")

  it("Phase-3 models and enums exist with correct constraints", () => {
    for (const m of ["EntitlementDefinition", "EntitlementGrant"]) {
      expect(schema).toMatch(new RegExp(`model ${m} \\{`))
    }
    for (const e of ["EntitlementType", "EntitlementSourceType", "EntitlementScope", "GrantStatus", "EntitlementSubjectType"]) {
      expect(schema).toMatch(new RegExp(`enum ${e} \\{`))
    }
    const grant = schema.match(/model EntitlementGrant \{[\s\S]*?\n\}/)![0]
    expect(grant).toMatch(/dedupeKey\s+String\s+@unique/)
    expect(grant.match(/@@index\(/g)!.length).toBeGreaterThanOrEqual(6)
    expect(grant).toMatch(/subjectUser\s+User\?\s+@relation\("EntitlementGrantUser"/)
    expect(grant).toMatch(/subjectTeam\s+Team\?\s+@relation\("EntitlementGrantTeam"/)
  })

  it("migration is additive-only and touches no commerce or plan table", () => {
    expect(statements).not.toMatch(/DROP\s+TABLE/i)
    expect(statements).not.toMatch(/DROP\s+COLUMN/i)
    expect(statements).not.toMatch(/RENAME/i)
    expect(statements).not.toMatch(/ALTER\s+TYPE/i)
    expect(statements).not.toMatch(/CREATE\s+TABLE\s+"(Order|OrderItem|Payment|Cart|CartItem|Invoice|Product|SubscriptionPlan|PlanVersion|PlanItem|CustomerEntitlement)"/i)
    for (const t of ["Order", "OrderItem", "Payment", "Cart", "Invoice", "Product", "SubscriptionPlan", "PlanVersion", "PlanItem", "CustomerEntitlement"]) {
      expect(statements, t).not.toMatch(new RegExp(`ALTER TABLE "${t}"`, "i"))
    }
    expect(statements).not.toMatch(/CatalogCanonicalProduct|CatalogCrawl|CatalogSource/i)
  })

  it("entitlement code performs no payment, checkout, plan or provider operations", () => {
    for (const file of [serviceSource, resolverSource]) {
      const c = code(file).toLowerCase()
      for (const forbidden of ["razorpay", "stripe", "db.order", "db.payment", "db.cart", "db.invoice", "db.subscriptionplan", "db.planversion", "db.planitem", "checkout"]) {
        expect(c, `${forbidden} in ${file.slice(-40)}`).not.toContain(forbidden)
      }
    }
  })

  it("standalone access machinery is preserved (userHasProductAccess + CustomerEntitlement untouched)", () => {
    const subService = readFileSync(path.join(root, "lib", "services", "subscription-service.ts"), "utf8")
    expect(subService).toContain("export async function userHasProductAccess")
    const commerce = readFileSync(path.join(root, "lib", "services", "enterprise-commerce-service.ts"), "utf8")
    expect(commerce).toContain("customerEntitlement.create")
  })

  it("Phase-1 and Phase-2 foundations are preserved", () => {
    expect(schema).toMatch(/enum SubscriptionSource \{/)
    const sub = schema.match(/model Subscription \{[\s\S]*?\n\}/)![0]
    expect(sub).toMatch(/source\s+SubscriptionSource\?/)
    expect(schema).toMatch(/model PlanVersion \{/)
    expect(schema).toMatch(/model PlanItem \{/)
    expect(schema).toMatch(/enum PlanType \{/)
  })

  it("GRANT_GLOBAL vs resource scope: resolver never mixes tenants or resources", async () => {
    fake.seedUser("user_2")
    fake.seedDefinition({ id: "def_r", key: "product.ecommerce", type: "PRODUCT" })
    await grantEntitlement(
      {
        entitlementKey: "product.ecommerce",
        subjectType: "USER",
        subjectUserId: "user_2",
        sourceType: EntitlementSourceType.ADMIN_GRANT,
        sourceReference: "x",
        scope: "RESOURCE",
        resourceId: "shop_a",
      },
      "a",
    )
    expect(await hasEntitlement({ type: "USER", userId: "user_2" }, "product.ecommerce", { resourceId: "shop_a" })).toBe(true)
    expect(await hasEntitlement({ type: "USER", userId: "user_2" }, "product.ecommerce", { resourceId: "shop_b" })).toBe(false)
    expect(await hasEntitlement(SUBJECT, "product.ecommerce", { resourceId: "shop_a" })).toBe(false)
  })
})
