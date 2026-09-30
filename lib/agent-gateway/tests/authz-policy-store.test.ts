/**
 * lib/agent-gateway/tests/authz-policy-store.test.ts
 *
 * Phase 6 — policy-store.ts direct tests: write-path (createPolicyVersion,
 * disablePolicy, enablePolicy, rollbackToVersion), versioning invariants
 * (immutability, monotonic version numbers, currentVersionId repointing,
 * SUPERSEDED marking), and read-path (loadActivePolicySet filtering).
 *
 * Uses the same disclosed-limitation in-memory fake DB pattern as every
 * other Phase 2-5 test file (no live Postgres in this environment).
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createAuthzFakeDb } from "./authz-fake-db"

async function setup() {
  vi.resetModules()
  const fake = createAuthzFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))

  const store = await import("../authorization/policy-store")
  return { fake, store }
}

describe("policy-store — write path", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("createPolicyVersion with no policyId creates a brand-new AgentPolicy + version 1", async () => {
    const { fake, store } = await setup()
    const result = await store.createPolicyVersion({
      name: "test policy",
      effect: "ALLOW",
      scope: "GLOBAL",
      actorId: "admin_1",
    })
    expect(result.version).toBe(1)
    expect(fake._policies.get(result.policyId)?.currentVersionId).toBe(result.policyVersionId)
  })

  it("createPolicyVersion with an existing policyId creates version N+1 and marks the previous version SUPERSEDED", async () => {
    const { fake, store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    const v2 = await store.createPolicyVersion({ policyId: v1.policyId, effect: "DENY", scope: "GLOBAL", actorId: "admin_1" })

    expect(v2.version).toBe(2)
    expect(fake._versions.get(v1.policyVersionId)?.status).toBe("SUPERSEDED")
    expect(fake._versions.get(v2.policyVersionId)?.status).toBe("ACTIVE")
    expect(fake._policies.get(v1.policyId)?.currentVersionId).toBe(v2.policyVersionId)
  })

  it("createPolicyVersion NEVER updates a previously-created version row (immutability)", async () => {
    const { fake, store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    const originalCreatedAt = fake._versions.get(v1.policyVersionId)!.createdAt
    await store.createPolicyVersion({ policyId: v1.policyId, effect: "DENY", scope: "GLOBAL", actorId: "admin_1" })
    // v1's row itself is untouched except its `status` field (SUPERSEDED)
    // — every other field remains exactly as originally created.
    const v1Row = fake._versions.get(v1.policyVersionId)!
    expect(v1Row.effect).toBe("ALLOW")
    expect(v1Row.createdAt).toBe(originalCreatedAt)
  })

  it("createPolicyVersion rejects a malformed condition tree before writing anything", async () => {
    const { fake, store } = await setup()
    await expect(
      store.createPolicyVersion({
        name: "bad policy",
        effect: "ALLOW",
        scope: "GLOBAL",
        // @ts-expect-error deliberately malformed
        conditions: { operator: "eval", attribute: "subject.ownerId", value: "x" },
        actorId: "admin_1",
      })
    ).rejects.toThrow(/Unrecognized condition operator/)
    expect(fake._policies.size).toBe(0)
  })

  it("disablePolicy sets enabled=false; enablePolicy reverses it", async () => {
    const { fake, store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    await store.disablePolicy(v1.policyId)
    expect(fake._policies.get(v1.policyId)?.enabled).toBe(false)
    await store.enablePolicy(v1.policyId)
    expect(fake._policies.get(v1.policyId)?.enabled).toBe(true)
  })

  it("rollbackToVersion creates a NEW version copying the target's fields, never resurrecting the old row", async () => {
    const { fake, store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", riskConstraint: "READ", actorId: "admin_1" })
    await store.createPolicyVersion({ policyId: v1.policyId, effect: "DENY", scope: "GLOBAL", actorId: "admin_1" }) // v2
    const rollback = await store.rollbackToVersion(v1.policyId, 1, "admin_1")

    expect(rollback.version).toBe(3) // a NEW version, not a reactivation of v1
    const rolledBackRow = fake._versions.get(rollback.policyVersionId)!
    expect(rolledBackRow.effect).toBe("ALLOW")
    expect(rolledBackRow.riskConstraint).toBe("READ")
  })

  it("rollbackToVersion throws for a nonexistent target version", async () => {
    const { store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    await expect(store.rollbackToVersion(v1.policyId, 99, "admin_1")).rejects.toThrow(/No version 99/)
  })
})

describe("policy-store — read path", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("loadActivePolicySet returns only ACTIVE versions on enabled policies", async () => {
    const { store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "active-enabled", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    const v2 = await store.createPolicyVersion({ name: "disabled-policy", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    await store.disablePolicy(v2.policyId)

    const active = await store.loadActivePolicySet()
    const ids = active.map((v) => v.policyId)
    expect(ids).toContain(v1.policyId)
    expect(ids).not.toContain(v2.policyId)
  })

  it("loadActivePolicySet does not return a SUPERSEDED version", async () => {
    const { store } = await setup()
    const v1 = await store.createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", actorId: "admin_1" })
    const v2 = await store.createPolicyVersion({ policyId: v1.policyId, effect: "DENY", scope: "GLOBAL", actorId: "admin_1" })

    const active = await store.loadActivePolicySet()
    const versionIds = active.map((v) => v.policyVersionId)
    expect(versionIds).not.toContain(v1.policyVersionId)
    expect(versionIds).toContain(v2.policyVersionId)
  })

  it("loadActivePolicySet propagates a DB failure rather than returning an empty set silently (fail-closed contract)", async () => {
    vi.resetModules()
    vi.doMock("@/lib/db", () => ({
      db: { agentPolicyVersion: { findMany: vi.fn(async () => { throw new Error("DB connection lost") }) } },
    }))
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const store = await import("../authorization/policy-store")
    await expect(store.loadActivePolicySet()).rejects.toThrow(/DB connection lost/)
  })
})
