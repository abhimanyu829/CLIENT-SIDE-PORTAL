/**
 * lib/agent-gateway/tests/authz-authorizer.test.ts
 *
 * `PolicyEngineAuthorizer` — Phase 5 CapabilityAuthorizer integration
 * tests. Verifies: ALLOW resolves normally; DENY/REQUIRES_APPROVAL/
 * POLICY_UNAVAILABLE all throw AuthorizationDeniedError (never a
 * different error type, never a bare return); an internal exception from
 * the policy store is caught and converted to a deny (fail-closed), never
 * an implicit allow. Also covers spec item #30 ("policy-unavailable fail
 * closed") which the pure engine itself cannot exercise (no I/O).
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createAuthzFakeDb } from "./authz-fake-db"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"

async function setup() {
  vi.resetModules()
  const fake = createAuthzFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))

  const { PolicyEngineAuthorizer } = await import("../authorization/authorizer")
  const { createPolicyVersion } = await import("../authorization/policy-store")
  const { AuthorizationDeniedError } = await import("../mcp/errors")
  return { fake, PolicyEngineAuthorizer, createPolicyVersion, AuthorizationDeniedError }
}

function execCtx(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_1",
    teamId: null,
    connectionStatus: "ACTIVE",
    capabilityId: "products.get",
    capabilityVersion: 1,
    environment: "production",
    timestamp: new Date(),
    signal: new AbortController().signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "products.get", capabilityVersion: 1 },
    ...overrides,
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

describe("PolicyEngineAuthorizer", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("resolves normally (ALLOW) when a matching policy exists", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "p", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx(), capability, { id: "p1" }, {})).resolves.toBeUndefined()
  })

  it("throws AuthorizationDeniedError when no policy authorizes the capability (default deny)", async () => {
    const { PolicyEngineAuthorizer, AuthorizationDeniedError } = await setup()
    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx(), capability, { id: "p1" }, {})).rejects.toBeInstanceOf(AuthorizationDeniedError)
  })

  it("throws AuthorizationDeniedError when an explicit DENY policy matches", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion, AuthorizationDeniedError } = await setup()
    await createPolicyVersion({ name: "deny-all", effect: "DENY", scope: "CAPABILITY", capabilityId: "products.get", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx(), capability, { id: "p1" }, {})).rejects.toBeInstanceOf(AuthorizationDeniedError)
  })

  it("throws AuthorizationDeniedError when a REQUIRES_APPROVAL policy matches (Phase 7 not yet built — fails closed)", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion, AuthorizationDeniedError } = await setup()
    await createPolicyVersion({ name: "needs-approval", effect: "REQUIRES_APPROVAL", scope: "CAPABILITY", capabilityId: "products.get", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx(), capability, { id: "p1" }, {})).rejects.toBeInstanceOf(AuthorizationDeniedError)
  })

  it("30. POLICY_UNAVAILABLE fail-closed — a policy-store exception is caught and converted to AuthorizationDeniedError, never an implicit allow", async () => {
    vi.resetModules()
    vi.doMock("@/lib/db", () => ({
      db: { agentPolicyVersion: { findMany: vi.fn(async () => { throw new Error("connection pool exhausted") }) } },
    }))
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { PolicyEngineAuthorizer } = await import("../authorization/authorizer")
    const { AuthorizationDeniedError } = await import("../mcp/errors")

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx(), capability, { id: "p1" }, {})).rejects.toBeInstanceOf(AuthorizationDeniedError)
  })

  it("the thrown error's message never contains the internal reason code or policy name — external message is generic", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion, AuthorizationDeniedError } = await setup()
    await createPolicyVersion({ name: "SECRET_INTERNAL_POLICY_NAME", effect: "DENY", scope: "CAPABILITY", capabilityId: "products.get", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    try {
      await authorizer.authorize(execCtx(), capability, { id: "p1" }, {})
      throw new Error("expected authorize() to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationDeniedError)
      expect((err as Error).message).not.toContain("SECRET_INTERNAL_POLICY_NAME")
    }
  })

  it("forged resourceContext argument (already {} in production per Phase 5) has no effect on the decision — resourceId is derived from input, not resourceContext", async () => {
    const { PolicyEngineAuthorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "p", effect: "ALLOW", scope: "RESOURCE", scopeValue: "p1", capabilityId: "products.get", actorId: "admin_1" })

    const authorizer = new PolicyEngineAuthorizer()
    await expect(authorizer.authorize(execCtx(), capability, { id: "p1" }, { resourceId: "SOMETHING_ELSE" })).resolves.toBeUndefined()
  })
})
