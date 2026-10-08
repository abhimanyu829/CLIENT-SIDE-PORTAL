/**
 * Phase 2 — Plan lifecycle & pure validation (no DB).
 */
import { describe, expect, it } from "vitest"
import { PlanItemType, PlanStatus, PlanType, PlanVersionStatus } from "@prisma/client"
import {
  PLAN_CURRENCIES,
  PLAN_ITEM_TYPES,
  PLAN_TYPES,
  PLAN_TYPE_BILLING_MONTHS,
  PLAN_TYPE_DURATION_MONTHS,
  PlanTransitionError,
  PlanValidationError,
  assertPlanTransition,
  assertValidPlanSlug,
  assertVersionTransition,
  canTransitionPlanStatus,
  canTransitionVersionStatus,
  isEditableVersionStatus,
  isPlanCurrency,
  isPlanItemType,
  isPlanType,
  isReferentialItemType,
  isSingletonItemType,
  isTerminalPlanStatus,
  planRequiresItems,
  planRequiresPaidPricing,
  slugifyPlanName,
} from "@/lib/services/plan-lifecycle"

const ALL_PLAN_STATUSES: PlanStatus[] = [
  PlanStatus.DRAFT,
  PlanStatus.PUBLISHED,
  PlanStatus.PAUSED,
  PlanStatus.ARCHIVED,
]

describe("plan status machine", () => {
  it("allows the documented legal transitions", () => {
    const legal: Array<[PlanStatus, PlanStatus]> = [
      [PlanStatus.DRAFT, PlanStatus.PUBLISHED],
      [PlanStatus.DRAFT, PlanStatus.ARCHIVED],
      [PlanStatus.PUBLISHED, PlanStatus.PAUSED],
      [PlanStatus.PUBLISHED, PlanStatus.ARCHIVED],
      [PlanStatus.PAUSED, PlanStatus.PUBLISHED],
      [PlanStatus.PAUSED, PlanStatus.ARCHIVED],
    ]
    for (const [from, to] of legal) {
      expect(canTransitionPlanStatus(from, to), `${from} -> ${to}`).toBe(true)
    }
  })

  it("rejects illegal transitions", () => {
    const illegal: Array<[PlanStatus, PlanStatus]> = [
      [PlanStatus.DRAFT, PlanStatus.PAUSED],
      [PlanStatus.ARCHIVED, PlanStatus.DRAFT],
      [PlanStatus.ARCHIVED, PlanStatus.PUBLISHED],
      [PlanStatus.ARCHIVED, PlanStatus.PAUSED],
    ]
    for (const [from, to] of illegal) {
      expect(canTransitionPlanStatus(from, to), `${from} -> ${to}`).toBe(false)
    }
  })

  it("treats same-state as idempotent and ARCHIVED as terminal", () => {
    for (const s of ALL_PLAN_STATUSES) {
      expect(canTransitionPlanStatus(s, s)).toBe(true)
    }
    expect(isTerminalPlanStatus(PlanStatus.ARCHIVED)).toBe(true)
    for (const s of ALL_PLAN_STATUSES.filter((x) => x !== PlanStatus.ARCHIVED)) {
      expect(isTerminalPlanStatus(s)).toBe(false)
    }
  })

  it("throws typed errors from assertPlanTransition", () => {
    expect(() => assertPlanTransition(PlanStatus.ARCHIVED, PlanStatus.PUBLISHED)).toThrow(
      PlanTransitionError,
    )
    try {
      assertPlanTransition(PlanStatus.ARCHIVED, PlanStatus.PUBLISHED)
    } catch (e) {
      const err = e as PlanTransitionError
      expect(err.code).toBe("INVALID_PLAN_TRANSITION")
      expect(err.from).toBe("ARCHIVED")
      expect(err.to).toBe("PUBLISHED")
    }
  })
})

describe("version status machine", () => {
  it("allows DRAFT -> PUBLISHED, DRAFT -> ARCHIVED, PUBLISHED -> ARCHIVED only", () => {
    expect(canTransitionVersionStatus(PlanVersionStatus.DRAFT, PlanVersionStatus.PUBLISHED)).toBe(true)
    expect(canTransitionVersionStatus(PlanVersionStatus.DRAFT, PlanVersionStatus.ARCHIVED)).toBe(true)
    expect(canTransitionVersionStatus(PlanVersionStatus.PUBLISHED, PlanVersionStatus.ARCHIVED)).toBe(true)
    expect(canTransitionVersionStatus(PlanVersionStatus.PUBLISHED, PlanVersionStatus.DRAFT)).toBe(false)
    expect(canTransitionVersionStatus(PlanVersionStatus.ARCHIVED, PlanVersionStatus.PUBLISHED)).toBe(false)
    expect(canTransitionVersionStatus(PlanVersionStatus.ARCHIVED, PlanVersionStatus.DRAFT)).toBe(false)
  })

  it("marks only DRAFT as editable", () => {
    expect(isEditableVersionStatus(PlanVersionStatus.DRAFT)).toBe(true)
    expect(isEditableVersionStatus(PlanVersionStatus.PUBLISHED)).toBe(false)
    expect(isEditableVersionStatus(PlanVersionStatus.ARCHIVED)).toBe(false)
  })

  it("assertVersionTransition throws for published-version edits", () => {
    expect(() =>
      assertVersionTransition(PlanVersionStatus.PUBLISHED, PlanVersionStatus.DRAFT),
    ).toThrow(PlanTransitionError)
  })
})

describe("plan types, durations and billing intervals", () => {
  it("supports the required plan types", () => {
    for (const t of ["FREE", "MONTHLY", "THREE_MONTH", "SIX_MONTH"]) {
      expect(PLAN_TYPES).toContain(t)
      expect(isPlanType(t)).toBe(true)
    }
    expect(isPlanType("WEEKLY")).toBe(false)
  })

  it("maps commercial duration and billing interval", () => {
    expect(PLAN_TYPE_DURATION_MONTHS.MONTHLY).toBe(1)
    expect(PLAN_TYPE_DURATION_MONTHS.THREE_MONTH).toBe(3)
    expect(PLAN_TYPE_DURATION_MONTHS.SIX_MONTH).toBe(6)
    expect(PLAN_TYPE_DURATION_MONTHS.FREE).toBe(0)
    expect(PLAN_TYPE_BILLING_MONTHS.MONTHLY).toBe(1)
    expect(PLAN_TYPE_BILLING_MONTHS.THREE_MONTH).toBe(3)
  })

  it("FREE needs neither paid pricing nor items; paid plans need both", () => {
    expect(planRequiresPaidPricing(PlanType.FREE)).toBe(false)
    expect(planRequiresItems(PlanType.FREE)).toBe(false)
    expect(planRequiresPaidPricing(PlanType.MONTHLY)).toBe(true)
    expect(planRequiresItems(PlanType.SIX_MONTH)).toBe(true)
  })
})

describe("currencies, slug and item types", () => {
  it("accepts the controlled currency set including INR", () => {
    expect(PLAN_CURRENCIES).toContain("INR")
    for (const c of PLAN_CURRENCIES) expect(isPlanCurrency(c)).toBe(true)
    for (const bad of ["inr", "rupees", "", null, 1]) {
      expect(isPlanCurrency(bad)).toBe(false)
    }
  })

  it("validates slugs and slugifies display names", () => {
    expect(() => assertValidPlanSlug("launch-monthly")).not.toThrow()
    expect(() => assertValidPlanSlug("growth-3-month")).not.toThrow()
    for (const bad of ["Launch Monthly", "ab", "x--y", "-lead", "trail-", ""]) {
      expect(() => assertValidPlanSlug(bad)).toThrow(PlanValidationError)
    }
    expect(slugifyPlanName("Growth Plan")).toBe("growth-plan")
    expect(slugifyPlanName("  Scale   6 Month!! ")).toBe("scale-6-month")
  })

  it("classifies item types", () => {
    for (const t of PLAN_ITEM_TYPES) expect(isPlanItemType(t)).toBe(true)
    expect(isPlanItemType("COUPON")).toBe(false)
    expect(isReferentialItemType(PlanItemType.PRODUCT)).toBe(true)
    expect(isReferentialItemType(PlanItemType.SERVICE)).toBe(true)
    expect(isReferentialItemType(PlanItemType.AI_CAPABILITY)).toBe(true)
    expect(isReferentialItemType(PlanItemType.STORAGE)).toBe(false)
    expect(isSingletonItemType(PlanItemType.STORAGE)).toBe(true)
    expect(isSingletonItemType(PlanItemType.ADMIN_LIMIT)).toBe(true)
    expect(isSingletonItemType(PlanItemType.PRODUCT)).toBe(false)
  })
})
