/**
 * Phase 5 — Test Group M: schema/migration structure + standalone regression +
 * Phase 1-4 preservation (structural, no live DB).
 */
import { readFileSync } from "fs"
import path from "path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8")
const migration = readFileSync(
  path.join(root, "prisma", "migrations", "20261008040000_subscription_provisioning", "migration.sql"),
  "utf8",
)
const stmts = migration.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
const service = readFileSync(path.join(root, "lib", "services", "subscription-provisioning.ts"), "utf8")
const code = service
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => l.split("//")[0])
  .join("\n")

describe("M — structure & protected systems", () => {
  it("defines the provisioning record and both enums with dedupe uniqueness", () => {
    expect(schema).toMatch(/enum ProvisioningOperation \{/)
    for (const op of ["INITIAL_ACTIVATION", "SUCCESSFUL_RENEWAL", "PERIOD_EXTENSION", "CANCELLATION_UPDATE", "PAUSE_UPDATE", "RESUME_UPDATE", "PAYMENT_HALT_UPDATE", "EXPIRATION", "ACCESS_REVOCATION"]) {
      expect(schema).toContain(op)
    }
    expect(schema).toMatch(/enum ProvisioningStatus \{/)
    const model = schema.match(/model SubscriptionProvisioning \{[\s\S]*?\n\}/)![0]
    expect(model).toMatch(/dedupeKey\s+String\s+@unique/)
    expect(model).toMatch(/status\s+ProvisioningStatus\s+@default\(PENDING\)/)
    expect(model).toMatch(/attemptCount\s+Int\s+@default\(0\)/)
    expect(model).toMatch(/subscription\s+UserSubscription\s+@relation\(fields: \[subscriptionId\]/)
  })

  it("migration is additive-only and touches no other table", () => {
    expect(stmts).not.toMatch(/DROP\s+TABLE/i)
    expect(stmts).not.toMatch(/DROP\s+COLUMN/i)
    expect(stmts).not.toMatch(/ALTER\s+TYPE/i)
    for (const t of ["Order", "Payment", "Invoice", "Subscription", "SubscriptionPlan", "PlanVersion", "PlanItem", "EntitlementDefinition", "EntitlementGrant", "RazorpayPlanMapping", "SubscriptionCharge", "WebhookEvent", "UserSubscription", "CustomerEntitlement"]) {
      expect(stmts, t).not.toMatch(new RegExp(`ALTER TABLE "${t}"`, "i"))
    }
    expect(stmts).not.toMatch(/CatalogCanonicalProduct|CatalogCrawl|CatalogSource/i)
  })

  it("provisioning never touches commerce, billing or provider mutation tables", () => {
    for (const forbidden of [
      "db.order",
      "db.payment",
      "db.invoice",
      "db.razorpayplanmapping",
      "db.subscriptioncharge",
      "db.webhookevent",
      "razorpay.next",
      "checkout",
    ]) {
      expect(code.toLowerCase(), forbidden).not.toContain(forbidden)
    }
  })

  it("provisioning calls Phase-3 services and never pastes raw provider events", () => {
    expect(service).toContain("grantEntitlement")
    expect(service).toContain("extendEntitlementGrant")
    expect(service).toContain("expireEntitlementGrant")
    expect(service).toContain("revokeEntitlement")
    expect(code).not.toContain("x-razorpay-signature")
    expect(code).not.toContain("webhook")
  })

  it("Phases 1-4 foundations preserved", () => {
    expect(schema).toMatch(/enum SubscriptionSource \{/)
    expect(schema).toMatch(/model PlanVersion \{/)
    expect(schema).toMatch(/model EntitlementGrant \{/)
    expect(schema).toMatch(/model RazorpayPlanMapping \{/)
    expect(schema).toMatch(/model SubscriptionCharge \{/)
  })

  it("Phase-4 webhook keeps billing-only processing; provisioning is a separate hook", () => {
    const webhook = readFileSync(path.join(root, "lib", "services", "razorpay-subscription-webhook.ts"), "utf8")
    expect(webhook).toContain("scheduleProvisioning")
    expect(webhook).toContain("provisioningOperationFor")
    // No raw grant calls inside the billing webhook.
    expect(webhook).not.toContain("grantEntitlement(")
  })

  it("existing standalone access logic untouched", () => {
    const subService = readFileSync(path.join(root, "lib", "services", "subscription-service.ts"), "utf8")
    expect(subService).toContain("export async function userHasProductAccess")
  })
})
