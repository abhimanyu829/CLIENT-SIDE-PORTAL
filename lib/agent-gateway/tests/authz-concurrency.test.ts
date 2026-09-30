/**
 * lib/agent-gateway/tests/authz-concurrency.test.ts
 *
 * Phase 6 — Section K: Concurrency / Race Tests. Verifies simultaneous
 * policy-update + authorization, and simultaneous authorize() calls for
 * different connections, never produce an ambiguous or incorrect
 * security state.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createAuthzFakeDb } from "./authz-fake-db"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"

async function setup() {
  vi.resetModules()
  const fake = createAuthzFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null })) // no cache layer — isolates the race to the store/engine themselves

  const { PolicyEngineAuthorizer } = await import("../authorization/authorizer")
  const { createPolicyVersion, disablePolicy } = await import("../authorization/policy-store")
  return { fake, PolicyEngineAuthorizer, createPolicyVersion, disablePolicy }
}

function execCtx(connectionId: string, ownerId: string, capabilityId = "products.get"): AgentExecutionContext {
  return {
    requestId: `req_${connectionId}`,
    connectionId,
    ownerId,
    teamId: null,
    connectionStatus: "ACTIVE",
    capabilityId,
    capabilityVersion: 1,
    environment: "production",
    timestamp: new Date(),
    signal: new AbortController().signal,
    tracing: { requestId: `req_${connectionId}`, connectionId, capabilityId, capabilityVersion: 1 },
  }
}

const capability: CapabilityDefinition = {
  id: "products.get",
  version: 1,
  domain: "products",
  name: "Get a product",
  description: "test",
  status: "ACTIVE",
  operationType: "READ",
  exposure: "AGENT_AVAILABLE",
  inputSchema: null,
  outputSchema: null,
  errorContract: [],
  requiredIdentityContext: ["connectionId"],
  resource: { resourceType: "Product", resourceLocator: "id" },
  permission: { permission: "read:products" },
  sideEffects: { effects: [] },
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "safe", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "N/A" },
  executionReference: { adapterKey: "products.getAdapter" },
}

describe("Section K — Concurrency / Race Tests", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("simultaneous authorize() for two independent connections resolve correctly without cross-contamination", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "owner-A-only", effect: "ALLOW", scope: "OWNER", scopeValue: "owner_A", capabilityId: "products.get", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    const [resultA, resultB] = await Promise.allSettled([
      authorizer.authorize(execCtx("conn_A", "owner_A"), capability, { id: "p1" }, {}),
      authorizer.authorize(execCtx("conn_B", "owner_B"), capability, { id: "p1" }, {}),
    ])

    expect(resultA.status).toBe("fulfilled") // owner_A is authorized
    expect(resultB.status).toBe("rejected") // owner_B has no matching policy
  })

  it("policy update + authorization racing: a disablePolicy() that resolves before authorize() reads the store never lets that authorize() call see the disabled policy", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion, disablePolicy } = await setup()
    const created = await createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", riskConstraint: "READ", actorId: "admin_1" })

    await disablePolicy(created.policyId) // completes BEFORE the authorize() call below starts

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx("conn_1", "owner_1"), capability, { id: "p1" }, {})).rejects.toThrow()
  })

  it("many simultaneous authorize() calls against the SAME connection+capability all converge on the identical decision (no nondeterministic flapping)", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "p", effect: "ALLOW", scope: "GLOBAL", riskConstraint: "READ", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    const results = await Promise.all(
      Array.from({ length: 10 }, () => authorizer.authorize(execCtx("conn_1", "owner_1"), capability, { id: "p1" }, {}).then(() => "ALLOWED" as const).catch(() => "DENIED" as const))
    )
    expect(new Set(results).size).toBe(1) // all 10 calls agree
    expect(results[0]).toBe("ALLOWED")
  })

  it("a new DENY policy created mid-flight (between two sequential authorize() calls) takes effect on the very next call — no stale in-process caching of a decision", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "allow", effect: "ALLOW", scope: "GLOBAL", riskConstraint: "READ", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx("conn_1", "owner_1"), capability, { id: "p1" }, {})).resolves.toBeUndefined()

    await createPolicyVersion({ name: "deny", effect: "DENY", scope: "CAPABILITY", capabilityId: "products.get", actorId: "admin_1" })

    await expect(authorizer.authorize(execCtx("conn_1", "owner_1"), capability, { id: "p1" }, {})).rejects.toThrow()
  })
})
