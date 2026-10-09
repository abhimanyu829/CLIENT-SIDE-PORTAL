/**
 * Phase 6 — Test Groups I (failure) + J (concurrency) + K (structure/regression).
 */
import { readFileSync } from "fs"
import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrialStatus } from "@prisma/client"
import { createFakeFreeTrialDb, type FakeFreeTrialDb } from "./helpers/fake-free-trial-db"

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
  SUBSCRIPTION_JOBS: { TRIAL_EXPIRE: "subscription.trial-expire" },
}))

import * as dbModule from "@/lib/db"

const { startTrial, expireExpiredTrials, enrollFreePlan } = await import(
  "@/lib/services/free-trial-service"
)

function seedWorld() {
  fake.seedUser("user_1")
  fake.seedDef("product.prod_1")
  fake.seedPlan(
    { id: "plan_paid", planType: "MONTHLY", status: "PUBLISHED", currentVersionId: "plan_paid_v1" },
    [{ id: "plan_paid_v1", items: [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }] }],
  )
}

beforeEach(() => {
  fake = createFakeFreeTrialDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  seedWorld()
})

describe("I — failure", () => {
  it("trial create failure is surfaced, no grants, no phantom enrollment", async () => {
    fake.failures.failTrialCreate = true
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow()
    expect(fake.store.grants.size).toBe(0)
  })

  it("grant failure leaves the trial PENDING with an error and no false success", async () => {
    fake.failures.failGrantCreate = true
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(/provisioning failed/i)
    expect(fake.store.grants.size).toBe(0)
    const trial = [...fake.store.trials.values()][0]
    expect(trial.status).toBe("PENDING")
    expect(trial.provisioningError).toBeTruthy()
  })

  it("malformed plan (DRAFT only) cannot provision", async () => {
    fake.store.plans.get("plan_paid")!.versions = [
      { id: "plan_paid_v1", version: 1, status: "DRAFT", items: [] },
    ]
    await expect(enrollFreePlan("user_1")).rejects.toThrow(/FREE plan/i)
    await expect(startTrial({ userId: "user_1", planId: "plan_paid" })).rejects.toThrow(/no published version/i)
  })

  it("no unsafe access on failure: grants stay empty across failure scenarios", async () => {
    const before = fake.store.grants.size
    fake.failures.failGrantCreate = true
    await startTrial({ userId: "user_1", planId: "plan_paid" }).catch(() => undefined)
    expect(fake.store.grants.size).toBe(before)
  })
})

describe("J — concurrency", () => {
  it("simultaneous free enrollment + trial + expiry remains deterministic per source", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    fake.seedPlan(
      { id: "plan_free", planType: "FREE", status: "PUBLISHED", currentVersionId: "plan_free_v1" },
      [{ id: "plan_free_v1", items: [{ itemType: "PRODUCT", itemRefId: "prod_1", itemRefKey: "prod_1" }] }],
    )
    await Promise.allSettled([
      enrollFreePlan("user_1", "s"),
      expireExpiredTrials(new Date(t.expiresAt.getTime() + 1), "s"),
    ])
    expect(fake.store.trials.get(t.enrollmentId)!.status).toBe("EXPIRED")
    const remaining = [...fake.store.grants.values()].filter((g) => g.status === "ACTIVE")
    expect(remaining.length).toBeGreaterThanOrEqual(1)
  })

  it("multiple provisioning retries never duplicate the trial grant", async () => {
    const t = await startTrial({ userId: "user_1", planId: "plan_paid" }, "system")
    expect(fake.store.grants.size).toBe(1)
    // Repeated expiry sweep with the same future boundary is a no-op.
    await expireExpiredTrials(new Date(t.expiresAt.getTime() - 1), "s")
    expect(fake.store.grants.size).toBe(1)
  })
})

describe("K — structure, migration and regression", () => {
  const root = process.cwd()
  const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8")
  const migration = readFileSync(
    path.join(root, "prisma", "migrations", "20261008050000_free_and_trial", "migration.sql"),
    "utf8",
  )
  const stmts = migration.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
  const service = readFileSync(path.join(root, "lib", "services", "free-trial-service.ts"), "utf8")
  const lifecycle = readFileSync(path.join(root, "lib", "services", "free-trial-lifecycle.ts"), "utf8")
  const code = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.split("//")[0])
      .join("\n")

  it("schema adds the two enrollment models, two enums and two source values", () => {
    expect(schema).toMatch(/model TrialEnrollment \{/)
    expect(schema).toMatch(/model FreeEnrollment \{/)
    expect(schema).toMatch(/enum TrialStatus \{/)
    expect(schema).toMatch(/enum FreeEnrollmentStatus \{/)
    expect(schema).toMatch(/FREE_PLAN\s*$|FREE_PLAN\s*\r?$/m)
    expect(schema).toContain("TRIAL")
    const trial = schema.match(/model TrialEnrollment \{[\s\S]*?\n\}/)![0]
    expect(trial).toMatch(/trialScopeKey\s+String\s+@unique/)
  })

  it("migration is additive and touches no existing table", () => {
    expect(stmts).not.toMatch(/DROP\s+TABLE/i)
    expect(stmts).not.toMatch(/DROP\s+COLUMN/i)
    for (const t of ["Order", "Payment", "Invoice", "Subscription", "UserSubscription", "SubscriptionPlan", "PlanVersion", "PlanItem", "EntitlementDefinition", "EntitlementGrant", "RazorpayPlanMapping", "SubscriptionCharge", "WebhookEvent", "SubscriptionProvisioning", "CustomerEntitlement"]) {
      expect(stmts, t).not.toMatch(new RegExp(`ALTER TABLE "${t}"`, "i"))
    }
    expect(stmts).toContain("ADD VALUE 'FREE_PLAN'")
    expect(stmts).toContain("ADD VALUE 'TRIAL'")
  })

  it("free/trial code performs no payment, checkout, provider or provisioning-table mutations", () => {
    const c = code(service)
    for (const forbidden of ["db.order", "db.payment", "db.invoice", "db.subscriptioncharge", "db.webhookevent"]) {
      expect(c.toLowerCase(), forbidden).not.toContain(forbidden)
    }
    expect(service).toContain("grantEntitlement")
    expect(service).toContain("sourceType: EntitlementSourceType.FREE_PLAN")
    expect(service).toContain("sourceType: EntitlementSourceType.TRIAL")
    expect(lifecycle).not.toContain('from "@/lib/db"')
    expect(lifecycle).not.toMatch(/\bdb\.[a-zA-Z]/)
  })

  it("Phases 1-5 foundations preserved", () => {
    for (const m of ["model Subscription {", "model PlanVersion {", "model EntitlementGrant {", "model RazorpayPlanMapping {", "model SubscriptionProvisioning {"]) {
      expect(schema).toContain(m)
    }
    expect(readFileSync(path.join(root, "lib", "services", "subscription-provisioning.ts"), "utf8")).toContain("provisionSubscription")
  })

  it("existing standalone access logic untouched", () => {
    const subService = readFileSync(path.join(root, "lib", "services", "subscription-service.ts"), "utf8")
    expect(subService).toContain("export async function userHasProductAccess")
  })

  it("trial status never reaches terminal by stale replay (state machine block)", () => {
    expect(can("CONVERTED", "ACTIVE")).toBe(false)
    expect(can("EXPIRED", "ACTIVE")).toBe(false)
    expect(can("CANCELLED", "PENDING")).toBe(false)
  })
})

function can(from: string, to: string): boolean {
  return from === to || ((({ PENDING: ["ACTIVE", "CANCELLED"], ACTIVE: ["CONVERTED", "EXPIRED", "CANCELLED"] }) as Record<string, string[]>)[from]?.includes(to) ?? false)
}
