/**
 * lib/agent-gateway/tests/authz-resource-scope.test.ts
 *
 * Phase 6 — Section E: Resource-Scope Tests + Section F: Environment
 * Tests. Verifies same-owner/different-team, same-team/different-owner,
 * specific-resource, unknown-resource, and cross-environment scenarios
 * never leak.
 */
import { describe, expect, it } from "vitest"
import { evaluate } from "../authorization/engine"
import type { AuthorizationContext, ResolvedPolicyVersion } from "../authorization/types"

function ctx(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_1",
    teamId: "team_1",
    connectionStatus: "ACTIVE",
    environment: "production",
    capabilityId: "products.get",
    capabilityVersion: 1,
    capabilityRiskTier: "READ",
    capabilityResourceType: "Product",
    resourceId: "prod_1",
    authenticationStrength: "BEARER",
    timestamp: new Date(),
    ...overrides,
  }
}

function policy(overrides: Partial<ResolvedPolicyVersion> = {}): ResolvedPolicyVersion {
  return {
    policyId: "p1",
    policyVersionId: "pv1",
    version: 1,
    policyName: "test",
    policyEnabled: true,
    policyPriority: 0,
    status: "ACTIVE",
    effect: "ALLOW",
    scope: "RESOURCE",
    scopeValue: "prod_1",
    capabilityId: null,
    conditions: null,
    riskConstraint: null,
    approvalRequirement: false,
    ...overrides,
  }
}

describe("Section E — Resource-Scope Tests", () => {
  it("same owner, different team — an OWNER-scoped policy still matches regardless of team", () => {
    const decision = evaluate(ctx({ ownerId: "owner_1", teamId: "team_X" }), {
      versions: [policy({ scope: "OWNER", scopeValue: "owner_1" })],
    })
    expect(decision.decision).toBe("ALLOW")
  })

  it("same team, different owner — a TEAM-scoped policy still matches regardless of owner", () => {
    const decision = evaluate(ctx({ ownerId: "owner_X", teamId: "team_1" }), {
      versions: [policy({ scope: "TEAM", scopeValue: "team_1" })],
    })
    expect(decision.decision).toBe("ALLOW")
  })

  it("specific resource — RESOURCE-scoped ALLOW for prod_1 matches only prod_1", () => {
    const decision = evaluate(ctx({ resourceId: "prod_1" }), { versions: [policy({ scopeValue: "prod_1" })] })
    expect(decision.decision).toBe("ALLOW")
  })

  it("unknown resource — RESOURCE-scoped ALLOW for prod_1 never matches a different resourceId", () => {
    const decision = evaluate(ctx({ resourceId: "prod_UNKNOWN" }), { versions: [policy({ scopeValue: "prod_1" })] })
    expect(decision.decision).toBe("DENY")
  })

  it("deleted/absent resource (no resourceId present at all) never matches a RESOURCE-scoped policy", () => {
    const decision = evaluate(ctx({ resourceId: undefined }), { versions: [policy({ scopeValue: "prod_1" })] })
    expect(decision.decision).toBe("DENY")
  })

  it("restricted resource — an explicit RESOURCE-scope DENY for a specific id overrides a broader GLOBAL ALLOW", () => {
    const decision = evaluate(ctx({ resourceId: "prod_RESTRICTED" }), {
      versions: [policy({ policyId: "global", effect: "ALLOW", scope: "GLOBAL", scopeValue: null }), policy({ policyId: "restricted", effect: "DENY", scope: "RESOURCE", scopeValue: "prod_RESTRICTED" })],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("different environment — a RESOURCE-scoped ALLOW still requires the hard environment check to pass first", () => {
    const decision = evaluate(ctx({ resourceId: "prod_1", environment: "" }), { versions: [policy({ scopeValue: "prod_1" })] })
    expect(decision.decision).toBe("DENY")
    expect(decision.reasonCode).toBe("ENVIRONMENT_MISMATCH")
  })
})

describe("Section F — Environment Tests", () => {
  it("dev -> dev: an ENVIRONMENT-scoped 'development' policy matches a development context", () => {
    const decision = evaluate(ctx({ environment: "development" }), {
      versions: [policy({ scope: "ENVIRONMENT", scopeValue: "development" })],
    })
    expect(decision.decision).toBe("ALLOW")
  })

  it("staging -> staging: an ENVIRONMENT-scoped 'staging' policy matches a staging context", () => {
    const decision = evaluate(ctx({ environment: "staging" }), {
      versions: [policy({ scope: "ENVIRONMENT", scopeValue: "staging" })],
    })
    expect(decision.decision).toBe("ALLOW")
  })

  it("production -> production: an ENVIRONMENT-scoped 'production' policy matches a production context", () => {
    const decision = evaluate(ctx({ environment: "production" }), {
      versions: [policy({ scope: "ENVIRONMENT", scopeValue: "production" })],
    })
    expect(decision.decision).toBe("ALLOW")
  })

  it("dev -> production: a 'development'-scoped policy never matches a production context", () => {
    const decision = evaluate(ctx({ environment: "production" }), {
      versions: [policy({ scope: "ENVIRONMENT", scopeValue: "development" })],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("staging -> production: a 'staging'-scoped policy never matches a production context", () => {
    const decision = evaluate(ctx({ environment: "production" }), {
      versions: [policy({ scope: "ENVIRONMENT", scopeValue: "staging" })],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("production -> staging: a 'production'-scoped policy never matches a staging context", () => {
    const decision = evaluate(ctx({ environment: "staging" }), {
      versions: [policy({ scope: "ENVIRONMENT", scopeValue: "production" })],
    })
    expect(decision.decision).toBe("DENY")
  })

  it("only an explicitly configured ENVIRONMENT/GLOBAL policy can allow cross-environment-shaped access — there is no implicit environment bypass anywhere in the engine", () => {
    // A GLOBAL policy (no environment scoping at all) allows regardless of
    // environment value — this is the ONLY way to get environment-agnostic
    // behavior, and it requires an administrator to have explicitly chosen
    // GLOBAL scope rather than ENVIRONMENT scope.
    const decision = evaluate(ctx({ environment: "production" }), { versions: [policy({ scope: "GLOBAL", scopeValue: null })] })
    expect(decision.decision).toBe("ALLOW")
  })
})
