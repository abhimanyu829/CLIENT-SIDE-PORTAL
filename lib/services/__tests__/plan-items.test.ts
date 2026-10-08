/**
 * Phase 2 — Test Group B: plan item composition (add/validate/remove).
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

const { createPlan, addPlanItem, removePlanItem } = await import(
  "@/lib/services/plan-catalog-service"
)

beforeEach(() => {
  fake = createFakePlanDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  fake.seedProduct("prod_1")
  fake.seedService("svc_1")
  fake.seedAgent("agent_1")
})

async function newDraftVersion() {
  const { version } = await createPlan(
    { name: "Plan", planType: "MONTHLY", currency: "INR", basePrice: 500 },
    "admin_1",
  )
  return version
}

describe("B — plan item composition", () => {
  it("adds a PRODUCT item by reference", async () => {
    const v = await newDraftVersion()
    const item = await addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1")
    expect(item.itemType).toBe(PlanItemType.PRODUCT)
    expect(item.itemRefId).toBe("prod_1")
    expect(item.itemRefKey).toBe("prod_1")
    expect(fake.store.auditLogs.some((a) => a.action === "PLAN_ITEM_ADDED")).toBe(true)
  })

  it("adds a SERVICE item by reference", async () => {
    const v = await newDraftVersion()
    const item = await addPlanItem(v.id, { itemType: "SERVICE", itemRefId: "svc_1" }, "admin_1")
    expect(item.itemRefId).toBe("svc_1")
  })

  it("adds an AI_CAPABILITY item by reference", async () => {
    const v = await newDraftVersion()
    const item = await addPlanItem(
      v.id,
      { itemType: "AI_CAPABILITY", itemRefId: "agent_1" },
      "admin_1",
    )
    expect(item.itemRefId).toBe("agent_1")
  })

  it("adds declared STORAGE / USER_LIMIT / ADMIN_LIMIT / SUPPORT items", async () => {
    const v = await newDraftVersion()
    const storage = await addPlanItem(
      v.id,
      { itemType: "STORAGE", limitValue: 5, limitUnit: "GB" },
      "admin_1",
    )
    expect(storage.limitValue).toBe(5)
    expect(storage.itemRefKey).toBe("storage")
    const users = await addPlanItem(
      v.id,
      { itemType: "USER_LIMIT", limitValue: 5, limitUnit: "users" },
      "admin_1",
    )
    expect(users.itemRefKey).toBe("user_limit")
    await addPlanItem(v.id, { itemType: "ADMIN_LIMIT", limitValue: 2 }, "admin_1")
    const support = await addPlanItem(
      v.id,
      { itemType: "SUPPORT", itemRefKey: "standard", label: "Standard support" },
      "admin_1",
    )
    expect(support.itemRefKey).toBe("standard")
  })

  it("rejects an invalid referenced resource", async () => {
    const v = await newDraftVersion()
    await expect(
      addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_missing" }, "admin_1"),
    ).rejects.toThrow(/Unknown product/i)
    await expect(
      addPlanItem(v.id, { itemType: "SERVICE", itemRefId: "svc_missing" }, "admin_1"),
    ).rejects.toThrow(/Unknown service/i)
  })

  it("rejects missing reference for referential types and stray id for declared types", async () => {
    const v = await newDraftVersion()
    await expect(addPlanItem(v.id, { itemType: "PRODUCT" }, "admin_1")).rejects.toThrow(
      /require itemRefId/i,
    )
    await expect(
      addPlanItem(v.id, { itemType: "STORAGE", itemRefId: "prod_1" }, "admin_1"),
    ).rejects.toThrow(/must not carry a resource id/i)
  })

  it("rejects duplicate PRODUCT reference and duplicate singleton limits", async () => {
    const v = await newDraftVersion()
    await addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1")
    await expect(
      addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1"),
    ).rejects.toThrow(/Duplicate plan item/i)
    await addPlanItem(v.id, { itemType: "STORAGE", limitValue: 5 }, "admin_1")
    await expect(
      addPlanItem(v.id, { itemType: "STORAGE", limitValue: 9 }, "admin_1"),
    ).rejects.toThrow(/already exists/i)
  })

  it("rejects invalid quantity and negative limit", async () => {
    const v = await newDraftVersion()
    await expect(
      addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_1", quantity: 0 }, "admin_1"),
    ).rejects.toThrow()
    await expect(
      addPlanItem(v.id, { itemType: "STORAGE", limitValue: -1 }, "admin_1"),
    ).rejects.toThrow()
  })

  it("removes a draft item", async () => {
    const v = await newDraftVersion()
    const item = await addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1")
    const result = await removePlanItem(item.id, "admin_1")
    expect(result.removed).toBe(true)
    expect(fake.store.items.size).toBe(0)
  })

  it("allows several distinct PRODUCT items in one version", async () => {
    fake.seedProduct("prod_2")
    const v = await newDraftVersion()
    await addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_1" }, "admin_1")
    await addPlanItem(v.id, { itemType: "PRODUCT", itemRefId: "prod_2" }, "admin_1")
    expect(fake.store.items.size).toBe(2)
  })
})
