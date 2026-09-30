/**
 * lib/agent-gateway/tests/authz-policy-language.test.ts
 *
 * Direct tests of policy-language.ts's `evaluateCondition()` and
 * `assertWellFormedCondition()` — the constrained ABAC operator set and
 * the "never executable code" guard.
 */
import { describe, expect, it } from "vitest"
import { evaluateCondition, assertWellFormedCondition } from "../authorization/policy-language"
import type { AuthorizationContext } from "../authorization/types"

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
    existingPermission: "read:products",
    authenticationStrength: "BEARER",
    timestamp: new Date(),
    ...overrides,
  }
}

describe("evaluateCondition — never executes code, closed operator set", () => {
  it("null/undefined condition always matches (no restriction)", () => {
    expect(evaluateCondition(ctx(), null)).toBe(true)
    expect(evaluateCondition(ctx(), undefined)).toBe(true)
  })

  it("unknown attribute name resolves to undefined, never throws", () => {
    expect(evaluateCondition(ctx(), { operator: "equals", attribute: "subject.__proto__", value: "x" })).toBe(false)
  })

  it("prototype-pollution-shaped attribute name is not a valid resolver key — never matches", () => {
    expect(evaluateCondition(ctx(), { operator: "exists", attribute: "constructor" })).toBe(false)
  })

  it("SQL-payload-shaped value is treated as an inert string, never executed", () => {
    expect(evaluateCondition(ctx({ ownerId: "owner_1" }), { operator: "equals", attribute: "subject.ownerId", value: "'; DROP TABLE users; --" })).toBe(false)
  })

  it("a condition node with a function-shaped value (from a forged JSON payload) never gets called — TS types block it, and JSON.parse could never produce a function", () => {
    // A malformed payload attempting to inject a function is structurally
    // impossible via the ConditionNode type / JSON round-trip. This test
    // documents that invariant rather than needing runtime injection
    // (there is no code path where a function VALUE could reach evaluateCondition).
    const node = JSON.parse(JSON.stringify({ operator: "equals", attribute: "subject.ownerId", value: "owner_1" }))
    expect(evaluateCondition(ctx(), node)).toBe(true)
  })

  it("deeply malformed node (random object shape) never matches, never throws", () => {
    // @ts-expect-error deliberately malformed
    expect(evaluateCondition(ctx(), { foo: "bar" })).toBe(false)
  })

  it("and/or/not compose correctly", () => {
    const c = ctx({ environment: "production", capabilityRiskTier: "READ" })
    expect(
      evaluateCondition(c, {
        and: [
          { operator: "equals", attribute: "environment.name", value: "production" },
          { or: [{ operator: "equals", attribute: "action.riskTier", value: "READ" }, { operator: "equals", attribute: "action.riskTier", value: "CRITICAL" }] },
          { not: { operator: "equals", attribute: "action.riskTier", value: "CRITICAL" } },
        ],
      })
    ).toBe(true)
  })

  it("and with a non-array value never matches", () => {
    // @ts-expect-error deliberately malformed
    expect(evaluateCondition(ctx(), { and: "not-an-array" })).toBe(false)
  })
})

describe("assertWellFormedCondition — write-path guard", () => {
  it("accepts a well-formed leaf", () => {
    expect(() => assertWellFormedCondition({ operator: "equals", attribute: "subject.ownerId", value: "owner_1" })).not.toThrow()
  })

  it("accepts null (no condition)", () => {
    expect(() => assertWellFormedCondition(null)).not.toThrow()
  })

  it("rejects an unrecognized operator", () => {
    expect(() => assertWellFormedCondition({ operator: "eval", attribute: "subject.ownerId", value: "x" })).toThrow(/Unrecognized condition operator/)
  })

  it("rejects an unrecognized attribute", () => {
    expect(() => assertWellFormedCondition({ operator: "equals", attribute: "__proto__.polluted", value: "x" })).toThrow(/Unrecognized condition attribute/)
  })

  it("rejects a leaf missing a value when the operator requires one", () => {
    expect(() => assertWellFormedCondition({ operator: "equals", attribute: "subject.ownerId" })).toThrow(/requires a "value"/)
  })

  it("accepts exists without a value", () => {
    expect(() => assertWellFormedCondition({ operator: "exists", attribute: "subject.teamId" })).not.toThrow()
  })

  it("rejects excessive nesting depth (DoS-shaped payload)", () => {
    let node: unknown = { operator: "exists", attribute: "subject.ownerId" }
    for (let i = 0; i < 20; i++) node = { not: node }
    expect(() => assertWellFormedCondition(node)).toThrow(/maximum nesting depth/)
  })

  it("rejects a non-object node", () => {
    expect(() => assertWellFormedCondition("just a string")).toThrow()
  })

  it("rejects an array as a bare node", () => {
    expect(() => assertWellFormedCondition([{ operator: "exists", attribute: "subject.ownerId" }])).toThrow()
  })
})
