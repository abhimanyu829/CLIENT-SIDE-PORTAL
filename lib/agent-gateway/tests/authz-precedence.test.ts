/**
 * lib/agent-gateway/tests/authz-precedence.test.ts
 *
 * Direct tests of precedence.ts's `resolvePrecedence()` — deterministic
 * ordering, tie-breaking, and the exact stage classification.
 */
import { describe, expect, it } from "vitest"
import { resolvePrecedence } from "../authorization/precedence"
import type { ResolvedPolicyVersion } from "../authorization/types"

function v(overrides: Partial<ResolvedPolicyVersion> = {}): ResolvedPolicyVersion {
  return {
    policyId: "p1",
    policyVersionId: "pv1",
    version: 1,
    policyName: "test",
    policyEnabled: true,
    policyPriority: 0,
    status: "ACTIVE",
    effect: "ALLOW",
    scope: "GLOBAL",
    scopeValue: null,
    capabilityId: null,
    conditions: null,
    riskConstraint: null,
    approvalRequirement: false,
    ...overrides,
  }
}

describe("resolvePrecedence", () => {
  it("empty candidate set resolves to DEFAULT_DENY", () => {
    const result = resolvePrecedence([])
    expect(result.winner).toBeNull()
    expect(result.stage).toBe("DEFAULT_DENY")
  })

  it("a single ALLOW wins via MOST_SPECIFIC_ALLOW", () => {
    const result = resolvePrecedence([v({ effect: "ALLOW" })])
    expect(result.stage).toBe("MOST_SPECIFIC_ALLOW")
    expect(result.winner?.effect).toBe("ALLOW")
  })

  it("RESOURCE-scope DENY outranks everything else, including a RESOURCE-scope ALLOW", () => {
    const result = resolvePrecedence([
      v({ policyId: "allow", effect: "ALLOW", scope: "RESOURCE", scopeValue: "r1" }),
      v({ policyId: "deny", effect: "DENY", scope: "RESOURCE", scopeValue: "r1" }),
      v({ policyId: "global-allow", effect: "ALLOW", scope: "GLOBAL" }),
    ])
    expect(result.stage).toBe("RESOURCE_DENY")
    expect(result.winner?.policyId).toBe("deny")
  })

  it("CONNECTION-scope DENY outranks a CAPABILITY-scope ALLOW", () => {
    const result = resolvePrecedence([
      v({ policyId: "allow", effect: "ALLOW", scope: "CAPABILITY" }),
      v({ policyId: "deny", effect: "DENY", scope: "CONNECTION" }),
    ])
    expect(result.stage).toBe("CONNECTION_DENY")
    expect(result.winner?.policyId).toBe("deny")
  })

  it("APPROVAL_REQUIREMENT outranks a broader ALLOW", () => {
    const result = resolvePrecedence([v({ policyId: "allow", effect: "ALLOW", scope: "GLOBAL" }), v({ policyId: "approval", effect: "REQUIRES_APPROVAL", scope: "CAPABILITY" })])
    expect(result.stage).toBe("APPROVAL_REQUIREMENT")
  })

  it("most specific ALLOW wins over a broader ALLOW when no deny/approval exists", () => {
    const result = resolvePrecedence([v({ policyId: "broad", effect: "ALLOW", scope: "GLOBAL" }), v({ policyId: "specific", effect: "ALLOW", scope: "RESOURCE", scopeValue: "r1" })])
    expect(result.stage).toBe("MOST_SPECIFIC_ALLOW")
    expect(result.winner?.policyId).toBe("specific")
  })

  it("same-specificity ALLOWs break ties by priority (higher wins)", () => {
    const result = resolvePrecedence([
      v({ policyId: "low", effect: "ALLOW", scope: "GLOBAL", policyPriority: 1 }),
      v({ policyId: "high", effect: "ALLOW", scope: "GLOBAL", policyPriority: 10 }),
    ])
    expect(result.winner?.policyId).toBe("high")
  })

  it("same-specificity, same-priority ALLOWs break ties by lexicographically smaller policyId — deterministic, never order-dependent", () => {
    const resultA = resolvePrecedence([v({ policyId: "zzz", effect: "ALLOW", scope: "GLOBAL" }), v({ policyId: "aaa", effect: "ALLOW", scope: "GLOBAL" })])
    const resultB = resolvePrecedence([v({ policyId: "aaa", effect: "ALLOW", scope: "GLOBAL" }), v({ policyId: "zzz", effect: "ALLOW", scope: "GLOBAL" })])
    expect(resultA.winner?.policyId).toBe("aaa")
    expect(resultB.winner?.policyId).toBe("aaa")
  })

  it("a DENY at an unlisted scope (e.g. OWNER) still outranks any ALLOW", () => {
    const result = resolvePrecedence([v({ policyId: "allow", effect: "ALLOW", scope: "GLOBAL" }), v({ policyId: "deny", effect: "DENY", scope: "OWNER", scopeValue: "owner_1" })])
    expect(result.winner?.effect).toBe("DENY")
  })
})
