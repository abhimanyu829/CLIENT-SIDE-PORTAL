/**
 * Phase 2 — Test Group C: plan composition (multi-item bundles).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlanItemType } from "@prisma/client"
import { createFakePlanDb, type FakePlanDb } from "./helpers/fake-plan-db"

let fake: FakePlanDb

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

import * as dbModule from "@/lib/db"

const { createPlan, addPlanItem, validatePlan, publishPlan, getPlan } = await import(
  "@/lib/services/plan-catalog-service"
)

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("school_saas")
  fake.seedProduct("ai_website")
  fake.seedProduct("ecommerce_saas")
  fake.seedProduct("hospital_saas")
  fake.seedService("analytics_svc")
  fake.seedAgent("sales_agent")
})

describe("C — plan composition", () => {
  it("composes a MONTHLY plan: 1 product + 1 AI capability + storage + admin-user limits", async () => {
    const { plan, version } = await createPlan(
      { name: "Launch Monthly", planType: "MONTHLY", currency: "INR", basePrice: 1999 },
      "admin_1",
    )

    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "school_saas" }, "admin_1")
    await addPlanItem(
      version.id,
      { itemType: "AI_CAPABILITY", itemRefId: "sales_agent" },
      "admin_1",
    )
    await addPlanItem(
      version.id,
      { itemType: "STORAGE", limitValue: 5, limitUnit: "GB" },
      "admin_1",
    )
    await addPlanItem(
      version.id,
      { itemType: "ADMIN_LIMIT", limitValue: 2, limitUnit: "admins" },
      "admin_1",
    )
    await addPlanItem(
      version.id,
      { itemType: "SUPPORT", itemRefKey: "standard", label: "Standard" },
      "admin_1",
    )

    const validation = await validatePlan(plan.id)
    expect(validation.valid).toBe(true)

    const published = await publishPlan(plan.id, "admin_1")
    expect(published.version.status).toBe("PUBLISHED")

    const detail = (await getPlan(plan.id)) as unknown as {
      versions: Array<{ id: string; items: Array<{ itemType: string; itemRefId: string | null }> }>
    }
    const v1 = detail.versions.find((v) => v.id === version.id)!
    expect(v1.items).toHaveLength(5)
    expect(v1.items.filter((i) => i.itemType === PlanItemType.PRODUCT)).toHaveLength(1)
    expect(v1.items.find((i) => i.itemType === PlanItemType.AI_CAPABILITY)?.itemRefId).toBe(
      "sales_agent",
    )
  })

  it("composes a SIX_MONTH plan bundling multiple products + services + limits", async () => {
    const { plan, version } = await createPlan(
      { name: "Scale 6 Month", planType: "SIX_MONTH", currency: "INR", basePrice: 9999 },
      "admin_1",
    )

    for (const productId of ["school_saas", "ecommerce_saas", "hospital_saas"]) {
      await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: productId }, "admin_1")
    }
    await addPlanItem(version.id, { itemType: "SERVICE", itemRefId: "analytics_svc" }, "admin_1")
    await addPlanItem(version.id, { itemType: "STORAGE", limitValue: 20, limitUnit: "GB" }, "admin_1")
    await addPlanItem(version.id, { itemType: "USER_LIMIT", limitValue: 5, limitUnit: "users" }, "admin_1")
    await addPlanItem(version.id, { itemType: "ADMIN_LIMIT", limitValue: 5, limitUnit: "admins" }, "admin_1")
    await addPlanItem(version.id, { itemType: "SUPPORT", itemRefKey: "priority", label: "Priority" }, "admin_1")

    const validation = await validatePlan(plan.id)
    expect(validation.valid).toBe(true)
    await publishPlan(plan.id, "admin_1")

    const detail = (await getPlan(plan.id)) as unknown as {
      versions: Array<{ items: Array<unknown> }>
    }
    expect(detail.versions[0].items).toHaveLength(8)
    expect(fake.store.items.size).toBe(8)
  })

  it("same product may belong to multiple different plans", async () => {
    const a = await createPlan({ name: "Plan A", planType: "MONTHLY", currency: "INR", basePrice: 100 }, "a")
    const b = await createPlan({ name: "Plan B", planType: "MONTHLY", currency: "INR", basePrice: 200 }, "a")
    await addPlanItem(a.version.id, { itemType: "PRODUCT", itemRefId: "school_saas" }, "a")
    await addPlanItem(b.version.id, { itemType: "PRODUCT", itemRefId: "school_saas" }, "a")
    expect(fake.store.items.size).toBe(2)
  })
})
