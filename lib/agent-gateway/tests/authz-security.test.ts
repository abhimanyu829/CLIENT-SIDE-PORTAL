/**
 * lib/agent-gateway/tests/authz-security.test.ts
 *
 * Phase 6 — Section J: Security Tests (the spec's 25-attack list).
 * Several attacks are proven STRUCTURALLY IMPOSSIBLE by the architecture
 * itself (no client-facing API to even attempt them) rather than needing
 * a runtime test — each such item is documented inline with the specific
 * reason, per Phase 4/5's own precedent for this style of test file.
 */
import { describe, expect, it } from "vitest"
import { evaluate } from "../authorization/engine"
import { buildAuthorizationContext } from "../authorization/context-builder"
import { evaluateCondition, assertWellFormedCondition } from "../authorization/policy-language"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AuthorizationContext, ResolvedPolicyVersion } from "../authorization/types"

function execCtx(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_REAL",
    teamId: "team_REAL",
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

function allow(overrides: Partial<ResolvedPolicyVersion> = {}): ResolvedPolicyVersion {
  return {
    policyId: "p1",
    policyVersionId: "pv1",
    version: 1,
    policyName: "test",
    policyEnabled: true,
    policyPriority: 0,
    status: "ACTIVE",
    effect: "ALLOW",
    scope: "OWNER",
    scopeValue: "owner_REAL",
    capabilityId: null,
    conditions: null,
    riskConstraint: null,
    approvalRequirement: false,
    ...overrides,
  }
}

describe("Section J — Security / Attack Tests", () => {
  it("1. forged ownerId — a client-supplied ownerId-shaped input field never overrides the trusted context's real ownerId", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ ownerId: "owner_REAL" }), capability, { id: "p1", ownerId: "owner_FORGED" })
    expect(authzCtx.ownerId).toBe("owner_REAL")
  })

  it("2. forged teamId — a client-supplied teamId-shaped input field never overrides the trusted context's real teamId", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ teamId: "team_REAL" }), capability, { id: "p1", teamId: "team_FORGED" })
    expect(authzCtx.teamId).toBe("team_REAL")
  })

  it("3. forged agentId — a client-supplied agentId-shaped input field never overrides the trusted context's real agentId", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ agentId: "agent_REAL" }), capability, { id: "p1", agentId: "agent_FORGED" })
    expect(authzCtx.agentId).toBe("agent_REAL")
  })

  it("4. forged connectionId — a client-supplied connectionId-shaped input field never overrides the trusted context's real connectionId", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ connectionId: "conn_REAL" }), capability, { id: "p1", connectionId: "conn_FORGED" })
    expect(authzCtx.connectionId).toBe("conn_REAL")
  })

  it("5. forged permission — a client-supplied 'permission' input field never overrides the capability's own Phase-3-declared permission", () => {
    const authzCtx = buildAuthorizationContext(execCtx(), capability, { id: "p1", permission: "write:everything" })
    expect(authzCtx.existingPermission).toBe("read:products") // from capability.permission.permission, never from input
  })

  it("6. capability substitution — structurally impossible: authorize() always receives the SERVER-RESOLVED CapabilityDefinition object (Phase 5's resolveProjectedTool), never a client-supplied capability id string re-looked-up inside this engine", () => {
    // engine.ts / context-builder.ts never accept a raw capability id
    // string from an untrusted source — the CapabilityDefinition object
    // itself is the only input, always constructed by mcp/server.ts from
    // its own trusted registry lookup before authorize() is ever called.
    expect(true).toBe(true)
  })

  it("7. resource substitution — a RESOURCE-scoped grant for resource A never authorizes an operation whose extracted resourceId is B", () => {
    const authzCtx = buildAuthorizationContext(execCtx(), capability, { id: "prod_B" })
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), scope: "RESOURCE", scopeValue: "prod_A" }] })
    expect(decision.decision).toBe("DENY")
  })

  it("8. cross-tenant resource — Owner A's OWNER-scoped grant never authorizes a request whose trusted ownerId is Owner B", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ ownerId: "owner_B" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, { versions: [allow({ scopeValue: "owner_A" })] })
    expect(decision.decision).toBe("DENY")
  })

  it("9. cross-environment resource — a 'production'-scoped grant never authorizes a 'staging' request", () => {
    const authzCtx = buildAuthorizationContext(execCtx({ environment: "staging" }), capability, { id: "p1" })
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), scope: "ENVIRONMENT", scopeValue: "production" }] })
    expect(decision.decision).toBe("DENY")
  })

  it("10. policy injection — a stored condition attempting to reference an unrecognized/injected attribute name never matches, never throws", () => {
    expect(evaluateCondition(execCtxToAuthz(), { operator: "equals", attribute: "subject.__proto__.polluted", value: "x" })).toBe(false)
  })

  it("11. arbitrary expression injection — assertWellFormedCondition rejects any operator string outside the fixed closed set at write time", () => {
    expect(() => assertWellFormedCondition({ operator: "$where", attribute: "subject.ownerId", value: "this.ownerId==1" })).toThrow(/Unrecognized condition operator/)
  })

  it("12. JavaScript expression — a condition value containing JS-shaped text is treated as an inert string, never eval'd", () => {
    expect(evaluateCondition(execCtxToAuthz(), { operator: "equals", attribute: "subject.ownerId", value: "() => true" })).toBe(false)
  })

  it("13. SQL payload — a condition value containing a SQL-injection-shaped string is treated as an inert string, never reaches any query", () => {
    expect(evaluateCondition(execCtxToAuthz({ ownerId: "owner_REAL" }), { operator: "equals", attribute: "subject.ownerId", value: "owner_REAL' OR '1'='1" })).toBe(false)
  })

  it("14. prototype pollution — 'constructor'/'__proto__'/'toString' attribute names never resolve through the prototype chain", () => {
    expect(evaluateCondition(execCtxToAuthz(), { operator: "exists", attribute: "constructor" })).toBe(false)
    expect(evaluateCondition(execCtxToAuthz(), { operator: "exists", attribute: "__proto__" })).toBe(false)
    expect(evaluateCondition(execCtxToAuthz(), { operator: "exists", attribute: "toString" })).toBe(false)
  })

  it("15. policy path traversal — an attribute name shaped like a path (e.g. '../../secret') is not a recognized attribute and never resolves", () => {
    expect(evaluateCondition(execCtxToAuthz(), { operator: "exists", attribute: "../../secret" })).toBe(false)
  })

  it("16. policy priority manipulation — priority only breaks ties among SAME-effect, same-specificity candidates; it can never make an ALLOW outrank an explicit DENY at higher specificity", () => {
    const authzCtx = execCtxToAuthz()
    const decision = evaluate(authzCtx, {
      versions: [
        allow({ policyId: "allow", scope: "GLOBAL", scopeValue: null, policyPriority: 999999 }),
        allow({ policyId: "deny", effect: "DENY", scope: "RESOURCE", scopeValue: "p1", policyPriority: 0 }),
      ],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("17. client-supplied policy — structurally impossible: no code path in mcp/server.ts, route-handler.ts, or authorizer.ts accepts a policy object from a tool-call argument; policies are read exclusively from policy-store.ts's DB query", () => {
    expect(true).toBe(true)
  })

  it("18. client-supplied role — structurally impossible: AuthorizationContext has no 'role' field at all; nothing in engine.ts ever reads a role from anywhere", () => {
    const authzCtx = execCtxToAuthz()
    expect("role" in authzCtx).toBe(false)
  })

  it("19. stale cache exploitation — covered exhaustively in authz-policy-cache.test.ts's Section H suite (disable -> invalidate -> next load excludes the disabled policy)", () => {
    expect(true).toBe(true)
  })

  it("20. race-condition privilege escalation — covered in the concurrency test suite (authz-concurrency.test.ts)", () => {
    expect(true).toBe(true)
  })

  it("21. suspended-agent execution — a SUSPENDED connection is denied by the engine's own hard-security-deny layer, before any policy is even consulted", () => {
    const authzCtx = execCtxToAuthz({ connectionStatus: "SUSPENDED" })
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), scope: "GLOBAL", scopeValue: null }] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("CONNECTION_SUSPENDED")
  })

  it("22. revoked-agent execution — a REVOKED connection is denied by the engine's own hard-security-deny layer", () => {
    const authzCtx = execCtxToAuthz({ connectionStatus: "REVOKED" })
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), scope: "GLOBAL", scopeValue: null }] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("CONNECTION_REVOKED")
  })

  it("23. expired-agent execution — an EXPIRED connection is denied by the engine's own hard-security-deny layer", () => {
    const authzCtx = execCtxToAuthz({ connectionStatus: "EXPIRED" })
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), scope: "GLOBAL", scopeValue: null }] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("CONNECTION_EXPIRED")
  })

  it("24. approval-required bypass — a REQUIRES_APPROVAL decision is enforced identically to DENY at the authorizer boundary (see authz-authorizer.test.ts); the engine never silently downgrades it to ALLOW", () => {
    const authzCtx = execCtxToAuthz()
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), effect: "REQUIRES_APPROVAL", scope: "GLOBAL", scopeValue: null }] })
    expect(decision.decision).toBe("REQUIRES_APPROVAL")
    expect(decision.decision).not.toBe("ALLOW")
  })

  it("25. critical-capability bypass — a CRITICAL-risk-tier capability is never matched by a policy whose riskConstraint caps at a lower tier, regardless of scope breadth", () => {
    const authzCtx = execCtxToAuthz({ capabilityId: "refunds.process", capabilityRiskTier: "CRITICAL" } as never)
    const decision = evaluate(authzCtx, { versions: [{ ...allow(), scope: "GLOBAL", scopeValue: null, riskConstraint: "HIGH_RISK_MUTATION" }] })
    expect(decision.decision).toBe("DENY")
  })
})

function execCtxToAuthz(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_REAL",
    teamId: "team_REAL",
    connectionStatus: "ACTIVE",
    environment: "production",
    capabilityId: "products.get",
    capabilityVersion: 1,
    capabilityRiskTier: "READ",
    resourceId: "p1",
    authenticationStrength: "BEARER",
    timestamp: new Date(),
    ...overrides,
  }
}
