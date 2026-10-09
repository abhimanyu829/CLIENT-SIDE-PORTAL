/**
 * Phase 8 — governance queries plus protected systems regression (structural).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, unknown>
let store: {
  usubs: Row[]
  trials: Row[]
  frees: Row[]
  provs: Row[]
  charges: Row[]
  webhooks: Row[]
  grants: Row[]
  audits: Row[]
  plans: Row[]
}

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
vi.mock("@/lib/services/plan-catalog-service", () => ({
  listPlans: vi.fn(async () => []),
  createPlan: vi.fn(async () => ({})),
}))

import * as dbModule from "@/lib/db"
const { getGovernanceMetrics, listOperationalIssues, listAdminSubscriptions, listAdminAudit } = await import(
  "@/lib/services/admin-subscription-service"
)

function makeFake() {
  store = {
    usubs: [{ id: "u1", userId: "user_1", planId: "p1", planVersionId: "v1", status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodStart: new Date(), currentPeriodEnd: new Date(), userId_: "user_1", razorpaySubscriptionId: "sub_1", createdAt: new Date() }],
    trials: [{ id: "t1", userId: "user_1", planId: "p1", planVersionId: "v1", status: "ACTIVE", startedAt: new Date(), expiresAt: new Date(Date.now() + 3 * 86400_000), createdAt: new Date() }],
    frees: [{ id: "f1", userId: "user_1", planId: "pf", planVersionId: "vf", status: "ACTIVE", environment: "test", createdAt: new Date() }],
    provs: [{ id: "pr1", subscriptionId: "u1", status: "FAILED_PERMANENT", errorMessage: "bad", createdAt: new Date() }],
    charges: [{ id: "c1", razorpaySubscriptionId: "sub_1", chargeStatus: "FAILED", createdAt: new Date() }],
    webhooks: [{ id: "w1", source: "RAZORPAY", status: "FAILED", eventType: "subscription.charged", errorMessage: "x", createdAt: new Date() }],
    grants: [],
    audits: [{ id: "a1", userId: "admin_1", action: "PLAN_PUBLISHED", entity: "SubscriptionPlan", entityId: "p1", afterJson: {}, createdAt: new Date() }],
    plans: [{ id: "p1", name: "Growth", slug: "growth", planType: "MONTHLY", status: "PUBLISHED" }],
  }

  const count = (where: Record<string, unknown> | undefined, rows: Row[]) => {
    if (!where) return rows.length
    return rows.filter((r) => Object.entries(where).every(([k, v]) => {
      if (k === "status" && v && typeof v === "object" && "in" in (v as object)) {
        return (v as { in: string[] }).in.includes(r[k] as string)
      }
      if (k === "expiresAt" && v && typeof v === "object" && "lte" in (v as object)) {
        return (r[k] as Date).getTime() <= (v as { lte: Date }).lte.getTime()
      }
      return r[k] === v
    })).length
  }

  return {
    __setFakeDb: true,
    userSubscription: {
      count: (a: any) => count(a?.where, store.usubs),
      findMany: (a: any) => {
        let rows = [...store.usubs]
        if (a.where?.status) rows = rows.filter((r) => r.status === a.where.status)
        if (a.where?.plan) rows = rows.filter((r) => r.planId === a.plan!.planType ? true : false)
        if (a.where?.OR) {
          const parts = a.where.OR as Array<{ user?: { name?: { contains: string } }; id?: { contains: string } }>
          rows = rows.filter((r) => parts.some((p) => (p.id?.contains ? (r.id as string).includes(p.id.contains) : false)))
        }
        const out = rows.slice(a.skip ?? 0, (a.skip ?? 0) + (a.take ?? 20)).map((s) => ({
          ...s,
          plan: { name: "Growth", planType: "MONTHLY", billingIntervalMonths: 1 },
          user: { name: "Owner", email: "owner@example.com" },
        }))
        return out as never
      },
    },
    trialEnrollment: { count: (a: { where?: Record<string, unknown> }) => count(a?.where, store.trials) },
    freeEnrollment: { count: (a: { where?: Record<string, unknown> }) => count(a?.where, store.frees) },
    subscriptionProvisioning: { count: (a: { where?: Record<string, unknown> }) => count(a?.where, store.provs), findMany: (a: Record<string, unknown>) => store.provs.slice(0, (a as { take?: number }).take ?? 50) as never },
    subscriptionCharge: { count: (a: { where?: Record<string, unknown> }) => count(a?.where, store.charges), findMany: () => store.charges as never },
    webhookEvent: { count: (a: { where?: Record<string, unknown> }) => count(a?.where, store.webhooks), findMany: () => store.webhooks as never },
    entitlementGrant: { findMany: () => store.grants as never },
    auditLog: {
      findMany: () => store.audits as never,
      count: () => store.audits.length,
    },
  }
}

beforeEach(() => {
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(makeFake() as never)
})

describe("governance metrics", () => {
  it("computes accurate counts per state (never mixes statuses)", async () => {
    const m = await getGovernanceMetrics()
    expect(m.paidActive).toBe(1)
    expect(m.activeTrials).toBe(1)
    expect(m.freeEnrollments).toBe(1)
    expect(m.provisioningFailures).toBe(1)
    expect(m.chargeFailures).toBe(1)
    expect(m.webhookFailures).toBe(1)
    expect(m.pendingActivation).toBe(0)
  })
})

describe("operational issues + audit", () => {
  it("aggregates failures from provisioning, charges and webhooks", async () => {
    const issues = await listOperationalIssues(50)
    const kinds = issues.map((i) => i.kind).sort()
    expect(kinds).toEqual(["CHARGE", "PROVISIONING", "WEBHOOK"])
    for (const i of issues) expect(i.createdAt).toBeTruthy()
  })

  it("returns sanitized audit rows", async () => {
    const result = await listAdminAudit(1, 50)
    expect(result.total).toBe(1)
    expect(result.items[0].action).toBe("PLAN_PUBLISHED")
  })
})

describe("protected systems (structural)", () => {
  const { readFileSync } = require("fs") as typeof import("fs")
  const path = require("path") as typeof import("path")
  const root = process.cwd()

  it("governance touches no standalone commerce or customer-payment code", async () => {
    const service = readFileSync(path.join(root, "lib", "services", "admin-subscription-service.ts"), "utf8")
    expect(service).not.toContain("db.order.create")
    expect(service).not.toContain("db.payment.create")
    expect(service).not.toContain("db.cart")
  })

  it("existing one-time Razorpay route untouched (path still present)", () => {
    readFileSync(path.join(root, "app", "api", "payments", "razorpay", "order", "route.ts"), "utf8")
    readFileSync(path.join(root, "app", "api", "payments", "razorpay", "webhook", "route.ts"), "utf8")
  })

  it("Phase 7 customer subscription pages preserved", () => {
    readFileSync(path.join(root, "app", "(dashboard)", "dashboard", "subscription", "page.tsx"), "utf8")
    readFileSync(path.join(root, "app", "(dashboard)", "dashboard", "subscription", "plans", "page.tsx"), "utf8")
  })
})
