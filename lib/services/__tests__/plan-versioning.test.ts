/**
 * Phase 2 — Test Group D: versioning & immutability.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlanStatus, PlanVersionStatus } from "@prisma/client"
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

const { createPlan, addPlanItem, publishPlan, createDraftVersion, updateDraftVersion, getPlan } =
  await import("@/lib/services/plan-catalog-service")

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("prod_1")
  fake.seedProduct("prod_2")
})

async function publishedV1() {
  const { plan, version } = await createPlan(
    { name: "Growth", planType: "MONTHLY", currency: "INR", basePrice: 999 },
    "admin_1",
  )
  await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1")
  await publishPlan(plan.id, "admin_1")
  return { plan, v1: version }
}

describe("D — versioning & immutability", () => {
  it("V1 stays unchanged when V2 is created, edited and published", async () => {
    const { plan, v1 } = await publishedV1()

    const v2 = await createDraftVersion(plan.id, { price: 1499 }, "admin_1")
    expect(v2.version).toBe(2)
    await addPlanItem(v2.id, { itemType: "PRODUCT", itemRefId: "prod_2" }, "admin_1")
    await updateDraftVersion(v2.id, { price: 1599 }, "admin_1")

    // V1 still holds exactly its original single item and is PUBLISHED/immutable.
    const v1Row = fake.store.versions.get(v1.id)!
    expect(v1Row.status).toBe(PlanVersionStatus.PUBLISHED)
    const v1Items = [...fake.store.items.values()].filter((i) => i.planVersionId === v1.id)
    expect(v1Items).toHaveLength(1)
    expect(v1Items[0].itemRefId).toBe("prod_1")

    await publishPlan(plan.id, "admin_1")

    // After publishing V2: V2 is PUBLISHED, V1 superseded to ARCHIVED (kept), plan points to V2.
    const v1After = fake.store.versions.get(v1.id)!
    expect(v1After.status).toBe(PlanVersionStatus.ARCHIVED)
    const v2After = fake.store.versions.get(v2.id)!
    expect(v2After.status).toBe(PlanVersionStatus.PUBLISHED)
    expect(fake.store.plans.get(plan.id)!.currentVersionId).toBe(v2.id)
    // V1 items are untouched (immutability).
    const v1ItemsAfter = [...fake.store.items.values()].filter((i) => i.planVersionId === v1.id)
    expect(v1ItemsAfter).toHaveLength(1)
  })

  it("only one DRAFT version may exist at a time; publishing unblocks a new draft", async () => {
    const { plan } = await publishedV1()
    const v2 = await createDraftVersion(plan.id, { price: 1499 }, "admin_1")
    await expect(createDraftVersion(plan.id, { price: 1599 }, "admin_1")).rejects.toThrow(
      /already has a draft version/i,
    )
    await addPlanItem(v2.id, { itemType: "PRODUCT", itemRefId: "prod_2" }, "admin_1")
    await publishPlan(plan.id, "admin_1")
    const v3 = await createDraftVersion(plan.id, { price: 1799 }, "admin_1")
    expect(v3.version).toBe(3)
  })

  it("version numbers are deterministic and monotonic", async () => {
    const { plan } = await publishedV1()
    const v2 = await createDraftVersion(plan.id, {}, "admin_1")
    expect(v2.version).toBe(2)
    await addPlanItem(v2.id, { itemType: "PRODUCT", itemRefId: "prod_2" }, "admin_1")
    await publishPlan(plan.id, "admin_1")
    const v3 = await createDraftVersion(plan.id, {}, "admin_1")
    expect(v3.version).toBe(3)
  })

  it("published version detail is readable after plan archival", async () => {
    const { plan, v1 } = await publishedV1()
    const { archivePlan } = await import("@/lib/services/plan-catalog-service")
    await archivePlan(plan.id, "admin_1")
    const detail = (await getPlan(plan.id)) as unknown as { status: string; versions: Array<{ id: string }> }
    expect(detail.status).toBe(PlanStatus.ARCHIVED)
    expect(detail.versions.some((v) => v.id === v1.id)).toBe(true)
  })
})
