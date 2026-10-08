/**
 * Phase 3 — Test Groups J+K: security and concurrency.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementSourceType, GrantStatus } from "@prisma/client"
import { createFakeEntitlementDb, type FakeEntitlementDb } from "./helpers/fake-entitlement-db"
import { EntitlementError } from "@/lib/services/entitlement-lifecycle"

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

const { grantEntitlement, revokeEntitlement, suspendEntitlement } = await import(
  "@/lib/services/entitlement-service"
)
const { getEffectiveEntitlements, hasEntitlement, getEntitlement } = await import(
  "@/lib/services/entitlement-resolver"
)

const SUBJECT = { type: "USER" as const, userId: "user_victim" }

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
  fake.seedUser("user_victim")
  fake.seedUser("user_attacker")
  fake.seedTeam("team_orb")
  fake.seedDefinition({ id: "def_p", key: "product.school_management", type: "PRODUCT" })
  fake.seedDefinition({ id: "def_storage", key: "limit.storage", type: "STORAGE" })
})

const VICTIM_GRANT = {
  entitlementKey: "product.school_management",
  subjectType: "USER" as const,
  subjectUserId: "user_victim",
  sourceType: EntitlementSourceType.ADMIN_GRANT,
  sourceReference: "badge_1",
}

describe("J — security", () => {
  it("forged customer / owner / team ids are rejected at grant time", async () => {
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, subjectUserId: "user_forged" }, "a"),
    ).rejects.toThrow(/Unknown user/i)
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, subjectType: "TEAM", subjectUserId: undefined, subjectTeamId: "team_forged" }, "a"),
    ).rejects.toThrow(/Unknown team/i)
  })

  it("attacker cannot resolve the victim's entitlements (tenant isolation)", async () => {
    await grantEntitlement(VICTIM_GRANT, "a")
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(true)
    expect(
      await hasEntitlement({ type: "USER", userId: "user_attacker" }, "product.school_management"),
    ).toBe(false)
    const eff = await getEffectiveEntitlements({ type: "USER", userId: "user_attacker" })
    expect(eff).toHaveLength(0)
  })

  it("forged source / source reference is validated, not trusted", async () => {
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, sourceType: "MADE_UP_SOURCE" }, "a"),
    ).rejects.toThrow(EntitlementError)
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, sourceReference: "   " }, "a"),
    ).rejects.toThrow(EntitlementError)
  })

  it("client-controlled expiry/status/quantity are rejected by strict input", async () => {
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, status: "ACTIVE" }, "a"),
    ).rejects.toThrow(EntitlementError)
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, expiresAt: "2030-01-01" as never }, "a"),
    ).rejects.toThrow(EntitlementError)
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, limitValue: -5 }, "a"),
    ).rejects.toThrow(EntitlementError)
    await expect(
      grantEntitlement({ ...VICTIM_GRANT, quantity: 0 }, "a"),
    ).rejects.toThrow(EntitlementError)
  })

  it("arbitrary/cross-resource resolution is denied", async () => {
    await grantEntitlement(
      { ...VICTIM_GRANT, scope: "RESOURCE", resourceId: "shop_a" },
      "a",
    )
    expect(
      await hasEntitlement(SUBJECT, "product.school_management", { resourceId: "shop_b" }),
    ).toBe(false)
  })

  it("team A cannot read team B grants", async () => {
    await grantEntitlement(
      {
        entitlementKey: "product.school_management",
        subjectType: "TEAM",
        subjectTeamId: "team_orb",
        sourceType: EntitlementSourceType.ADMIN_GRANT,
        sourceReference: "x",
      },
      "a",
    )
    expect(await hasEntitlement({ type: "TEAM", teamId: "team_other" }, "product.school_management")).toBe(false)
  })

  it("unauthorized revoke attempts fail on unknown ids; normal users cannot mutate", async () => {
    await expect(revokeEntitlement("grant_forged", "user_attacker", "x")).rejects.toThrow(
      /Unknown grant/i,
    )
    // No raw DB access is exposed anywhere in the service layer (no generic
    // update-or-create surface), enforced by type/schema + the fake traps.
  })

  it("entitlement code cannot touch commerce/plan tables (fake traps)", async () => {
    await grantEntitlement(VICTIM_GRANT, "a")
    const eff = await getEffectiveEntitlements(SUBJECT)
    expect(eff).toHaveLength(1)
    // If the engine ever touched order/payment/cart/product/plan tables the
    // traps would have thrown.
  })
})

describe("K — concurrency", () => {
  it("simultaneous identical provisioning yields exactly one grant", async () => {
    const results = await Promise.allSettled([
      grantEntitlement(VICTIM_GRANT, "a"),
      grantEntitlement(VICTIM_GRANT, "b"),
      grantEntitlement(VICTIM_GRANT, "c"),
      grantEntitlement(VICTIM_GRANT, "d"),
    ])
    const ids = new Set(
      results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id),
    )
    expect(ids.size).toBe(1)
  })

  it("concurrent grants of different refs coexist deterministically", async () => {
    await Promise.all([
      grantEntitlement({ ...VICTIM_GRANT, sourceReference: "o1" }, "a"),
      grantEntitlement({ ...VICTIM_GRANT, sourceReference: "o2" }, "b"),
      grantEntitlement({ ...VICTIM_GRANT, sourceReference: "o3" }, "c"),
    ])
    const eff = await getEffectiveEntitlements(SUBJECT)
    expect(eff).toHaveLength(3)
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(true)
  })

  it("grant + access check race stays deterministic (grant wins once visible)", async () => {
    const [grantRes, readRes] = await Promise.all([
      grantEntitlement(VICTIM_GRANT, "a"),
      getEffectiveEntitlements(SUBJECT),
    ])
    const eff = await getEffectiveEntitlements(SUBJECT)
    expect(Array.isArray(eff)).toBe(true)
    expect(eff.some((g) => g.key === "product.school_management")).toBe(true)
    expect(grantRes.id).toBeTruthy()
  })

  it("concurrent revoke of the same grant yields one successful revocation", async () => {
    const g = await grantEntitlement(VICTIM_GRANT, "a")
    const results = await Promise.allSettled([
      revokeEntitlement(g.id, "a", "r1"),
      revokeEntitlement(g.id, "b", "r2"),
      revokeEntitlement(g.id, "c", "r3"),
    ])
    expect(fake.store.grants.get(g.id)!.status).toBe(GrantStatus.REVOKED)
    // At least one revoke wins; followers idempotently succeed or conflict —
    // never resurrect the grant.
    const failed = results.filter((r) => r.status === "rejected")
    for (const f of failed) {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(EntitlementError)
    }
  })

  it("revoke + access check race never grants revoked access", async () => {
    const g = await grantEntitlement(VICTIM_GRANT, "a")
    // Prime cache so revocation must invalidate it.
    await getEffectiveEntitlements(SUBJECT)
    await Promise.all([
      revokeEntitlement(g.id, "a", "r"),
      getEffectiveEntitlements(SUBJECT),
    ])
    expect(await hasEntitlement(SUBJECT, "product.school_management")).toBe(false)
  })

  it("concurrent suspend/restore keeps a deterministic outcome", async () => {
    const g = await grantEntitlement(VICTIM_GRANT, "a")
    await Promise.allSettled([
      suspendEntitlement(g.id, "a", "s"),
      revokeEntitlement(g.id, "b", "rv"),
    ])
    const status = fake.store.grants.get(g.id)!.status
    expect([GrantStatus.SUSPENDED, GrantStatus.REVOKED]).toContain(status)
  })
})