/**
 * Phase 2 — Test Group G (schema/migration) + Group I (standalone regression,
 * static verification) + Phase-1 preservation.
 *
 * These are structural guarantees: they read the real schema, migration and
 * source files so a regression is caught even without a live database.
 */
import { readFileSync } from "fs"
import path from "path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8")
const migration = readFileSync(
  path.join(root, "prisma", "migrations", "20261008010000_subscription_plan_catalog", "migration.sql"),
  "utf8",
)
const catalogSource = readFileSync(
  path.join(root, "lib", "services", "plan-catalog-service.ts"),
  "utf8",
)
const lifecycleSource = readFileSync(
  path.join(root, "lib", "services", "plan-lifecycle.ts"),
  "utf8",
)

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))
  if (!match) throw new Error(`model ${name} not found`)
  return match[0]
}

const statements = migration
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")

describe("G — schema & migration", () => {
  it("declares the Phase-2 domain models and enums", () => {
    for (const model of ["PlanVersion", "PlanItem"]) {
      expect(schema).toMatch(new RegExp(`model ${model} \\{`))
    }
    for (const enumName of ["PlanStatus", "PlanType", "PlanVersionStatus", "PlanItemType"]) {
      expect(schema).toMatch(new RegExp(`enum ${enumName} \\{`))
    }
  })

  it("SubscriptionPlan gained the additive Phase-2 columns with a PUBLISHED default", () => {
    const plan = modelBlock("SubscriptionPlan")
    expect(plan).toMatch(/status\s+PlanStatus\s+@default\(PUBLISHED\)/)
    expect(plan).toMatch(/planType\s+PlanType\?/)
    expect(plan).toMatch(/durationMonths\s+Int\?/)
    expect(plan).toMatch(/billingIntervalMonths\s+Int\?/)
    expect(plan).toMatch(/currentVersionId\s+String\?/)
    expect(plan).toMatch(/catalogRevision\s+Int\s+@default\(0\)/)
    expect(plan).toMatch(/versions\s+PlanVersion\[\]/)
  })

  it("PlanVersion has a unique (planId, version) and cascades from the plan", () => {
    const version = modelBlock("PlanVersion")
    expect(version).toMatch(/@@unique\(\[planId, version\]\)/)
    expect(version).toMatch(/plan\s+SubscriptionPlan\s+@relation\(fields: \[planId\], references: \[id\], onDelete: Cascade\)/)
    expect(version).toMatch(/planId\s+String/)
  })

  it("PlanItem prevents duplicates via (planVersionId, itemType, itemRefKey) unique", () => {
    const item = modelBlock("PlanItem")
    expect(item).toMatch(/@@unique\(\[planVersionId, itemType, itemRefKey\]\)/)
    expect(item).toMatch(/itemRefKey\s+String/)
    expect(item).toMatch(/planVersion\s+PlanVersion\s+@relation\(fields: \[planVersionId\], references: \[id\], onDelete: Cascade\)/)
  })

  it("migration is additive-only and never touches standalone commerce or the legacy Catalog drift", () => {
    expect(statements).not.toMatch(/DROP\s+TABLE/i)
    expect(statements).not.toMatch(/DROP\s+COLUMN/i)
    expect(statements).not.toMatch(/RENAME/i)
    expect(statements).not.toMatch(/DELETE\s+FROM/i)
    expect(statements).not.toMatch(/DROP\s+CONSTRAINT/i)
    // Legacy Catalog drift tables are excluded from this migration's scope.
    expect(statements).not.toMatch(/CatalogCanonicalProduct|CatalogCrawl|CatalogSource/i)
    // Additive statements present.
    expect(statements).toMatch(/"status"\s+"PlanStatus"\s+NOT NULL DEFAULT 'PUBLISHED'/)
    expect(statements).toMatch(/CREATE TABLE "PlanVersion"/)
    expect(statements).toMatch(/CREATE TABLE "PlanItem"/)
    expect(statements).toMatch(/CREATE TYPE "PlanStatus"/)
    // Commerce tables untouched.
    for (const t of ["Order", "OrderItem", "Payment", "Cart", "CartItem", "Invoice", "Product"]) {
      expect(statements, t).not.toMatch(new RegExp(`ALTER TABLE "${t}"`, "i"))
    }
  })

  it("existing SubscriptionPlan required columns are untouched (no destructive change)", () => {
    for (const col of ["slug\\s+String\\s+@unique", "name\\s+String", "price\\s+Decimal"]) {
      expect(modelBlock("SubscriptionPlan")).toMatch(new RegExp(col))
    }
  })
})

describe("I — standalone commerce & Phase-1 preservation (static)", () => {
  it("standalone commerce models have no required plan dependency", () => {
    for (const name of ["Order", "OrderItem", "Cart", "CartItem", "Payment", "Invoice", "Product"]) {
      const block = modelBlock(name)
      expect(block, name).not.toMatch(/planVersionId/)
      expect(block, name).not.toMatch(/subscriptionPlanId/)
    }
  })

  it("catalog service never touches commerce tables or provider APIs", () => {
    const code = catalogSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.split("//")[0])
      .join("\n")
    for (const forbidden of [
      "db.order",
      "db.payment",
      "db.cart",
      "db.invoice",
      "razorpay",
      "stripe",
      "Razorpay",
      "Stripe",
    ]) {
      expect(code, forbidden).not.toContain(forbidden)
    }
  })

  it("catalog service performs no entitlement grants or access checks", () => {
    const code = catalogSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.split("//")[0])
      .join("\n")
    for (const forbidden of ["customerEntitlement", "grantAccess", "hasAccess"]) {
      expect(code.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase())
    }
  })

  it("lifecycle module is pure (no I/O) and server-controlled", () => {
    expect(lifecycleSource).not.toMatch(/from "@\/lib\/db"/)
    // No async I/O: the lifecycle module never awaits and never reads a DB.
    expect(lifecycleSource).not.toMatch(/\bawait\b/)
    expect(lifecycleSource).not.toMatch(/\bdb\.[a-zA-Z]/)
    expect(lifecycleSource).toMatch(/PLAN_STATUS_TRANSITIONS/)
    expect(lifecycleSource).toMatch(/PLAN_VERSION_TRANSITIONS/)
  })

  it("Phase-1 subscription foundation is preserved", () => {
    const sub = modelBlock("Subscription")
    expect(sub).toMatch(/source\s+SubscriptionSource\?/)
    expect(sub).toMatch(/environment\s+String\?/)
    expect(schema).toMatch(/enum SubscriptionSource \{/)
    // Phase-1 service/module files still exist.
    readFileSync(path.join(root, "lib", "services", "subscription-state-machine.ts"), "utf8")
    readFileSync(path.join(root, "lib", "services", "subscription-domain.ts"), "utf8")
  })

  it("ProductTier (existing Stack A pricing) is untouched", () => {
    const tier = modelBlock("ProductTier")
    expect(tier).toMatch(/razorpayPlanId\s+String\?/)
    expect(tier).toMatch(/stripePriceId\s+String\?/)
  })
})
