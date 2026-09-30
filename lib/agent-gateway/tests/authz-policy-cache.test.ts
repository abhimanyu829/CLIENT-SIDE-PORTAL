/**
 * lib/agent-gateway/tests/authz-policy-cache.test.ts
 *
 * Phase 6 — Section H: Policy Cache Tests. Verifies the cache never
 * serves a stale ALLOW past a revocation/disable — invalidatePolicyCache()
 * must actually clear what loadActivePolicySet() would otherwise reuse.
 * Also verifies fail-open behavior when Redis is unavailable (falls
 * through to DB) and that cache read/write failures never throw or block
 * the caller.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createAuthzFakeDb } from "./authz-fake-db"

function createFakeRedis() {
  const store = new Map<string, unknown>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
      return "OK"
    }),
    del: vi.fn(async (key: string) => {
      const had = store.has(key)
      store.delete(key)
      return had ? 1 : 0
    }),
    _store: store,
  }
}

async function setup(redisImpl: unknown) {
  vi.resetModules()
  const fake = createAuthzFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: redisImpl }))

  const store = await import("../authorization/policy-store")
  return { fake, store }
}

describe("Section H — Policy Cache Tests", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("1. cached ALLOW — a second loadActivePolicySet() call within TTL returns the cached set without hitting the DB again", async () => {
    const redis = createFakeRedis()
    const { fake, store } = await setup(redis)
    await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })

    await store.loadActivePolicySet() // populates cache
    const dbCallsBefore = (fake.client.agentPolicyVersion.findMany as ReturnType<typeof vi.fn>).mock.calls.length

    await store.loadActivePolicySet() // should hit cache, not DB
    const dbCallsAfter = (fake.client.agentPolicyVersion.findMany as ReturnType<typeof vi.fn>).mock.calls.length

    expect(dbCallsAfter).toBe(dbCallsBefore) // no new DB call
  })

  it("2/3/4. policy revoked, next request — invalidatePolicyCache() (called internally by disablePolicy) ensures the NEXT load reflects the disablement, not a stale cached ALLOW", async () => {
    const redis = createFakeRedis()
    const { store } = await setup(redis)
    const created = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })

    const before = await store.loadActivePolicySet() // populates cache, includes the policy
    expect(before.map((v) => v.policyId)).toContain(created.policyId)

    await store.disablePolicy(created.policyId) // invalidates cache internally

    const after = await store.loadActivePolicySet() // must NOT return the stale cached set
    expect(after.map((v) => v.policyId)).not.toContain(created.policyId)
  })

  it("connection suspension / capability disable / environment policy change / policy version update all go through the SAME createPolicyVersion/disablePolicy path, which always invalidates — verified by one more explicit new-version scenario", async () => {
    const redis = createFakeRedis()
    const { store } = await setup(redis)
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    await store.loadActivePolicySet() // cache populated with v1

    const v2 = await store.createPolicyVersion({ policyId: v1.policyId, effect: "DENY", scope: "GLOBAL", actorId: "admin_1" }) // new version, cache invalidated

    const after = await store.loadActivePolicySet()
    const versionIds = after.map((v) => v.policyVersionId)
    expect(versionIds).not.toContain(v1.policyVersionId) // stale v1 never served
    expect(versionIds).toContain(v2.policyVersionId)
  })

  it("fail-open: a cache GET failure falls through to a real DB read rather than throwing", async () => {
    const redis = createFakeRedis()
    redis.get.mockRejectedValueOnce(new Error("Redis connection reset"))
    const { fake, store } = await setup(redis)
    await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })

    const result = await store.loadActivePolicySet()
    expect(result.length).toBe(1) // DB fallback succeeded despite the cache error
  })

  it("fail-open: a cache SET failure never blocks the caller from getting a correct result", async () => {
    const redis = createFakeRedis()
    redis.set.mockRejectedValueOnce(new Error("Redis write failed"))
    const { store } = await setup(redis)
    await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })

    await expect(store.loadActivePolicySet()).resolves.toHaveLength(1)
  })

  it("invalidatePolicyCache() never throws even if Redis DEL fails", async () => {
    const redis = createFakeRedis()
    redis.del.mockRejectedValueOnce(new Error("Redis unreachable"))
    const { store } = await setup(redis)
    await expect(store.invalidatePolicyCache()).resolves.toBeUndefined()
  })

  it("Redis entirely absent (null client, matching local-dev convention) — loadActivePolicySet still works via direct DB read every time", async () => {
    const { fake, store } = await setup(null)
    await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })

    const result1 = await store.loadActivePolicySet()
    const result2 = await store.loadActivePolicySet()
    expect(result1).toHaveLength(1)
    expect(result2).toHaveLength(1)
    // Every call hits the DB directly since there's no cache to short-circuit it.
    expect((fake.client.agentPolicyVersion.findMany as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })
})
