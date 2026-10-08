/**
 * Phase 3 — Test Group B: grant lifecycle, scopes, idempotency.
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

const {
  grantEntitlement,
  getGrant,
  revokeEntitlement,
  suspendEntitlement,
  restoreEntitlement,
  setDefinitionActive,
} = await import("@/lib/services/entitlement-service")

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
  fake.seedUser("user_1")
  fake.seedUser("user_banned", { isBanned: true })
  fake.seedTeam("team_1")
  fake.seedDefinition({ id: "def_p", key: "product.school_management", type: "PRODUCT" })
  fake.seedDefinition({ id: "def_storage", key: "limit.storage", type: "STORAGE" })
})

const BASE = {
  entitlementKey: "product.school_management",
  subjectType: "USER" as const,
  subjectUserId: "user_1",
  sourceType: EntitlementSourceType.SUBSCRIPTION,
  sourceReference: "sub_1",
}

describe("B — grants", () => {
  it("creates a valid grant with server-managed status and timestamps", async () => {
    const grant = await grantEntitlement(BASE, "admin_1")
    expect(grant.status).toBe(GrantStatus.ACTIVE)
    expect(grant.dedupeKey).toMatch(/^[0-9a-f]{64}$/)
    expect(grant.entitlementKey).toBe("product.school_management")
    expect(fake.store.auditLogs.some((a) => a.action === "ENTITLEMENT_GRANTED")).toBe(true)
  })

  it("idempotent: repeated identical provisioning returns the same grant (no duplicate)", async () => {
    const first = await grantEntitlement(BASE, "admin_1")
    const second = await grantEntitlement(BASE, "admin_1")
    expect(second.id).toBe(first.id)
    expect(fake.store.grants.size).toBe(1)
  })

  it("different source reference creates a separate grant", async () => {
    await grantEntitlement(BASE, "a")
    await grantEntitlement({ ...BASE, sourceReference: "sub_2" }, "a")
    expect(fake.store.grants.size).toBe(2)
  })

  it("supports permanent grants (expiresAt null) and dated grants", async () => {
    const now = new Date()
    const future = new Date("2030-01-01T00:00:00Z")
    const perm = await grantEntitlement({ ...BASE, sourceReference: "sub_a" }, "a")
    const dated = await grantEntitlement(
      { ...BASE, sourceReference: "sub_b", startsAt: new Date("2026-01-01T00:00:00Z"), expiresAt: future },
      "a",
    )
    expect(perm.expiresAt).toBeNull()
    expect(dated.expiresAt).not.toBeNull()
    expect((dated.expiresAt as Date).getTime()).toBe(future.getTime())
    // startsAt/expiresAt server-side defaults on permanent grants
    expect(perm.startsAt.getTime()).toBeLessThanOrEqual(now.getTime())
  })

  it("rejects expiresAt before startsAt (client-controlled window fails)", async () => {
    await expect(
      grantEntitlement(
        { ...BASE, startsAt: new Date("2026-02-01T00:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z") },
        "a",
      ),
    ).rejects.toThrow(/expiresAt must be after startsAt/i)
  })

  it("rejects unknown subject, banned user, unknown team, unknown definition", async () => {
    await expect(grantEntitlement({ ...BASE, subjectUserId: "user_missing" }, "a")).rejects.toThrow(
      /Unknown user/i,
    )
    await expect(grantEntitlement({ ...BASE, subjectUserId: "user_banned" }, "a")).rejects.toThrow(
      /banned/i,
    )
    await expect(
      grantEntitlement({ ...BASE, subjectType: "TEAM", subjectUserId: undefined, subjectTeamId: "team_missing" }, "a"),
    ).rejects.toThrow(/Unknown team/i)
    await expect(grantEntitlement({ ...BASE, entitlementKey: "product.missing" }, "a")).rejects.toThrow(
      /Unknown entitlement definition/i,
    )
  })

  it("rejects grants against a deactivated definition", async () => {
    await setDefinitionActive("def_p", false, "a")
    await expect(grantEntitlement(BASE, "a")).rejects.toThrow(/inactive/i)
  })

  it("rejects invalid source type and mixed subject ids", async () => {
    await expect(grantEntitlement({ ...BASE, sourceType: "RAZORPAY" }, "a")).rejects.toThrow(
      EntitlementError,
    )
    await expect(
      grantEntitlement(
        { ...BASE, subjectType: "USER", subjectUserId: "user_1", subjectTeamId: "team_1" },
        "a",
      ),
    ).rejects.toThrow(/USER grants require subjectUserId only/i)
  })

  it("enforces scope/resource consistency (RESOURCE requires resourceId, and vice versa)", async () => {
    await expect(grantEntitlement({ ...BASE, scope: "RESOURCE" }, "a")).rejects.toThrow(
      /RESOURCE scope requires resourceId/i,
    )
    await expect(grantEntitlement({ ...BASE, scope: "GLOBAL", resourceId: "shop_1" }, "a")).rejects.toThrow(
      /resourceId is only valid with RESOURCE scope/i,
    )
  })

  it("lifecycle: suspend → restore → revoke; revoked is terminal", async () => {
    const grant = await grantEntitlement(BASE, "a")
    const s = await suspendEntitlement(grant.id, "admin_1", "fraud hold")
    expect(s.status).toBe(GrantStatus.SUSPENDED)
    const r = await restoreEntitlement(grant.id, "admin_1", "cleared")
    expect(r.status).toBe(GrantStatus.ACTIVE)
    const v = await revokeEntitlement(grant.id, "admin_1", "refunded")
    expect(v.status).toBe(GrantStatus.REVOKED)
    // REVOKED is terminal.
    await expect(restoreEntitlement(grant.id, "admin_1", "oops")).rejects.toThrow(EntitlementError)
    // The row is preserved for audit history (not deleted).
    expect(fake.store.grants.has(grant.id)).toBe(true)
  })

  it("revoking a missing grant fails cleanly", async () => {
    await expect(revokeEntitlement("grant_missing", "a", "r")).rejects.toThrow(/Unknown grant/i)
  })

  it("getGrant returns the stored grant and null for missing", async () => {
    const grant = await grantEntitlement(BASE, "a")
    expect((await getGrant(grant.id))?.id).toBe(grant.id)
    expect(await getGrant("grant_missing")).toBeNull()
    expect(await getGrant("")).toBeNull()
  })
})
