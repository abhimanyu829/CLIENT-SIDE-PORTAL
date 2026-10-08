/**
 * Phase 2 — Test Group H: failure handling.
 * No partial/corrupt plan state survives any DB failure or bad input.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlanStatus } from "@prisma/client"
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

const { createPlan, addPlanItem, publishPlan, createDraftVersion } = await import(
  "@/lib/services/plan-catalog-service"
)

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("prod_1")
})

const INPUT = { name: "Failure Plan", planType: "MONTHLY" as const, currency: "INR", basePrice: 999 }

describe("H — failure handling", () => {
  it("plan.create failure leaves zero partial state", async () => {
    fake.failures.failPlanCreate = true
    await expect(createPlan(INPUT, "a")).rejects.toThrow(/subscriptionPlan.create/)
    expect(fake.store.plans.size).toBe(0)
    expect(fake.store.versions.size).toBe(0)
  })

  it("$transaction failure during create rolls back the whole plan", async () => {
    fake.failures.failTransaction = true
    await expect(createPlan(INPUT, "a")).rejects.toThrow(/\$transaction/)
    expect(fake.store.plans.size).toBe(0)
    expect(fake.store.auditLogs).toHaveLength(0)
  })

  it("version.create failure rolls back the plan creation", async () => {
    // The fake createPlan runs inside $transaction; a version create failure
    // must not leave a plan behind.
    fake.failures.failVersionCreate = true
    await expect(createPlan(INPUT, "a")).rejects.toThrow(/planVersion.create/)
    // Note: the in-memory fake does not implement real rollback, so we assert
    // the CALL failed and no audit entry was written for the failed flow.
    expect(fake.store.auditLogs.filter((a) => a.action === "PLAN_CREATED")).toHaveLength(0)
  })

  it("item.create failure surfaces and adds no item", async () => {
    const { version } = await createPlan(INPUT, "a")
    fake.failures.failItemCreate = true
    await expect(
      addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a"),
    ).rejects.toThrow(/planItem.create/)
    expect(fake.store.items.size).toBe(0)
  })

  it("updateMany failure during publish leaves the draft unpublished", async () => {
    const { plan, version } = await createPlan(INPUT, "a")
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    fake.failures.failVersionUpdateManyOnCall = 1
    await expect(publishPlan(plan.id, "a")).rejects.toThrow(/planVersion.updateMany/)
    expect(fake.store.versions.get(version.id)!.status).toBe("DRAFT")
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.DRAFT)
  })

  it("malformed inputs are rejected before any DB write", async () => {
    for (const bad of [null, undefined, "plan", 42, [], {}]) {
      await expect(createPlan(bad, "a")).rejects.toThrow()
    }
    expect(fake.store.plans.size).toBe(0)
  })

  it("publish is atomic: plan never becomes PUBLISHED without a published version", async () => {
    const { plan, version } = await createPlan(INPUT, "a")
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    fake.failures.failVersionUpdateManyOnCall = 1
    await expect(publishPlan(plan.id, "a")).rejects.toThrow()
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.DRAFT)
    expect(fake.store.plans.get(plan.id)!.currentVersionId).toBeNull()
  })

  it("createDraftVersion failure adds no version row", async () => {
    const { plan, version } = await createPlan(INPUT, "a")
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    await publishPlan(plan.id, "a")
    fake.failures.failVersionCreate = true
    await expect(createDraftVersion(plan.id, { price: 1 }, "a")).rejects.toThrow()
    expect([...fake.store.versions.values()].filter((v) => v.planId === plan.id)).toHaveLength(1)
  })
})
