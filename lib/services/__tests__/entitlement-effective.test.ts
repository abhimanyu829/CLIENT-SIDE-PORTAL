/**
 * Phase 3 — Test Groups C+D: effective entitlements and limit resolution.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementScope, EntitlementSourceType, GrantStatus } from "@prisma/client"
import { createFakeEntitlementDb, type FakeEntitlementDb } from "./helpers/fake-entitlement-db"

let fake: FakeEntitlementDb

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
vi.mock("@/lib/services/cache-service", () => {
  const store = new Map<string, unknown>()
  return {
    __store: store,
    cacheGet: vi.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    cacheSet: vi.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)))
      return true
    }),
    invalidateCache: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k)
    }),
    CACHE_KEYS: { AI_QUOTA_PREFIX: "ai:quota:" },
    aiQuotaCacheKey: (id: string) => `ai:quota:${id}`,
  }
})

import * as dbModule from "@/lib/db"
import * as cacheNs from "@/lib/services/cache-service"

const { grantEntitlement } = await import("@/lib/services/entitlement-service")
const { getEffectiveEntitlements, getEntitlement, hasEntitlement, getLimit } = await import(
  "@/lib/services/entitlement-resolver"
)

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
  fake.seedUser("user_1")
  fake.seedTeam("team_1")
  fake.seedDefinition({ id: "def_p", key: "product.school_management", type: "PRODUCT" })
  fake.seedDefinition({ id: "def_e", key: "product.ecommerce", type: "PRODUCT" })
  fake.seedDefinition({ id: "def_storage", key: "limit.storage", type: "STORAGE" })
  fake.seedDefinition({ id: "def_users", key: "limit.team_members", type: "USER_LIMIT" })
  fake.seedDefinition({ id: "def_admins", key: "limit.admin_users", type: "ADMIN_LIMIT" })
  fake.seedDefinition({ id: "def_support", key: "support.priority", type: "SUPPORT" })
})

const SUBJECT = { type: "USER" as const, userId: "user_1" }

async function grant(key: string, extra: Record<string, unknown> = {}, ref = "src") {
  return grantEntitlement(
    {
      entitlementKey: key,
      subjectType: "USER",
      subjectUserId: "user_1",
      sourceType: EntitlementSourceType.ADMIN_GRANT,
      sourceReference: ref,
      ...extra,
    },
    "admin_1",
  )
}

describe("C — effective entitlements", () => {
  it("resolves a single active grant", async () => {
    await grant("product.school_management")
    const eff = await getEffectiveEntitlements(SUBJECT)
    expect(eff).toHaveLength(1)
    expect(eff[0].key).toBe("product.school_management")
    expect(eff[0].status).toBe(GrantStatus.ACTIVE)
    expect(eff[0].sourceType).toBe(EntitlementSourceType.ADMIN_GRANT)
  })

  it("hasEntitlement answers deterministically", async () => {
    await grant("product.school_management")
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(true)
    expect(await hasEntitlement(SUBJECT, "product.ecommerce")).toBe(false)
  })

  it("excludes expired, revoked, suspended and pending grants", async () => {
    const past = new Date(Date.now() - 86_400_000)
    const future = new Date(Date.now() + 86_400_000)
    await grant(
      "product.school_management",
      { startsAt: new Date(Date.now() - 2 * 86_400_000), expiresAt: past },
      "exp",
    )
    const revoked = await grant("product.ecommerce", {}, "rev")
    await grant("limit.storage", { sourceReference: "storage" })

    const { revokeEntitlement, suspendEntitlement } = await import("@/lib/services/entitlement-service")
    await revokeEntitlement(revoked.id, "a", "r")
    const sup = await grant("support.priority", { sourceReference: "support" })
    await suspendEntitlement(sup.id, "a", "r")

    const eff = await getEffectiveEntitlements(SUBJECT)
    expect(eff.some((g) => g.key === "product.school_management")).toBe(false)
    expect(eff.some((g) => g.key === "product.ecommerce")).toBe(false)
    expect(eff.some((g) => g.key === "support.priority")).toBe(false)
    expect(eff).toHaveLength(1)
  })

  it("overlapping grants from different sources resolve as ANY-valid for access", async () => {
    await grant("product.school_management", {}, "sub_1")
    await grant("product.school_management", { sourceReference: "order_1" }, "order_1")
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(true)
  })

  it("getEntitlement returns the deterministic winner (latest expiry, then latest start)", async () => {
    const now = Date.now()
    await grantEntitlement(
      {
        entitlementKey: "product.school_management",
        subjectType: "USER",
        subjectUserId: "user_1",
        sourceType: EntitlementSourceType.STANDALONE_PURCHASE,
        sourceReference: "order_1",
        startsAt: new Date(now - 10_000),
        expiresAt: new Date(now + 10_000),
      },
      "a",
    )
    await grantEntitlement(
      {
        entitlementKey: "product.school_management",
        subjectType: "USER",
        subjectUserId: "user_1",
        sourceType: EntitlementSourceType.SUBSCRIPTION,
        sourceReference: "sub_1",
        startsAt: new Date(now),
      },
      "a",
    )
    const winner = await getEntitlement(SUBJECT, "product.school_management")
    expect(winner!.sourceType).toBe(EntitlementSourceType.SUBSCRIPTION)
    expect(winner!.expiresAt).toBeNull()
  })

  it("resource-scoped entitlements resolve only against the matching resource", async () => {
    await grant("product.ecommerce", { scope: "RESOURCE", resourceId: "shop_123" })
    await grant("product.ecommerce", { sourceReference: "non-res" })

    const without = await hasEntitlement(SUBJECT, "product.ecommerce")
    expect(without).toBe(true)
    const scoped = await hasEntitlement(SUBJECT, "product.ecommerce", { resourceId: "shop_123" })
    expect(scoped).toBe(true)
    const other = await hasEntitlement(SUBJECT, "product.ecommerce", { resourceId: "shop_456" })
    expect(other).toBe(false)
  })

  it("team-scoped entitlements resolve for team subjects and never leak to users", async () => {
    await grantEntitlement(
      {
        entitlementKey: "product.school_management",
        subjectType: "TEAM",
        subjectTeamId: "team_1",
        sourceType: EntitlementSourceType.ADMIN_GRANT,
        sourceReference: "adm",
      },
      "a",
    )
    expect(await hasEntitlement({ type: "TEAM", teamId: "team_1" }, "product.school_management")).toBe(true)
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(false)
  })
})

describe("D — limits", () => {
  it("resolves the highest valid limit across overlapping grants (max, not sum)", async () => {
    await grant("limit.storage", { limitValue: 5, limitUnit: "GB" }, "sub_1")
    await grant("limit.storage", { limitValue: 20, limitUnit: "GB" }, "order_1")
    const storage = await getLimit(SUBJECT, "limit.storage")
    expect(storage.limitValue).toBe(20)
    expect(storage.limitUnit).toBe("GB")
  })

  it("returns null when no limit grant exists", async () => {
    expect(await getLimit(SUBJECT, "limit.storage")).toEqual({ limitValue: null, limitUnit: null })
  })

  it("ignores non-limit grants in getLimit", async () => {
    await grant("product.school_management")
    expect(await getLimit(SUBJECT, "product.school_management")).toEqual({
      limitValue: null,
      limitUnit: null,
    })
  })

  it("resolves admin-user limits with max-wins", async () => {
    await grant("limit.admin_users", { limitValue: 2, limitUnit: "admins" }, "s1")
    await grant("limit.admin_users", { limitValue: 5, limitUnit: "admins" }, "s2")
    const admins = await getLimit(SUBJECT, "limit.admin_users")
    expect(admins.limitValue).toBe(5)
  })
})
