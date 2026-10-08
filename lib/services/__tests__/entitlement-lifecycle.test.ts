/**
 * Phase 3 — Entitlement lifecycle (pure, no DB) + vocabularies + contracts.
 */
import { describe, expect, it } from "vitest"
import {
  EntitlementScope,
  EntitlementSourceType,
  EntitlementSubjectType,
  EntitlementType,
  GrantStatus,
  PlanItemType,
} from "@prisma/client"
import {
  ENTITLEMENT_SCOPES,
  ENTITLEMENT_SOURCE_TYPES,
  ENTITLEMENT_TYPES,
  EntitlementError,
  assertGrantStatusTransition,
  assertValidEntitlementKey,
  buildGrantDedupeKey,
  canTransitionGrantStatus,
  describePlanItemEntitlement,
  isEntitlementScope,
  isEntitlementSourceType,
  isEntitlementType,
  isGrantStatusUsable,
  isGrantUsableNow,
  isLimitEntitlementType,
  isTerminalGrantStatus,
  resolveLimitValue,
} from "@/lib/services/entitlement-lifecycle"

describe("grant status machine", () => {
  it("allows documented transitions and blocks the rest", () => {
    const legal: Array<[GrantStatus, GrantStatus]> = [
      [GrantStatus.PENDING, GrantStatus.ACTIVE],
      [GrantStatus.PENDING, GrantStatus.REVOKED],
      [GrantStatus.ACTIVE, GrantStatus.SUSPENDED],
      [GrantStatus.ACTIVE, GrantStatus.REVOKED],
      [GrantStatus.ACTIVE, GrantStatus.EXPIRED],
      [GrantStatus.SUSPENDED, GrantStatus.ACTIVE],
      [GrantStatus.SUSPENDED, GrantStatus.REVOKED],
    ]
    const illegal: Array<[GrantStatus, GrantStatus]> = [
      [GrantStatus.REVOKED, GrantStatus.ACTIVE],
      [GrantStatus.REVOKED, GrantStatus.SUSPENDED],
      [GrantStatus.EXPIRED, GrantStatus.ACTIVE],
      [GrantStatus.EXPIRED, GrantStatus.REVOKED],
      [GrantStatus.PENDING, GrantStatus.SUSPENDED],
      [GrantStatus.PENDING, GrantStatus.EXPIRED],
      [GrantStatus.SUSPENDED, GrantStatus.EXPIRED],
    ]
    for (const [from, to] of legal) {
      expect(canTransitionGrantStatus(from, to), `${from}->${to}`).toBe(true)
      expect(() => assertGrantStatusTransition(from, to)).not.toThrow()
    }
    for (const [from, to] of illegal) {
      expect(canTransitionGrantStatus(from, to), `${from}->${to}`).toBe(false)
      expect(() => assertGrantStatusTransition(from, to)).toThrow(EntitlementError)
    }
  })

  it("treats same-state transitions as idempotent and EXPIRED/REVOKED as terminal", () => {
    for (const s of Object.values(GrantStatus)) {
      expect(canTransitionGrantStatus(s, s)).toBe(true)
    }
    expect(isTerminalGrantStatus(GrantStatus.EXPIRED)).toBe(true)
    expect(isTerminalGrantStatus(GrantStatus.REVOKED)).toBe(true)
    expect(isTerminalGrantStatus(GrantStatus.ACTIVE)).toBe(false)
  })
})

describe("time validity", () => {
  const base = { startsAt: new Date("2026-01-01T00:00:00Z") }
  const t0 = new Date("2026-02-01T00:00:00Z")

  it("only ACTIVE grants inside [startsAt, expiresAt) are usable", () => {
    expect(isGrantUsableNow({ ...base, status: GrantStatus.ACTIVE, expiresAt: null }, t0)).toBe(true)
    expect(
      isGrantUsableNow({ ...base, status: GrantStatus.ACTIVE, expiresAt: new Date("2026-02-01T00:00:00.001Z") }, t0),
    ).toBe(true)
    expect(
      isGrantUsableNow({ ...base, status: GrantStatus.ACTIVE, expiresAt: new Date("2026-02-01T00:00:00Z") }, t0),
    ).toBe(false)
    expect(isGrantUsableNow({ status: GrantStatus.PENDING, startsAt: base.startsAt, expiresAt: null }, t0)).toBe(false)
    expect(isGrantUsableNow({ status: GrantStatus.SUSPENDED, startsAt: base.startsAt, expiresAt: null }, t0)).toBe(false)
    expect(isGrantUsableNow({ status: GrantStatus.REVOKED, startsAt: base.startsAt, expiresAt: null }, t0)).toBe(false)
    expect(isGrantUsableNow({ status: GrantStatus.EXPIRED, startsAt: base.startsAt, expiresAt: null }, t0)).toBe(false)
    expect(
      isGrantUsableNow({ status: GrantStatus.ACTIVE, startsAt: new Date("2026-02-02T00:00:00Z"), expiresAt: null }, t0),
    ).toBe(false)
  })

  it("expiry is enforced at read time; no cleanup job required for DENY", () => {
    expect(isGrantUsableNow({ ...base, status: GrantStatus.ACTIVE, expiresAt: new Date("2026-01-15T00:00:00Z") }, t0)).toBe(false)
  })

  it("isGrantStatusUsable reflects status only", () => {
    expect(isGrantStatusUsable(GrantStatus.ACTIVE)).toBe(true)
    for (const s of [GrantStatus.PENDING, GrantStatus.SUSPENDED, GrantStatus.REVOKED, GrantStatus.EXPIRED]) {
      expect(isGrantStatusUsable(s)).toBe(false)
    }
  })
})

describe("vocabularies", () => {
  it("entitlement types are controlled and limit types classified", () => {
    for (const t of ENTITLEMENT_TYPES) expect(isEntitlementType(t)).toBe(true)
    expect(isEntitlementType("STOCKS")).toBe(false)
    expect(isLimitEntitlementType(EntitlementType.STORAGE)).toBe(true)
    expect(isLimitEntitlementType(EntitlementType.USER_LIMIT)).toBe(true)
    expect(isLimitEntitlementType(EntitlementType.ADMIN_LIMIT)).toBe(true)
    expect(isLimitEntitlementType(EntitlementType.RESOURCE_LIMIT)).toBe(true)
    expect(isLimitEntitlementType(EntitlementType.PRODUCT)).toBe(false)
  })

  it("sources, scopes and subject types are controlled", () => {
    for (const s of ENTITLEMENT_SOURCE_TYPES) expect(isEntitlementSourceType(s)).toBe(true)
    expect(isEntitlementSourceType("RAZORPAY")).toBe(false)
    for (const s of ENTITLEMENT_SCOPES) expect(isEntitlementScope(s)).toBe(true)
    expect(isEntitlementScope("EVERYWHERE")).toBe(false)
    expect(ENTITLEMENT_SOURCE_TYPES).toContain(EntitlementSourceType.STANDALONE_PURCHASE)
    expect(ENTITLEMENT_SOURCE_TYPES).toContain(EntitlementSourceType.SUBSCRIPTION)
  })
})

describe("entitlement keys", () => {
  it("accepts stable business keys and rejects model/table names and junk", () => {
    for (const ok of [
      "product.school_management",
      "feature.ai_chatbot",
      "feature.rag",
      "ai.sales_agent",
      "resource.storage",
      "limit.admin_users",
      "limit.team_members",
    ]) {
      expect(() => assertValidEntitlementKey(ok)).not.toThrow()
    }
    for (const bad of ["CustomerEntitlement", "entitlement_grants", "abc", "product.", ".x", "1product.x", "UPPER.x", ""]) {
      expect(() => assertValidEntitlementKey(bad)).toThrow(EntitlementError)
    }
  })
})

describe("dedupe key", () => {
  const axes = {
    entitlementKey: "product.school_management",
    subjectType: EntitlementSubjectType.USER,
    subjectUserId: "user_1",
    subjectTeamId: null,
    sourceType: EntitlementSourceType.SUBSCRIPTION,
    sourceReference: "sub_9",
    scope: EntitlementScope.OWNER,
    resourceId: null,
  }
  it("is deterministic for identical axes", () => {
    expect(buildGrantDedupeKey(axes)).toBe(buildGrantDedupeKey(axes))
  })
  it("differs when any axis differs (idempotency is axis-scoped)", () => {
    expect(buildGrantDedupeKey(axes)).not.toBe(
      buildGrantDedupeKey({ ...axes, sourceReference: "sub_10" }),
    )
    expect(buildGrantDedupeKey(axes)).not.toBe(
      buildGrantDedupeKey({ ...axes, entitlementKey: "product.ecommerce" }),
    )
    expect(buildGrantDedupeKey(axes)).not.toBe(
      buildGrantDedupeKey({ ...axes, scope: EntitlementScope.TEAM }),
    )
  })
  it("is a fixed-length hex hash", () => {
    expect(buildGrantDedupeKey(axes)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("limit resolution", () => {
  it("pick highest valid limit, never a sum", () => {
    expect(resolveLimitValue([10, 20, 30])).toBe(30)
    expect(resolveLimitValue([10, null, 5])).toBe(10)
    expect(resolveLimitValue([])).toBeNull()
    expect(resolveLimitValue([null, null])).toBeNull()
  })
})

describe("plan-item → entitlement contract (Phase 5 consumes)", () => {
  it("maps every Phase-2 plan item to a stable entitlement descriptor", () => {
    expect(describePlanItemEntitlement({ itemType: PlanItemType.PRODUCT, itemRefId: "prod_1" })).toEqual({
      key: "product.prod_1",
      type: EntitlementType.PRODUCT,
      resourceId: "prod_1",
      limitValue: null,
      limitUnit: null,
    })
    expect(describePlanItemEntitlement({ itemType: PlanItemType.SERVICE, itemRefId: "svc_1" })).toEqual({
      key: "service.svc_1",
      type: EntitlementType.SERVICE,
      resourceId: "svc_1",
      limitValue: null,
      limitUnit: null,
    })
    expect(describePlanItemEntitlement({ itemType: PlanItemType.AI_CAPABILITY, itemRefId: "agent_1" })).toEqual({
      key: "ai.agent_1",
      type: EntitlementType.AI_CAPABILITY,
      resourceId: "agent_1",
      limitValue: null,
      limitUnit: null,
    })
    expect(
      describePlanItemEntitlement({ itemType: PlanItemType.FEATURE, itemRefKey: "rag" }),
    ).toEqual({ key: "feature.rag", type: EntitlementType.FEATURE, resourceId: null, limitValue: null, limitUnit: null })
    expect(
      describePlanItemEntitlement({ itemType: PlanItemType.STORAGE, limitValue: 20, limitUnit: "GB" }),
    ).toEqual({ key: "limit.storage", type: EntitlementType.STORAGE, resourceId: null, limitValue: 20, limitUnit: "GB" })
    expect(
      describePlanItemEntitlement({ itemType: PlanItemType.USER_LIMIT, limitValue: 10, limitUnit: "users" }),
    ).toEqual({ key: "limit.team_members", type: EntitlementType.USER_LIMIT, resourceId: null, limitValue: 10, limitUnit: "users" })
    expect(
      describePlanItemEntitlement({ itemType: PlanItemType.ADMIN_LIMIT, limitValue: 5, limitUnit: "admins" }),
    ).toEqual({ key: "limit.admin_users", type: EntitlementType.ADMIN_LIMIT, resourceId: null, limitValue: 5, limitUnit: "admins" })
    expect(
      describePlanItemEntitlement({ itemType: PlanItemType.SUPPORT, itemRefKey: "priority" }),
    ).toEqual({ key: "support.priority", type: EntitlementType.SUPPORT, resourceId: null, limitValue: null, limitUnit: null })
  })
})
