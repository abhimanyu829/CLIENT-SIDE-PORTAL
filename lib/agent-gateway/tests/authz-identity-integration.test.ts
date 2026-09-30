/**
 * lib/agent-gateway/tests/authz-identity-integration.test.ts
 *
 * Phase 6 — Section C: Identity Integration Tests. Verifies the full
 * chain AgentConnection -> owner -> team -> agent -> policy behaves
 * correctly for valid, suspended, revoked, expired, wrong-team,
 * wrong-owner, forged, and missing identity scenarios — exercised
 * through `buildAuthorizationContext()` + `evaluate()` together, using
 * a real Phase 4 `AgentExecutionContext` shape (not a hand-rolled one) so
 * this test proves the ACTUAL integration seam, not just the engine in
 * isolation (already covered by authz-engine.test.ts).
 */
import { describe, expect, it } from "vitest"
import { buildAuthorizationContext } from "../authorization/context-builder"
import { evaluate } from "../authorization/engine"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"
import type { ResolvedPolicyVersion } from "../authorization/types"

function execCtx(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    agentId: "agent_1",
    ownerId: "owner_1",
    teamId: "team_1",
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

function globalAllowPolicy(): ResolvedPolicyVersion {
  return {
    policyId: "p1",
    policyVersionId: "pv1",
    version: 1,
    policyName: "global read",
    policyEnabled: true,
    policyPriority: 0,
    status: "ACTIVE",
    effect: "ALLOW",
    scope: "GLOBAL",
    scopeValue: null,
    capabilityId: null,
    conditions: null,
    riskConstraint: "READ",
    approvalRequirement: false,
  }
}

describe("Section C — Identity Integration", () => {
  it("valid agent (ACTIVE connection) — authorized against a matching GLOBAL read policy", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ connectionStatus: "ACTIVE" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, { versions: [globalAllowPolicy()] })
    expect(decision.decision).toBe("ALLOW")
  })

  it("suspended agent — denied even with a matching ALLOW policy", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ connectionStatus: "SUSPENDED" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, { versions: [globalAllowPolicy()] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("CONNECTION_SUSPENDED")
  })

  it("revoked agent — denied even with a matching ALLOW policy", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ connectionStatus: "REVOKED" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, { versions: [globalAllowPolicy()] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("CONNECTION_REVOKED")
  })

  it("expired identity — denied even with a matching ALLOW policy", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ connectionStatus: "EXPIRED" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, { versions: [globalAllowPolicy()] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("CONNECTION_EXPIRED")
  })

  it("wrong team — a TEAM-scoped policy for a different team never matches", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ teamId: "team_A" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, {
      versions: [{ ...globalAllowPolicy(), scope: "TEAM", scopeValue: "team_B" }],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("wrong owner — an OWNER-scoped policy for a different owner never matches", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ ownerId: "owner_A" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, {
      versions: [{ ...globalAllowPolicy(), scope: "OWNER", scopeValue: "owner_B" }],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("forged identity — buildAuthorizationContext only ever copies from the trusted AgentExecutionContext, never from raw input, even if input contains ownerId-shaped keys", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ ownerId: "owner_REAL" }), capability, { id: "p1", ownerId: "owner_FORGED", teamId: "team_FORGED" })
    expect(authzCtx.ownerId).toBe("owner_REAL")
    expect(authzCtx.teamId).toBe(execCtx().teamId)
  })

  it("missing identity — a connectionId/ownerId of empty string is treated as invalid identity (hard deny)", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ connectionId: "", ownerId: "" }), capability, {})
    const decision = evaluate(authzCtx, { versions: [globalAllowPolicy()] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("IDENTITY_INVALID")
  })
})
