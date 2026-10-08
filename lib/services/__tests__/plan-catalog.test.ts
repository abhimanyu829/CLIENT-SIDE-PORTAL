/**
 * Phase 2 — Test Group A: plan unit tests (create, validate, lifecycle,
 * retrieval, listing, ordering).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlanStatus, PlanType, PlanVersionStatus } from "@prisma/client"
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

const {
  createPlan,
  getPlan,
  listPlans,
  updatePlanHeader,
  createDraftVersion,
  addPlanItem,
  validatePlan,
  publishPlan,
  pausePlan,
  resumePlan,
  archivePlan,
} = await import("@/lib/services/plan-catalog-service")
const { PlanValidationError } = await import("@/lib/services/plan-lifecycle")

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("prod_1")
  fake.seedProduct("prod_2")
  fake.seedService("svc_1")
  fake.seedAgent("agent_1")
})

const MONTHLY = {
  name: "Launch Monthly",
  planType: "MONTHLY" as const,
  currency: "INR",
  basePrice: 999,
}

async function makePublishedPlan(name = "Launch Monthly", slug = "launch-monthly") {
  const { plan, version } = await createPlan(
    { name, slug, planType: "MONTHLY", currency: "INR", basePrice: 999 },
    "admin_1",
  )
  await addPlanItem(
    version.id,
    { itemType: "PRODUCT", itemRefId: "prod_1" },
    "admin_1",
  )
  const published = await publishPlan(plan.id, "admin_1")
  return { plan: published.plan, version: published.version }
}

describe("A1-A6 create plan", () => {
  it("creates a DRAFT plan with an initial DRAFT version", async () => {
    const { plan, version } = await createPlan(MONTHLY, "admin_1")
    expect(plan.status).toBe(PlanStatus.DRAFT)
    expect(plan.planType).toBe(PlanType.MONTHLY)
    expect(plan.slug).toBe("launch-monthly")
    expect(plan.currency).toBe("INR")
    expect(version.version).toBe(1)
    expect(version.status).toBe(PlanVersionStatus.DRAFT)
    expect(fake.store.auditLogs.some((a) => a.action === "PLAN_CREATED")).toBe(true)
  })

  it("derives a slug from the name when omitted", async () => {
    const { plan } = await createPlan(
      { name: "Growth Plan", planType: "THREE_MONTH", currency: "INR", basePrice: 2999 },
      "admin_1",
    )
    expect(plan.slug).toBe("growth-plan")
  })

  it("rejects duplicate slug", async () => {
    await createPlan(MONTHLY, "admin_1")
    await expect(createPlan(MONTHLY, "admin_1")).rejects.toThrow(/slug already exists/i)
    expect(fake.store.plans.size).toBe(1)
  })

  it("rejects invalid plan type", async () => {
    await expect(
      createPlan({ ...MONTHLY, planType: "WEEKLY" }, "admin_1"),
    ).rejects.toThrow(PlanValidationError)
  })

  it("rejects invalid currency", async () => {
    await expect(createPlan({ ...MONTHLY, currency: "RUPEES" }, "admin_1")).rejects.toThrow(
      PlanValidationError,
    )
  })

  it("rejects invalid/negative price and FREE with nonzero price", async () => {
    await expect(createPlan({ ...MONTHLY, basePrice: -1 }, "admin_1")).rejects.toThrow()
    await expect(
      createPlan({ name: "Free Tier", planType: "FREE", currency: "INR", basePrice: 500 }, "a"),
    ).rejects.toThrow(/FREE plans must have a zero base price/i)
  })

  it("rejects unknown keys (strict schema) and forged status", async () => {
    await expect(createPlan({ ...MONTHLY, status: "PUBLISHED" }, "admin_1")).rejects.toThrow()
    await expect(createPlan({ ...MONTHLY, hacked: true }, "admin_1")).rejects.toThrow()
  })

  it("creates a valid FREE plan with zero price", async () => {
    const { plan } = await createPlan(
      { name: "Free Plan", planType: "FREE", currency: "INR", basePrice: 0 },
      "admin_1",
    )
    expect(plan.planType).toBe(PlanType.FREE)
    expect(Number(plan.price)).toBe(0)
  })
})

describe("A7-A8 draft editing", () => {
  it("edits draft plan header and bumps catalog revision", async () => {
    const { plan } = await createPlan(MONTHLY, "admin_1")
    const updated = await updatePlanHeader(plan.id, { name: "Launch Monthly Pro" }, "admin_1")
    expect(updated.name).toBe("Launch Monthly Pro")
    expect(updated.slug).toBe("launch-monthly") // identity stable
    expect(Number(updated.catalogRevision)).toBe(1)
  })
})

describe("A9-A11 publish validation", () => {
  it("validatePlan reports missing items for a paid plan", async () => {
    const { plan } = await createPlan(MONTHLY, "admin_1")
    const result = await validatePlan(plan.id)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.field === "items")).toBe(true)
  })

  it("publishes a valid plan with an item", async () => {
    const { plan, version } = await makePublishedPlan()
    expect(plan.status).toBe(PlanStatus.PUBLISHED)
    expect(plan.currentVersionId).toBe(version.id)
    expect(version.status).toBe(PlanVersionStatus.PUBLISHED)
    expect(version.publishedAt).toBeInstanceOf(Date)
  })

  it("refuses to publish an invalid plan (no items)", async () => {
    const { plan } = await createPlan(MONTHLY, "admin_1")
    await expect(publishPlan(plan.id, "admin_1")).rejects.toThrow(/failed validation/i)
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.DRAFT)
  })

  it("allows a FREE plan with zero items to publish", async () => {
    const { plan } = await createPlan(
      { name: "Free Plan", planType: "FREE", currency: "INR", basePrice: 0 },
      "admin_1",
    )
    const result = await publishPlan(plan.id, "admin_1")
    expect(result.plan.status).toBe(PlanStatus.PUBLISHED)
  })
})

describe("A12-A14 lifecycle", () => {
  it("pause then resume a published plan", async () => {
    const { plan } = await makePublishedPlan()
    await pausePlan(plan.id, "admin_1")
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.PAUSED)
    await resumePlan(plan.id, "admin_1")
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.PUBLISHED)
  })

  it("archive a plan (terminal) without deleting versions/items", async () => {
    const { plan } = await makePublishedPlan()
    const before = { versions: fake.store.versions.size, items: fake.store.items.size }
    await archivePlan(plan.id, "admin_1")
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.ARCHIVED)
    expect(fake.store.versions.size).toBe(before.versions)
    expect(fake.store.items.size).toBe(before.items)
  })

  it("rejects invalid lifecycle transitions", async () => {
    const { plan } = await makePublishedPlan()
    // DRAFT-only op on a published plan: updatePlanHeader is allowed, but
    // resume on PUBLISHED is a same-state no-op; archive twice is the real test.
    await archivePlan(plan.id, "admin_1")
    await expect(pausePlan(plan.id, "admin_1")).rejects.toThrow(/Invalid PLAN transition/i)
    await expect(publishPlan(plan.id, "admin_1")).rejects.toThrow(/Invalid PLAN transition/i)
  })
})

describe("A15-A16 version creation & immutability", () => {
  it("creates V2 draft after publishing V1; refuses a second concurrent draft", async () => {
    const { plan } = await makePublishedPlan()
    const v2 = await createDraftVersion(plan.id, { price: 1499 }, "admin_1")
    expect(v2.version).toBe(2)
    await expect(createDraftVersion(plan.id, { price: 1999 }, "admin_1")).rejects.toThrow(
      /already has a draft version/i,
    )
  })

  it("rejects editing a published version", async () => {
    const { plan, version } = await makePublishedPlan()
    const { updateDraftVersion, addPlanItem: addItem, removePlanItem } = await import(
      "@/lib/services/plan-catalog-service"
    )
    await expect(updateDraftVersion(version.id, { price: 1 }, "admin_1")).rejects.toThrow(
      /only DRAFT versions are editable/i,
    )
    await expect(
      addItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_2" }, "admin_1"),
    ).rejects.toThrow(/Cannot modify items on a PUBLISHED version/i)
    // Remove: add an item to a draft, publish, then attempt removal.
    const v2 = await createDraftVersion(plan.id, {}, "admin_1")
    const item = await addItem(v2.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1")
    await publishPlan(plan.id, "admin_1")
    await expect(removePlanItem(item.id, "admin_1")).rejects.toThrow(
      /Cannot remove items from a PUBLISHED version/i,
    )
  })
})

describe("A17-A19 retrieval, listing, deterministic ordering", () => {
  it("gets a plan by id and by slug", async () => {
    const { plan } = await createPlan(MONTHLY, "admin_1")
    expect((await getPlan(plan.id))?.id).toBe(plan.id)
    expect((await getPlan("launch-monthly"))?.id).toBe(plan.id)
    expect(await getPlan("missing")).toBeNull()
    expect(await getPlan("")).toBeNull()
  })

  it("lists plans filtered by status/type in deterministic order", async () => {
    await createPlan({ name: "B Plan", planType: "MONTHLY", currency: "INR", basePrice: 100, sortOrder: 2 }, "a")
    await createPlan({ name: "A Plan", planType: "MONTHLY", currency: "INR", basePrice: 100, sortOrder: 1 }, "a")
    await createPlan(
      { name: "Free Plan", planType: "FREE", currency: "INR", basePrice: 0, sortOrder: 0 },
      "a",
    )
    const all = (await listPlans()) as Array<{ name: string }>
    expect(all.map((p) => p.name)).toEqual(["Free Plan", "A Plan", "B Plan"])
    const free = (await listPlans({ planType: PlanType.FREE })) as unknown[]
    expect(free).toHaveLength(1)
    const drafts = (await listPlans({ status: PlanStatus.DRAFT })) as unknown[]
    expect(drafts).toHaveLength(3)
  })
})
