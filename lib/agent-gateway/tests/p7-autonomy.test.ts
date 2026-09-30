/**
 * Phase 7 — Section A (autonomy levels), Section H (escalation resistance,
 * evaluator side), Section J (environment), Section K (resource scope),
 * Section I (authorization + autonomy precedence).
 *
 * `resolveAutonomyDecision` is pure, so it is tested directly and
 * exhaustively; the policy store is tested against the Phase 7 fake DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveAutonomyDecision } from "../autonomy/evaluator"
import { mandatoryApprovalReason } from "../autonomy/approval-requirements"
import { AUTONOMY_LEVELS } from "../autonomy/types"
import type { RiskTier } from "../capabilities/types"
import { ALLOW, DENY, REQUIRES_APPROVAL, UNAVAILABLE, cap, policy, tierCap } from "./p7-helpers"
import { createApprovalFakeDb } from "./approval-fake-db"

const now = new Date("2026-09-29T12:00:00.000Z")
const TIERS: RiskTier[] = ["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"]

function run(level: string, tier: RiskTier, extra: Partial<Parameters<typeof resolveAutonomyDecision>[0]> = {}) {
  return resolveAutonomyDecision({
    capability: tierCap(tier),
    authorization: ALLOW,
    policy: policy({ autonomyLevel: level }),
    environment: "development",
    now,
    ...extra,
  })
}

describe("Section A — autonomy level matrix", () => {
  // Expected outcome per level x tier, BEFORE mandatory gates. CRITICAL and
  // the financial/irreversible HIGH-tier fixture always hit a mandatory gate,
  // so their expected non-deny outcome is REQUIRE_APPROVAL.
  const expected: Record<string, Record<RiskTier, string>> = {
    OBSERVE_ONLY: { READ: "ALLOW_AUTONOMOUS", LOW_RISK_WRITE: "DENY", HIGH_RISK_MUTATION: "DENY", CRITICAL: "DENY" },
    ASSISTED: { READ: "ALLOW_AUTONOMOUS", LOW_RISK_WRITE: "REQUIRE_APPROVAL", HIGH_RISK_MUTATION: "DENY", CRITICAL: "DENY" },
    APPROVAL_REQUIRED: { READ: "ALLOW_AUTONOMOUS", LOW_RISK_WRITE: "REQUIRE_APPROVAL", HIGH_RISK_MUTATION: "REQUIRE_APPROVAL", CRITICAL: "REQUIRE_APPROVAL" },
    LIMITED_AUTONOMY: { READ: "ALLOW_AUTONOMOUS", LOW_RISK_WRITE: "ALLOW_AUTONOMOUS", HIGH_RISK_MUTATION: "REQUIRE_APPROVAL", CRITICAL: "REQUIRE_APPROVAL" },
    FULL_SCOPED_AUTONOMY: { READ: "ALLOW_AUTONOMOUS", LOW_RISK_WRITE: "ALLOW_AUTONOMOUS", HIGH_RISK_MUTATION: "ALLOW_AUTONOMOUS", CRITICAL: "REQUIRE_APPROVAL" },
  }
  for (const level of AUTONOMY_LEVELS) {
    for (const tier of TIERS) {
      it(`${level} x ${tier} -> ${expected[level][tier]}`, () => {
        expect(run(level, tier).outcome).toBe(expected[level][tier])
      })
    }
  }

  it("no policy -> OBSERVE_ONLY default: reads allowed, every mutation denied", () => {
    for (const tier of TIERS) {
      const d = resolveAutonomyDecision({ capability: tierCap(tier), authorization: ALLOW, policy: null, environment: "development", now })
      expect(d.effectiveLevel).toBe("OBSERVE_ONLY")
      expect(d.policyVersion).toBeNull()
      expect(d.outcome).toBe(tier === "READ" ? "ALLOW_AUTONOMOUS" : "DENY")
    }
  })

  it("disabled / superseded / expired policy collapses to the OBSERVE_ONLY default", () => {
    for (const p of [policy({ status: "DISABLED" }), policy({ status: "SUPERSEDED" }), policy({ expiresAt: new Date(now.getTime() - 1) }), policy({ expiresAt: now })]) {
      const d = resolveAutonomyDecision({ capability: tierCap("LOW_RISK_WRITE"), authorization: ALLOW, policy: p, environment: "development", now })
      expect(d.effectiveLevel).toBe("OBSERVE_ONLY")
      expect(d.outcome).toBe("DENY")
    }
  })

  it("malformed stored level or risk tier is denied, never guessed", () => {
    expect(run("SUPER_AUTONOMY", "READ").reasonCode).toBe("INVALID_AUTONOMY_POLICY")
    const d = resolveAutonomyDecision({ capability: tierCap("READ"), authorization: ALLOW, policy: policy({ maxRiskTier: "ANY" }), environment: "development", now })
    expect(d.outcome).toBe("DENY")
    expect(d.reasonCode).toBe("INVALID_AUTONOMY_POLICY")
  })

  it("risk above the policy ceiling is denied even at FULL_SCOPED_AUTONOMY", () => {
    const d = resolveAutonomyDecision({ capability: tierCap("HIGH_RISK_MUTATION"), authorization: ALLOW, policy: policy({ autonomyLevel: "FULL_SCOPED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE" }), environment: "development", now })
    expect(d.outcome).toBe("DENY")
    expect(d.reasonCode).toBe("RISK_ABOVE_AUTONOMY_THRESHOLD")
  })

  it("capability allowlist excludes everything else", () => {
    const d = resolveAutonomyDecision({ capability: cap("products.list"), authorization: ALLOW, policy: policy({ allowedCapabilityIds: ["products.get"] }), environment: "development", now })
    expect(d.reasonCode).toBe("CAPABILITY_OUT_OF_SCOPE")
  })

  it("non-agent-available or inactive capabilities are denied regardless of level", () => {
    for (const c of [cap("products.updatePricing"), cap("products.get", { status: "DISABLED" as never })]) {
      const d = resolveAutonomyDecision({ capability: c, authorization: ALLOW, policy: policy({ autonomyLevel: "FULL_SCOPED_AUTONOMY" }), environment: "development", now })
      expect(d.outcome).toBe("DENY")
    }
  })

  it("is deterministic — identical input, identical output", () => {
    const a = run("LIMITED_AUTONOMY", "HIGH_RISK_MUTATION")
    const b = run("LIMITED_AUTONOMY", "HIGH_RISK_MUTATION")
    expect(a).toEqual(b)
  })
})

describe("Section A — mandatory approval gates cannot be removed by any level", () => {
  it("CRITICAL always requires approval (never autonomous)", () => {
    for (const level of ["APPROVAL_REQUIRED", "LIMITED_AUTONOMY", "FULL_SCOPED_AUTONOMY"]) {
      const d = run(level, "CRITICAL")
      expect(d.outcome).toBe("REQUIRE_APPROVAL")
      expect(d.mandatoryApproval).toBe(true)
    }
  })

  it("irreversible, financial and production-deployment mutations are mandatory gates", () => {
    expect(mandatoryApprovalReason(cap("refunds.process"), "development")).toBe("CRITICAL_RISK_TIER")
    expect(mandatoryApprovalReason(tierCap("LOW_RISK_WRITE", { rollback: { reversibility: "IRREVERSIBLE", mechanism: "none" } }), "development")).toBe("IRREVERSIBLE_OPERATION")
    expect(mandatoryApprovalReason(tierCap("LOW_RISK_WRITE", { domain: "payments" }), "development")).toBe("FINANCIAL_OPERATION")
    expect(mandatoryApprovalReason(tierCap("LOW_RISK_WRITE", { sideEffects: { effects: ["external payment capture"] } }), "development")).toBe("FINANCIAL_OPERATION")
    expect(mandatoryApprovalReason(tierCap("LOW_RISK_WRITE", { domain: "deployments" }), "production")).toBe("PRODUCTION_DEPLOYMENT")
    expect(mandatoryApprovalReason(tierCap("LOW_RISK_WRITE", { domain: "deployments" }), "development")).toBeNull()
    expect(mandatoryApprovalReason(cap("products.get"), "production")).toBeNull()
  })

  it("FULL_SCOPED_AUTONOMY still requires approval for a financial LOW_RISK_WRITE", () => {
    const d = resolveAutonomyDecision({ capability: tierCap("LOW_RISK_WRITE", { domain: "billing" }), authorization: ALLOW, policy: policy({ autonomyLevel: "FULL_SCOPED_AUTONOMY" }), environment: "development", now })
    expect(d.outcome).toBe("REQUIRE_APPROVAL")
    expect(d.reasonCode).toBe("APPROVAL_REQUIRED_MANDATORY")
  })

  it("per-connection approvalRequiredFor forces approval even for a READ", () => {
    const d = resolveAutonomyDecision({ capability: cap("products.get"), authorization: ALLOW, policy: policy({ autonomyLevel: "FULL_SCOPED_AUTONOMY", approvalRequiredFor: ["products.get"] }), environment: "development", now })
    expect(d.outcome).toBe("REQUIRE_APPROVAL")
  })
})

describe("Section I — authorization and autonomy precedence", () => {
  it("Phase 6 DENY is never overridden by any autonomy level", () => {
    for (const level of AUTONOMY_LEVELS) {
      const d = run(level, "READ", { authorization: DENY })
      expect(d.outcome).toBe("DENY")
      expect(d.reasonCode).toBe("AUTHORIZATION_DENIED")
    }
  })

  it("Phase 6 POLICY_UNAVAILABLE and store failure both fail closed", () => {
    expect(run("FULL_SCOPED_AUTONOMY", "READ", { authorization: UNAVAILABLE }).outcome).toBe("POLICY_UNAVAILABLE")
    expect(run("FULL_SCOPED_AUTONOMY", "READ", { policyUnavailable: true }).outcome).toBe("POLICY_UNAVAILABLE")
  })

  it("Phase 6 REQUIRES_APPROVAL turns an otherwise autonomous call into an approval request", () => {
    const d = run("FULL_SCOPED_AUTONOMY", "READ", { authorization: REQUIRES_APPROVAL })
    expect(d.outcome).toBe("REQUIRE_APPROVAL")
    expect(d.reasonCode).toBe("APPROVAL_REQUIRED_BY_AUTHORIZATION")
  })

  it("Phase 6 REQUIRES_APPROVAL cannot lift an autonomy DENY (OBSERVE_ONLY mutation)", () => {
    expect(run("OBSERVE_ONLY", "LOW_RISK_WRITE", { authorization: REQUIRES_APPROVAL }).outcome).toBe("DENY")
  })
})

describe("Section J — environment scope", () => {
  it("an environment outside the policy scope is denied", () => {
    const d = run("FULL_SCOPED_AUTONOMY", "READ", { policy: policy({ environmentScope: ["development"] }), environment: "production" })
    expect(d.reasonCode).toBe("ENVIRONMENT_BLOCKED")
  })
  it("an environment inside the scope is evaluated normally", () => {
    expect(run("FULL_SCOPED_AUTONOMY", "READ", { policy: policy({ environmentScope: ["development"] }) }).outcome).toBe("ALLOW_AUTONOMOUS")
  })
})

describe("Section K — resource scope", () => {
  const withScope = (scope: string, resourceType: string | null, resourceId: string | null) =>
    resolveAutonomyDecision({ capability: cap("products.get"), authorization: ALLOW, policy: policy({ resourceScopeReference: scope }), environment: "development", now, resourceType, resourceId })

  it("exact resource in scope is allowed; a different resource is denied", () => {
    expect(withScope("Product:p1", "Product", "p1").outcome).toBe("ALLOW_AUTONOMOUS")
    expect(withScope("Product:p1", "Product", "p2").reasonCode).toBe("RESOURCE_OUT_OF_SCOPE")
  })
  it("wildcard covers any id of the same type only", () => {
    expect(withScope("Product:*", "Product", "anything").outcome).toBe("ALLOW_AUTONOMOUS")
    expect(withScope("Product:*", "Ticket", "t1").reasonCode).toBe("RESOURCE_OUT_OF_SCOPE")
  })
  it("a specific scope with no resource id (list operation) is denied", () => {
    expect(withScope("Product:p1", "Product", null).reasonCode).toBe("RESOURCE_OUT_OF_SCOPE")
  })
  it("a malformed scope reference is denied as an invalid policy", () => {
    expect(withScope("Product", "Product", "p1").reasonCode).toBe("INVALID_AUTONOMY_POLICY")
  })
})

describe("Autonomy policy store (fake DB) — versioning and immediate downgrade", () => {
  beforeEach(() => vi.resetModules())

  async function setupStore() {
    const fake = createApprovalFakeDb()
    fake.seedConnection({ id: "conn_1" })
    const merged = { ...fake.client }
    fake.setTransactionTarget(merged)
    vi.doMock("@/lib/db", () => ({ db: merged }))
    const store = await import("../autonomy/policy-store")
    return { fake, store }
  }

  it("no policy -> null (evaluator default applies)", async () => {
    const { store } = await setupStore()
    expect(await store.loadEffectiveAutonomyPolicy("conn_1")).toBeNull()
  })

  it("set creates version N+1 and supersedes N; downgrade is visible on the very next read (no cache)", async () => {
    const { store, fake } = await setupStore()
    await store.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "HIGH_RISK_MUTATION", actorId: "admin_1" })
    expect((await store.loadEffectiveAutonomyPolicy("conn_1"))?.autonomyLevel).toBe("LIMITED_AUTONOMY")
    await store.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", actorId: "admin_1" })
    const eff = await store.loadEffectiveAutonomyPolicy("conn_1")
    expect(eff?.autonomyLevel).toBe("ASSISTED")
    expect(eff?.version).toBe(2)
    const statuses = Array.from(fake._autonomy.values()).map((r) => `${r.version}:${r.status}`).sort()
    expect(statuses).toEqual(["1:SUPERSEDED", "2:ACTIVE"])
  })

  it("disable falls back to the OBSERVE_ONLY default immediately", async () => {
    const { store } = await setupStore()
    await store.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "FULL_SCOPED_AUTONOMY", maxRiskTier: "CRITICAL", actorId: "admin_1" })
    await store.disableAutonomyPolicy("conn_1")
    expect(await store.loadEffectiveAutonomyPolicy("conn_1")).toBeNull()
  })

  it("rejects invalid levels / tiers and unknown connections", async () => {
    const { store } = await setupStore()
    await expect(store.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "GOD_MODE" as never, maxRiskTier: "READ", actorId: "a" })).rejects.toThrow()
    await expect(store.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "ASSISTED", maxRiskTier: "ALL" as never, actorId: "a" })).rejects.toThrow()
    await expect(store.setAutonomyPolicy({ connectionId: "nope", autonomyLevel: "ASSISTED", maxRiskTier: "READ", actorId: "a" })).rejects.toThrow("Connection not found.")
  })
})
