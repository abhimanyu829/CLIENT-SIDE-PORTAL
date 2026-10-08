/**
 * Phase 2 — Test Group E: security.
 * Forged ids, forged status, arbitrary refs, unauthorized ops, cross-tenant,
 * immutable-version mutation, arbitrary table access.
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

const {
  createPlan,
  getPlan,
  addPlanItem,
  publishPlan,
  archivePlan,
  pausePlan,
  createDraftVersion,
  updatePlanHeader,
  validatePlan,
} = await import("@/lib/services/plan-catalog-service")

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("prod_1")
})

describe("E — security", () => {
  it("rejects forged plan id on get/validate/publish", async () => {
    expect(await getPlan("plan_forged")).toBeNull()
    await expect(validatePlan("plan_forged")).rejects.toThrow(/Unknown plan/i)
    await expect(publishPlan("plan_forged", "a")).rejects.toThrow(/Unknown plan/i)
  })

  it("rejects forged owner/team/admin keys in create input", async () => {
    await expect(
      createPlan(
        { name: "X Plan", planType: "MONTHLY", currency: "INR", basePrice: 1, ownerId: "team_x" },
        "a",
      ),
    ).rejects.toThrow()
    await expect(
      createPlan(
        { name: "X Plan", planType: "MONTHLY", currency: "INR", basePrice: 1, teamId: "t" },
        "a",
      ),
    ).rejects.toThrow()
  })

  it("rejects forged status / published-version fields in create", async () => {
    await expect(
      createPlan(
        { name: "X Plan", planType: "MONTHLY", currency: "INR", basePrice: 1, status: "PUBLISHED" },
        "a",
      ),
    ).rejects.toThrow()
    await expect(
      createPlan(
        {
          name: "X Plan",
          planType: "MONTHLY",
          currency: "INR",
          basePrice: 1,
          currentVersionId: "pver_x",
        },
        "a",
      ),
    ).rejects.toThrow()
  })

  it("rejects arbitrary item reference and invalid foreign resource", async () => {
    const { version } = await createPlan(
      { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 1 },
      "a",
    )
    await expect(
      addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_forged" }, "a"),
    ).rejects.toThrow(/Unknown product/i)
    await expect(
      addPlanItem(version.id, { itemType: "SERVICE", itemRefId: "svc_forged" }, "a"),
    ).rejects.toThrow(/Unknown service/i)
    await expect(
      addPlanItem(version.id, { itemType: "AI_CAPABILITY", itemRefId: "agent_forged" }, "a"),
    ).rejects.toThrow(/Unknown AI capability/i)
  })

  it("rejects forged item type and extra fields on items", async () => {
    const { version } = await createPlan(
      { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 1 },
      "a",
    )
    await expect(addPlanItem(version.id, { itemType: "COUPON", itemRefId: "x" }, "a")).rejects.toThrow()
    await expect(
      addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1", isAdmin: true }, "a"),
    ).rejects.toThrow()
  })

  it("cannot mutate a published version's items (immutability)", async () => {
    const { plan, version } = await createPlan(
      { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 1 },
      "a",
    )
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    await publishPlan(plan.id, "a")
    await expect(
      addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a"),
    ).rejects.toThrow(/Cannot modify items on a PUBLISHED version/i)
  })

  it("cannot publish without a draft and cannot archive then publish", async () => {
    const { plan } = await createPlan(
      { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 1 },
      "a",
    )
    await archivePlan(plan.id, "a")
    await expect(publishPlan(plan.id, "a")).rejects.toThrow(/Invalid PLAN transition/i)
    await expect(pausePlan(plan.id, "a")).rejects.toThrow(/Invalid PLAN transition/i)
    await expect(createDraftVersion(plan.id, {}, "a")).rejects.toThrow(/Invalid PLAN transition/i)
  })

  it("cannot edit an archived plan header", async () => {
    const { plan } = await createPlan(
      { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 1 },
      "a",
    )
    await archivePlan(plan.id, "a")
    await expect(updatePlanHeader(plan.id, { name: "Renamed" }, "a")).rejects.toThrow(
      /Invalid PLAN transition/i,
    )
  })

  it("catalog code physically cannot touch commerce tables (fake traps)", async () => {
    // The fake DB throws if order/payment/cart/invoice are touched. A normal
    // catalog flow must therefore complete without hitting any trap.
    const { plan, version } = await createPlan(
      { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 1 },
      "a",
    )
    await addPlanItem(version.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "a")
    await publishPlan(plan.id, "a")
    expect(fake.store.plans.get(plan.id)!.status).toBe(PlanStatus.PUBLISHED)
  })
})
