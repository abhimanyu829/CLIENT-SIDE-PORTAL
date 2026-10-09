/**
 * Phase 4 — Test Group A: internal plan → Razorpay plan mapping.
 * Provider mocked; no real Razorpay call ever runs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlanMappingStatus } from "@prisma/client"
import { createFakeRzpDb, type FakeRzpDb } from "./helpers/fake-razorpay-db"
import { RazorpayBillingError } from "@/lib/services/razorpay-billing"

let fake: FakeRzpDb
let rzp: ReturnType<typeof vitestRzpMock>

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
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => true),
  invalidateCache: vi.fn(async () => undefined),
  CACHE_KEYS: {},
}))
vi.mock("@/lib/redis", () => ({ redis: null }))
vi.mock("@/lib/env", () => ({
  env: {
    RAZORPAY_KEY_SECRET: "rzp_key_secret_test",
    RAZORPAY_WEBHOOK_SECRET: "rzp_webhook_secret_test",
    RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET: undefined,
  },
}))
vi.mock("@/lib/razorpay", () => {
  const provider = {
    planCreate: vi.fn(async () => ({ id: "plan_test_abc" })),
    subscriptionCreate: vi.fn(async () => ({ id: "sub_test_abc" })),
    subscriptionCancel: vi.fn(async () => ({ id: "sub_test_abc", status: "cancelled" })),
    subscriptionPause: vi.fn(async () => ({ id: "sub_test_abc", status: "paused" })),
    subscriptionResume: vi.fn(async () => ({ id: "sub_test_abc", status: "active" })),
    noClient: false,
  }
  return {
    __provider: provider,
    getRazorpay: () =>
      provider.noClient
        ? null
        : {
            plans: { create: provider.planCreate },
            subscriptions: {
              create: provider.subscriptionCreate,
              cancel: provider.subscriptionCancel,
              pause: provider.subscriptionPause,
              resume: provider.subscriptionResume,
            },
          },
    razorpay: {},
  }
})

import * as dbModule from "@/lib/db"
import * as rzpModule from "@/lib/razorpay"

const { ensureRazorpayPlanMapping } = await import("@/lib/services/razorpay-billing")

function vitestRzpMock() {
  return rzpModule as unknown as {
    __provider: {
      planCreate: ReturnType<typeof vi.fn>
      subscriptionCreate: ReturnType<typeof vi.fn>
      subscriptionCancel: ReturnType<typeof vi.fn>
      subscriptionPause: ReturnType<typeof vi.fn>
      subscriptionResume: ReturnType<typeof vi.fn>
      noClient: boolean
    }
  }
}

beforeEach(() => {
  fake = createFakeRzpDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  rzp = vitestRzpMock()
  rzp.__provider.planCreate.mockClear()
  rzp.__provider.noClient = false
  rzp.__provider.planCreate.mockResolvedValue({ id: "plan_test_abc" })
  fake.seedPlan({ id: "plan_1" })
  fake.seedVersion({ id: "ver_1", planId: "plan_1" })
})

describe("A1-A2 eligible mapping", () => {
  it("maps a valid published paid plan version", async () => {
    const result = await ensureRazorpayPlanMapping("ver_1")
    expect(result.razorpayPlanId).toBe("plan_test_abc")
    expect(result.amountSubunits).toBe(99900)
    expect(result.currency).toBe("INR")
    expect(result.billingPeriod).toBe("monthly")
    expect(result.billingInterval).toBe(1)
    expect(result.mappingStatus).toBe(PlanMappingStatus.ACTIVE)
    expect(result.existing).toBe(false)
    expect(rzp.__provider.planCreate).toHaveBeenCalledWith(
      expect.objectContaining({ period: "monthly", interval: 1 }),
    )
    expect(fake.store.mappings.size).toBe(1)
  })

  it("reuses an existing ACTIVE mapping without creating a second provider plan", async () => {
    fake.seedMapping({ id: "map_1", planVersionId: "ver_1" })
    const result = await ensureRazorpayPlanMapping("ver_1")
    expect(result.existing).toBe(true)
    expect(rzp.__provider.planCreate).not.toHaveBeenCalled()
  })
})

describe("A2-A5 ineligible plans", () => {
  it("rejects a DRAFT plan version", async () => {
    fake.seedVersion({ id: "ver_draft", planId: "plan_1", status: "DRAFT" })
    await expect(ensureRazorpayPlanMapping("ver_draft")).rejects.toThrow(/Only published plan versions are billable/i)
  })

  it("rejects an unpublished/archived plan", async () => {
    fake.seedPlan({ id: "plan_arch" }, { status: "ARCHIVED" })
    fake.seedVersion({ id: "ver_arch", planId: "plan_arch" })
    await expect(ensureRazorpayPlanMapping("ver_arch")).rejects.toThrow(RazorpayBillingError)
  })

  it("rejects FREE plans for recurring billing", async () => {
    fake.seedPlan({ id: "plan_free" }, { planType: "FREE" })
    fake.seedVersion({ id: "ver_free", planId: "plan_free" })
    await expect(ensureRazorpayPlanMapping("ver_free")).rejects.toThrow(/FREE plans cannot be mapped/i)
    expect(rzp.__provider.planCreate).not.toHaveBeenCalled()
  })

  it("rejects zero-price plans", async () => {
    fake.seedVersion({ id: "ver_zero", planId: "plan_1", price: 0 })
    await expect(ensureRazorpayPlanMapping("ver_zero")).rejects.toThrow(/positive price/i)
  })

  it("rejects unknown plan version", async () => {
    await expect(ensureRazorpayPlanMapping("ver_missing")).rejects.toThrow(/Unknown plan version/i)
  })
})

describe("A6-A9 currency, amount, interval", () => {
  it("converts INR to paise subunits and rejects unsupported currencies", async () => {
    const { toAmountSubunits } = await import("@/lib/services/razorpay-billing")
    expect(toAmountSubunits(499, "INR")).toBe(49900)
    expect(toAmountSubunits(9.99, "USD")).toBe(999)
    expect(() => toAmountSubunits(100, "BTC")).toThrow(RazorpayBillingError)
    expect(() => toAmountSubunits(-1, "INR")).toThrow(RazorpayBillingError)
    expect(() => toAmountSubunits(0, "INR")).toThrow(RazorpayBillingError)
  })

  it("maps 1/3/6-month intervals and rejects unsupported ones", async () => {
    const { mapBillingInterval } = await import("@/lib/services/razorpay-billing")
    expect(mapBillingInterval(1, "MONTHLY" as never)).toEqual({ period: "monthly", interval: 1 })
    expect(mapBillingInterval(3, "THREE_MONTH" as never)).toEqual({ period: "monthly", interval: 3 })
    expect(mapBillingInterval(6, "SIX_MONTH" as never)).toEqual({ period: "monthly", interval: 6 })
    expect(() => mapBillingInterval(2, "MONTHLY" as never)).toThrow(RazorpayBillingError)
    expect(() => mapBillingInterval(null, "MONTHLY" as never)).toThrow(RazorpayBillingError)
  })

  it("a three-month plan is never silently reduced to monthly", async () => {
    fake.seedVersion({ id: "ver_3m", planId: "plan_1", billingIntervalMonths: 3, durationMonths: 6 })
    const result = await ensureRazorpayPlanMapping("ver_3m")
    expect(result.billingInterval).toBe(3)
    expect(result.totalCount).toBe(2)
  })

  it("computes finite total_count and leaves indefinite contracts indefinite", async () => {
    const { computeTotalCount } = await import("@/lib/services/razorpay-billing")
    expect(computeTotalCount("SIX_MONTH" as never, 12, 6)).toBe(2)
    expect(computeTotalCount("MONTHLY" as never, null, 1)).toBeNull()
    expect(computeTotalCount("MONTHLY" as never, 0, 1)).toBe(0)
    expect(() => computeTotalCount("MONTHLY" as never, 10, 3)).toThrow(/exact multiple/i)
    expect(() => computeTotalCount("MONTHLY" as never, 6, null)).toThrow(/missing its billing interval/i)
  })
})

describe("A11-A14 mapping protection", () => {
  it("marks timeout with uncertain remote result and refuses to duplicate", async () => {
    rzp.__provider.planCreate.mockRejectedValue(new Error("request timed out after 15000ms"))
    await expect(ensureRazorpayPlanMapping("ver_1")).rejects.toThrow(RazorpayBillingError)
    // No mapping row, no second attempt.
    expect(fake.store.mappings.size).toBe(0)
    expect(rzp.__provider.planCreate).toHaveBeenCalledTimes(1)
  })

  it("persistence failure after remote create raises reconciliation, never a silent duplicate", async () => {
    fake.failures.failMappingPersistence = true
    await expect(ensureRazorpayPlanMapping("ver_1")).rejects.toThrow(/could not be persisted/i)
    expect(rzp.__provider.planCreate).toHaveBeenCalledTimes(1)
    expect(fake.store.mappings.size).toBe(0)
  })

  it("treats an existing NEEDS_RECONCILIATION mapping as unavailable until resolved", async () => {
    fake.seedMapping({ id: "map_r", planVersionId: "ver_1", mappingStatus: "NEEDS_RECONCILIATION" })
    await expect(ensureRazorpayPlanMapping("ver_1")).rejects.toThrow(/needs reconciliation/i)
    expect(rzp.__provider.planCreate).not.toHaveBeenCalled()
  })

  it("environment mismatch: mapping lookup is environment-scoped", async () => {
    fake.seedMapping({ id: "map_live", planVersionId: "ver_1", environment: "production" })
    // Running under NODE_ENV=test → environment "test"; no mapping exists → creates one.
    const result = await ensureRazorpayPlanMapping("ver_1")
    expect(result.environment).toBe("test")
    expect(rzp.__provider.planCreate).toHaveBeenCalledTimes(1)
  })
})
