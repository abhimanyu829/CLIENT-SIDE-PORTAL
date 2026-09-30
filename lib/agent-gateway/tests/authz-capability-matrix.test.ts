/**
 * lib/agent-gateway/tests/authz-capability-matrix.test.ts
 *
 * Phase 6 — Section D: Capability Authorization Tests. Verifies each
 * capability is evaluated INDEPENDENTLY per connection — Agent A having
 * products.read=ALLOW does not imply products.update=ALLOW, and Agent B
 * having products.update=ALLOW does not imply products.delete=ALLOW.
 */
import { describe, expect, it } from "vitest"
import { evaluate } from "../authorization/engine"
import type { AuthorizationContext, ResolvedPolicyVersion } from "../authorization/types"

function ctx(connectionId: string, capabilityId: string, riskTier: AuthorizationContext["capabilityRiskTier"] = "READ"): AuthorizationContext {
  return {
    requestId: "req_1",
    connectionId,
    ownerId: `owner_of_${connectionId}`,
    teamId: null,
    connectionStatus: "ACTIVE",
    environment: "production",
    capabilityId,
    capabilityVersion: 1,
    capabilityRiskTier: riskTier,
    authenticationStrength: "BEARER",
    timestamp: new Date(),
  }
}

function allowFor(connectionId: string, capabilityId: string): ResolvedPolicyVersion {
  return {
    policyId: `policy_${connectionId}_${capabilityId}`,
    policyVersionId: `pv_${connectionId}_${capabilityId}`,
    version: 1,
    policyName: `allow ${capabilityId} for ${connectionId}`,
    policyEnabled: true,
    policyPriority: 0,
    status: "ACTIVE",
    effect: "ALLOW",
    scope: "CONNECTION",
    scopeValue: connectionId,
    capabilityId,
    conditions: null,
    riskConstraint: null,
    approvalRequirement: false,
  }
}

describe("Section D — Capability Authorization Matrix", () => {
  const policySet = {
    versions: [allowFor("conn_A", "products.read"), allowFor("conn_B", "products.read"), allowFor("conn_B", "products.update")],
  }

  it("Agent A: products.read = ALLOW", () => {
    expect(evaluate(ctx("conn_A", "products.read"), policySet).decision).toBe("ALLOW")
  })

  it("Agent A: products.update = DENY (no policy grants it)", () => {
    expect(evaluate(ctx("conn_A", "products.update"), policySet).decision).toBe("DENY")
  })

  it("Agent B: products.read = ALLOW", () => {
    expect(evaluate(ctx("conn_B", "products.read"), policySet).decision).toBe("ALLOW")
  })

  it("Agent B: products.update = ALLOW", () => {
    expect(evaluate(ctx("conn_B", "products.update"), policySet).decision).toBe("ALLOW")
  })

  it("Agent B: products.delete = DENY (no policy grants it, even though update+read are both granted)", () => {
    expect(evaluate(ctx("conn_B", "products.delete"), policySet).decision).toBe("DENY")
  })

  it("Agent A's products.read grant never leaks to Agent A's products.update (each capability independent within the same connection)", () => {
    const d1 = evaluate(ctx("conn_A", "products.read"), policySet)
    const d2 = evaluate(ctx("conn_A", "products.update"), policySet)
    expect(d1.decision).toBe("ALLOW")
    expect(d2.decision).toBe("DENY")
  })
})
