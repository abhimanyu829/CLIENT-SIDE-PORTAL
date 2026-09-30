/**
 * Phase 7 — Section B (state machine), Section C (binding + canonical JSON),
 * Section D (expiry), plus redaction of the human-facing summary.
 */
import { describe, expect, it } from "vitest"
import { APPROVAL_STATUSES, TERMINAL_APPROVAL_STATUSES, assertLegalApprovalTransition, isLegalApprovalTransition, isTerminalApprovalStatus } from "../approvals/state-machine"
import { CanonicalizationError, canonicalJson } from "../approvals/canonical-json"
import { activeBindingKey, computeBindingDigest, computeInputDigest, type OperationBinding } from "../approvals/binding"
import { STEP_UP_TTL_MS, approvalTtlMs, isExpired } from "../approvals/expiration"
import { REDACTED, buildDisplaySummary, redactValue } from "../approvals/redaction"
import { cap, tierCap } from "./p7-helpers"

describe("Section B — approval state machine", () => {
  const legal: Array<[string, string]> = [
    ["PENDING", "APPROVED"],
    ["PENDING", "REJECTED"],
    ["PENDING", "EXPIRED"],
    ["PENDING", "CANCELLED"],
    ["APPROVED", "CONSUMED"],
    ["APPROVED", "EXPIRED"],
    ["APPROVED", "CANCELLED"],
  ]
  it("exactly the documented transitions are legal", () => {
    for (const from of APPROVAL_STATUSES) {
      for (const to of APPROVAL_STATUSES) {
        const isLegal = legal.some(([f, t]) => f === from && t === to)
        expect(isLegalApprovalTransition(from, to), `${from}->${to}`).toBe(isLegal)
      }
    }
  })
  it("terminal states have no exits (no replay, no resurrection)", () => {
    for (const s of TERMINAL_APPROVAL_STATUSES) {
      expect(isTerminalApprovalStatus(s)).toBe(true)
      for (const to of APPROVAL_STATUSES) expect(isLegalApprovalTransition(s, to)).toBe(false)
    }
    expect(() => assertLegalApprovalTransition("CONSUMED", "APPROVED")).toThrow("Illegal approval transition")
    expect(() => assertLegalApprovalTransition("REJECTED", "APPROVED")).toThrow()
    expect(() => assertLegalApprovalTransition("PENDING", "CONSUMED")).toThrow() // cannot skip approval
  })
})

describe("Section C — canonical JSON", () => {
  it("key order does not matter", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }))
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })
  it("absent and null are different", () => {
    expect(canonicalJson({ a: undefined })).toBe("{}")
    expect(canonicalJson({ a: null })).toBe('{"a":null}')
    expect(canonicalJson({ a: undefined })).not.toBe(canonicalJson({ a: null }))
  })
  it("array order matters", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })
  it("types are not coerced: 1 vs \"1\" vs true differ", () => {
    const set = new Set([canonicalJson({ v: 1 }), canonicalJson({ v: "1" }), canonicalJson({ v: true })])
    expect(set.size).toBe(3)
  })
  it("rejects values with no stable representation", () => {
    for (const bad of [NaN, Infinity, -Infinity, BigInt(1), () => 1, Symbol("x"), new Date("invalid")]) {
      expect(() => canonicalJson({ v: bad })).toThrow(CanonicalizationError)
    }
  })
  it("rejects excessive nesting", () => {
    let deep: unknown = 1
    for (let i = 0; i < 40; i += 1) deep = { d: deep }
    expect(() => canonicalJson(deep)).toThrow(CanonicalizationError)
  })
  it("does not normalize Unicode (visually identical strings bind differently)", () => {
    expect(canonicalJson("\u00e9")).not.toBe(canonicalJson("e\u0301"))
  })
  it("dates serialize to ISO UTC", () => {
    expect(canonicalJson(new Date("2026-01-01T00:00:00Z"))).toBe('"2026-01-01T00:00:00.000Z"')
  })
})

describe("Section C — binding digest", () => {
  const base: OperationBinding = {
    connectionId: "conn_1",
    agentId: "agent_1",
    ownerId: "owner_1",
    teamId: null,
    capabilityId: "coupons.create",
    capabilityVersion: 1,
    resourceType: "Coupon",
    resourceId: null,
    environment: "development",
    inputDigest: computeInputDigest({ code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10 }),
    authorizationPolicyRef: "polver_1@v1",
    autonomyPolicyVersion: 1,
  }
  const digest = computeBindingDigest(base)

  it("is deterministic and 64 hex chars", () => {
    expect(computeBindingDigest({ ...base })).toBe(digest)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  const mutations: Array<[string, Partial<OperationBinding>]> = [
    ["connection", { connectionId: "conn_2" }],
    ["agent", { agentId: "agent_2" }],
    ["owner", { ownerId: "owner_2" }],
    ["team", { teamId: "team_1" }],
    ["capability", { capabilityId: "products.createDraft" }],
    ["capability version", { capabilityVersion: 2 }],
    ["resource type", { resourceType: "Product" }],
    ["resource id", { resourceId: "c1" }],
    ["environment", { environment: "production" }],
    ["input", { inputDigest: computeInputDigest({ code: "SAVE10", discountType: "PERCENTAGE", discountValue: 11 }) }],
    ["authorization policy", { authorizationPolicyRef: "polver_1@v2" }],
    ["autonomy policy", { autonomyPolicyVersion: 2 }],
    ["autonomy default vs v1", { autonomyPolicyVersion: null }],
  ]
  for (const [name, change] of mutations) {
    it(`changes when the ${name} changes`, () => {
      expect(computeBindingDigest({ ...base, ...change })).not.toBe(digest)
    })
  }

  it("input digest is key-order independent but value sensitive", () => {
    expect(computeInputDigest({ a: 1, b: 2 })).toBe(computeInputDigest({ b: 2, a: 1 }))
    expect(computeInputDigest({ a: 1 })).not.toBe(computeInputDigest({ a: "1" }))
    expect(computeInputDigest({ a: 1 })).not.toBe(computeInputDigest({ a: 1, extra: null }))
  })

  it("active binding key is scoped to the connection", () => {
    expect(activeBindingKey("conn_1", digest)).toBe(`conn_1:${digest}`)
    expect(activeBindingKey("conn_2", digest)).not.toBe(activeBindingKey("conn_1", digest))
  })
})

describe("Section D — expiry", () => {
  const MIN = 60_000
  it("TTL shrinks with risk and is capped for production and irreversible operations", () => {
    expect(approvalTtlMs(tierCap("READ"), "development")).toBe(30 * MIN)
    expect(approvalTtlMs(tierCap("LOW_RISK_WRITE"), "development")).toBe(30 * MIN)
    expect(approvalTtlMs(tierCap("HIGH_RISK_MUTATION"), "development")).toBe(15 * MIN)
    expect(approvalTtlMs(tierCap("CRITICAL"), "development")).toBe(10 * MIN)
    expect(approvalTtlMs(tierCap("LOW_RISK_WRITE"), "production")).toBe(15 * MIN)
    expect(approvalTtlMs(tierCap("LOW_RISK_WRITE", { rollback: { reversibility: "IRREVERSIBLE", mechanism: "none" } }), "development")).toBe(10 * MIN)
    expect(STEP_UP_TTL_MS).toBe(5 * MIN)
  })
  it("boundary: exactly at expiresAt counts as expired; 1ms before does not", () => {
    const exp = new Date("2026-09-29T12:00:00.000Z")
    expect(isExpired(exp, new Date(exp.getTime() - 1))).toBe(false)
    expect(isExpired(exp, exp)).toBe(true)
    expect(isExpired(exp, new Date(exp.getTime() + 1))).toBe(true)
  })
})

describe("Redaction of the human-facing summary", () => {
  it("redacts secret-looking keys at any depth and truncates long strings", () => {
    const out = redactValue({ password: "p", nested: { apiKey: "k", ok: "v", token: "t" }, long: "x".repeat(500) }) as Record<string, unknown>
    expect(out.password).toBe(REDACTED)
    expect((out.nested as Record<string, unknown>).apiKey).toBe(REDACTED)
    expect((out.nested as Record<string, unknown>).token).toBe(REDACTED)
    expect((out.nested as Record<string, unknown>).ok).toBe("v")
    expect((out.long as string).length).toBeLessThan(250)
  })
  it("summary shows material inputs, risk and consequence but never a credential", () => {
    const s = buildDisplaySummary({
      capability: cap("coupons.create"),
      connectionName: "Claude",
      agentId: "agent_1",
      ownerId: "owner_1",
      teamId: null,
      environment: "production",
      resourceType: "Coupon",
      resourceId: null,
      autonomyLevel: "ASSISTED",
      input: { code: "SAVE10", discountValue: 10, secret: "agw_abc" },
    })
    expect(s.riskTier).toBe("LOW_RISK_WRITE")
    expect(s.environment).toBe("production")
    expect((s.inputs as Record<string, unknown>).code).toBe("SAVE10")
    expect(JSON.stringify(s)).not.toContain("agw_abc")
    expect(String(s.consequence)).toContain("exactly once")
  })
})
