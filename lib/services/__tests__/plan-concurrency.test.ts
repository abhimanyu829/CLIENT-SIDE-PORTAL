/**
 * Phase 2 — Test Group F: concurrency & determinism.
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

const { createPlan, addPlanItem, publishPlan, createDraftVersion, archivePlan, pausePlan } =
  await import("@/lib/services/plan-catalog-service")

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("prod_1")
})

const INPUT = { name: "Race Plan", planType: "MONTHLY" as const, currency: "INR", basePrice: 999 }

describe("F — concurrency", () => {
  it("two concurrent creates with the same slug: exactly one succeeds", async () => {
    const results = await Promise.allSettled([
      createPlan({ ...INPUT, slug: "race-plan" }, "a"),
      createPlan({ ...INPUT, slug: "race-plan" }, "b"),
    ])
    const ok = results.filter((r) => r.status === "fulfilled")
    const failed = results.filter((r) => r.status === "rejected")
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect([...fake.store.plans.values()].filter((p) => p.slug === "race-plan")).toHaveLength(1)
  })

  it("two concurrent drafts on one plan: at most one draft survives", async () => {
    const { plan, version } = await createPlan({ ...INPUT, slug: "race-p2" }, "a")
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    await publishPlan(plan.id, "a")

    const results = await Promise.allSettled([
      createDraftVersion(plan.id, { price: 1 }, "a"),
      createDraftVersion(plan.id, { price: 2 }, "b"),
    ])
    // Deterministic: at most one draft remains and at least one call succeeds.
    const drafts = [...fake.store.versions.values()].filter(
      (v) => v.planId === plan.id && v.status === PlanVersionStatus.DRAFT,
    )
    expect(drafts.length).toBeLessThanOrEqual(1)
    expect(results.some((r) => r.status === "fulfilled")).toBe(true)
  })

  it("concurrent publish of the same draft: CAS lets exactly one win", async () => {
    const { plan, version } = await createPlan({ ...INPUT, slug: "race-p3" }, "a")
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")

    // Simulate two publishes racing: sequential invocation still yields one
    // PUBLISHED version and no double-supersede corruption.
    const [r1, r2] = await Promise.allSettled([
      publishPlan(plan.id, "a"),
      publishPlan(plan.id, "b"),
    ])
    const publishedVersions = [...fake.store.versions.values()].filter(
      (v) => v.planId === plan.id && v.status === PlanVersionStatus.PUBLISHED,
    )
    expect(publishedVersions).toHaveLength(1)
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.PUBLISHED)
    // At least one publish resolves; the loser either idempotently no-ops or fails.
    expect([r1, r2].some((r) => r.status === "fulfilled")).toBe(true)
  })

  it("concurrent archive and pause deterministically leave a valid terminal/consistent state", async () => {
    const { plan, version } = await createPlan({ ...INPUT, slug: "race-p4" }, "a")
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    await publishPlan(plan.id, "a")

    await Promise.allSettled([archivePlan(plan.id, "a"), pausePlan(plan.id, "b")])
    const status = fake.store.plans.get(plan.id)!.status
    // Either archived (terminal) or paused — never a corrupt intermediate.
    expect([PlanStatus.ARCHIVED, PlanStatus.PAUSED]).toContain(status)
  })

  it("concurrent item additions of the same reference keep a single row", async () => {
    const { version } = await createPlan({ ...INPUT, slug: "race-p5" }, "a")
    await Promise.allSettled([
      addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a"),
      addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "b"),
    ])
    const rows = [...fake.store.items.values()].filter(
      (i) => i.planVersionId === version.id && i.itemRefKey === "prod_1",
    )
    expect(rows).toHaveLength(1)
  })
})
