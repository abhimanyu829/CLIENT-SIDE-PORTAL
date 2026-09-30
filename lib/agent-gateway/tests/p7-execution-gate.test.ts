/**
 * Phase 7 — the execution gate (Section I precedence, Section L policy-change
 * races, Section M/N consumption, Section O connection lifecycle, Section Q
 * error contract, fail-closed behavior). Uses the REAL gate, REAL approval
 * services and REAL human decision service over the Phase 7 fake DB, with a
 * scripted Phase 6 decider so each authorization outcome can be forced.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApprovalFakeDb } from "./approval-fake-db"
import { ALLOW, DENY, REQUIRES_APPROVAL, UNAVAILABLE, codeOf, execCtx, policy, tierCap } from "./p7-helpers"
import type { AuthorizationDecision } from "../authorization/types"
import type { EffectiveAutonomyPolicy } from "../autonomy/types"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"

const T0 = new Date("2026-09-29T12:00:00.000Z")
const SUPER = { userId: "admin_1", role: "SUPER_ADMIN", sessionReference: "sess_1" }
const COUPON = { code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10 }

async function setup() {
  vi.resetModules()
  const fake = createApprovalFakeDb()
  fake.seedConnection({ id: "conn_1", name: "Claude" })
  fake.seedUser({ id: "admin_1", phone: "+919999999999", phoneVerified: true })
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))

  const { ExecutionGate } = await import("../execution-gate/gate")
  const { AuthorizationDeniedError } = await import("../mcp/errors")
  const decisions = await import("../approvals/decision-service")

  const state = {
    authz: ALLOW as AuthorizationDecision,
    authzThrows: false,
    policy: policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE" }) as EffectiveAutonomyPolicy | null,
    policyThrows: false,
    now: T0,
  }
  const decide = vi.fn(async () => {
    if (state.authzThrows) throw new Error("boom")
    return state.authz
  })
  const gate = new ExecutionGate({
    authorization: { decide },
    loadAutonomyPolicy: async () => {
      if (state.policyThrows) throw new Error("db down")
      return state.policy
    },
    clock: () => state.now,
  })

  async function call(capability: CapabilityDefinition = tierCap("LOW_RISK_WRITE"), input: unknown = COUPON, ctx: Partial<AgentExecutionContext> = {}) {
    try {
      await gate.authorize(execCtx(ctx), capability, input, {})
      return { allowed: true as const, code: null, message: "" }
    } catch (err) {
      if (!(err instanceof AuthorizationDeniedError)) throw err
      return { allowed: false as const, code: err.code, message: err.message }
    }
  }

  async function approveFromMessage(message: string, at = state.now) {
    const ref = /apr_[0-9a-f]{32}/.exec(message)?.[0]
    if (!ref) throw new Error(`no ref in: ${message}`)
    const row = Array.from(fake._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.startApprovalStepUp(ref, SUPER, at, async () => true)
    await decisions.decideApproval({ publicRef: ref, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" }, at)
    return ref
  }

  async function rejectFromMessage(message: string) {
    const ref = /apr_[0-9a-f]{32}/.exec(message)![0]
    const row = Array.from(fake._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.decideApproval({ publicRef: ref, decision: "REJECT", approver: SUPER, confirmedBindingDigest: row.bindingDigest as string }, state.now)
    return ref
  }

  const statusOf = (ref: string) => Array.from(fake._requests.values()).find((r) => r.publicRef === ref)?.status

  return { fake, gate, state, decide, call, approveFromMessage, rejectFromMessage, statusOf }
}

describe("execution gate — autonomous paths and denials", () => {
  beforeEach(() => vi.resetModules())

  it("READ with no autonomy policy runs autonomously (OBSERVE_ONLY default) and creates no approval", async () => {
    const t = await setup()
    t.state.policy = null
    expect((await t.call(tierCap("READ"), { id: "p1" })).allowed).toBe(true)
    expect(t.fake._requests.size).toBe(0)
  })

  it("mutation with no autonomy policy is AUTONOMY_DENIED", async () => {
    const t = await setup()
    t.state.policy = null
    expect((await t.call()).code).toBe("AUTONOMY_DENIED")
    expect(t.fake._requests.size).toBe(0)
  })

  it("Phase 6 DENY is AUTHORIZATION_DENIED at every level; no approval request is created", async () => {
    const t = await setup()
    t.state.authz = DENY
    t.state.policy = policy({ autonomyLevel: "FULL_SCOPED_AUTONOMY" })
    expect((await t.call()).code).toBe("AUTHORIZATION_DENIED")
    expect(t.fake._requests.size).toBe(0)
  })

  it("invalid identity is refused before any policy evaluation", async () => {
    const t = await setup()
    for (const ctx of [{ connectionStatus: "SUSPENDED" as const }, { connectionStatus: "REVOKED" as const }, { ownerId: "" }, { connectionId: "" }]) {
      expect((await t.call(undefined, undefined, ctx)).code).toBe("IDENTITY_INVALID")
    }
    expect(t.decide).not.toHaveBeenCalled()
  })

  it("fails closed: Phase 6 unavailable, Phase 6 throwing, autonomy store failing, approval store failing", async () => {
    const t = await setup()
    t.state.authz = UNAVAILABLE
    expect((await t.call()).code).toBe("POLICY_UNAVAILABLE")
    t.state.authz = ALLOW
    t.state.authzThrows = true
    expect((await t.call()).code).toBe("POLICY_UNAVAILABLE")
    t.state.authzThrows = false
    t.state.policyThrows = true
    expect((await t.call()).code).toBe("POLICY_UNAVAILABLE")
    t.state.policyThrows = false
    t.fake.client.agentApprovalRequest.findUnique.mockRejectedValueOnce(new Error("connection reset"))
    expect((await t.call()).code).toBe("POLICY_UNAVAILABLE")
  })

  it("an input that cannot be canonicalized fails closed", async () => {
    const t = await setup()
    expect((await t.call(undefined, { discountValue: NaN })).code).toBe("POLICY_UNAVAILABLE")
  })

  it("environment outside the autonomy scope is ENVIRONMENT_BLOCKED", async () => {
    const t = await setup()
    t.state.policy = policy({ environmentScope: ["development"] })
    expect((await t.call(tierCap("READ"), { id: "p1" }, { environment: "production" })).code).toBe("ENVIRONMENT_BLOCKED")
  })
})

describe("execution gate — approval lifecycle", () => {
  beforeEach(() => vi.resetModules())

  it("APPROVAL_REQUIRED carries a reference, the surface path and the expiry; identical retry reuses it", async () => {
    const t = await setup()
    const first = await t.call()
    expect(first.code).toBe("APPROVAL_REQUIRED")
    const ref = /apr_[0-9a-f]{32}/.exec(first.message)![0]
    expect(first.message).toContain(`/admin/agent-approvals/${ref}`)
    expect(first.message).toMatch(/before 2026-09-29T12:30:00\.000Z/)
    const second = await t.call()
    expect(second.code).toBe("APPROVAL_REQUIRED")
    expect(second.message).toContain(ref)
    expect(second.message).toContain("already pending")
    expect(t.fake._requests.size).toBe(1)
  })

  it("human approval -> the identical retry executes once; the approval is CONSUMED; a replay needs a new approval", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    expect(t.statusOf(ref)).toBe("APPROVED")
    expect((await t.call()).allowed).toBe(true)
    expect(t.statusOf(ref)).toBe("CONSUMED")
    const replay = await t.call()
    expect(replay.code).toBe("APPROVAL_REQUIRED")
    expect(replay.message).not.toContain(ref)
  })

  it("approval for input A never authorizes input B (APPROVAL_BINDING_MISMATCH); A stays usable", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    const other = await t.call(undefined, { ...COUPON, discountValue: 90 })
    expect(other.code).toBe("APPROVAL_BINDING_MISMATCH")
    expect(t.statusOf(ref)).toBe("APPROVED")
    expect((await t.call()).allowed).toBe(true)
  })

  it("an approval for one capability never authorizes another capability", async () => {
    const t = await setup()
    await t.approveFromMessage((await t.call()).message)
    const draft = tierCap("LOW_RISK_WRITE", { id: "products.createDraft" })
    expect((await t.call(draft)).code).toBe("APPROVAL_REQUIRED")
  })

  it("an approval for one connection/owner never authorizes another", async () => {
    const t = await setup()
    t.fake.seedConnection({ id: "conn_2" })
    await t.approveFromMessage((await t.call()).message)
    expect((await t.call(undefined, undefined, { connectionId: "conn_2" })).allowed).toBe(false)
    expect((await t.call(undefined, undefined, { ownerId: "owner_2" })).allowed).toBe(false)
  })

  it("autonomy policy changed after approval -> APPROVAL_POLICY_CHANGED; the old approval is cancelled", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    t.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", version: 2 })
    const res = await t.call()
    expect(res.code).toBe("APPROVAL_POLICY_CHANGED")
    expect(t.statusOf(ref)).toBe("CANCELLED")
    expect(/apr_[0-9a-f]{32}/.exec(res.message)![0]).not.toBe(ref)
  })

  it("Phase 6 policy version changed after approval -> APPROVAL_POLICY_CHANGED", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    t.state.authz = { ...ALLOW, matchedPolicyVersion: 2 }
    expect((await t.call()).code).toBe("APPROVAL_POLICY_CHANGED")
    expect(t.statusOf(ref)).toBe("CANCELLED")
  })

  it("a PENDING request whose policy context changed is retired, so a human can never approve a stale binding", async () => {
    const t = await setup()
    const ref = /apr_[0-9a-f]{32}/.exec((await t.call()).message)![0]
    t.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", version: 2 })
    const res = await t.call()
    expect(res.code).toBe("APPROVAL_REQUIRED")
    expect(t.statusOf(ref)).toBe("CANCELLED")
  })

  it("authorization revoked after approval -> AUTHORIZATION_DENIED; the approval is NOT consumed", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    t.state.authz = DENY
    expect((await t.call()).code).toBe("AUTHORIZATION_DENIED")
    expect(t.statusOf(ref)).toBe("APPROVED")
  })

  it("autonomy downgraded to OBSERVE_ONLY after approval -> AUTONOMY_DENIED; not consumed", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    t.state.policy = policy({ autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ", version: 2 })
    expect((await t.call()).code).toBe("AUTONOMY_DENIED")
    expect(t.statusOf(ref)).toBe("APPROVED")
  })

  it("connection suspended after approval -> IDENTITY_INVALID; not consumed", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    expect((await t.call(undefined, undefined, { connectionStatus: "SUSPENDED" })).code).toBe("IDENTITY_INVALID")
    expect(t.statusOf(ref)).toBe("APPROVED")
  })

  it("environment differs from the approved one -> not executable, approval never consumed for the other environment", async () => {
    const t = await setup()
    await t.approveFromMessage((await t.call()).message)
    const prod = await t.call(undefined, undefined, { environment: "production" })
    expect(prod.allowed).toBe(false)
    expect(Array.from(t.fake._requests.values()).some((r) => r.status === "CONSUMED")).toBe(false)
  })

  it("an approval that expired before execution -> APPROVAL_EXPIRED, then a fresh request", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    t.state.now = new Date(T0.getTime() + 30 * 60_000) // exactly at expiry
    expect((await t.call()).code).toBe("APPROVAL_EXPIRED")
    expect(t.statusOf(ref)).toBe("EXPIRED")
    expect((await t.call()).code).toBe("APPROVAL_REQUIRED")
  })

  it("a human rejection is final for that exact operation: retries get APPROVAL_REJECTED, no new request", async () => {
    const t = await setup()
    const ref = await t.rejectFromMessage((await t.call()).message)
    const retry = await t.call()
    expect(retry.code).toBe("APPROVAL_REJECTED")
    expect(retry.message).toContain(ref)
    expect(t.fake._requests.size).toBe(1)
  })

  it("a cancelled approval is not executable", async () => {
    const t = await setup()
    const ref = await t.approveFromMessage((await t.call()).message)
    const { cancelApprovalByHuman } = await import("../approvals/decision-service")
    await cancelApprovalByHuman(ref, SUPER, t.state.now)
    const res = await t.call()
    expect(res.allowed).toBe(false)
    expect(t.statusOf(ref)).toBe("CANCELLED")
  })

  it("Phase 6 REQUIRES_APPROVAL gates even FULL_SCOPED_AUTONOMY", async () => {
    const t = await setup()
    t.state.authz = REQUIRES_APPROVAL
    t.state.policy = policy({ autonomyLevel: "FULL_SCOPED_AUTONOMY" })
    expect((await t.call(tierCap("READ"), { id: "p1" })).code).toBe("APPROVAL_REQUIRED")
  })

  for (const n of [2, 10]) {
    it(`${n} concurrent identical retries after one approval: exactly one executes`, async () => {
      const t = await setup()
      await t.approveFromMessage((await t.call()).message)
      const results = await Promise.all(Array.from({ length: n }, () => t.call()))
      expect(results.filter((r) => r.allowed).length).toBe(1)
      expect(Array.from(t.fake._requests.values()).filter((r) => r.status === "CONSUMED").length).toBe(1)
    })
  }

  it("10 concurrent first calls produce exactly one pending approval request", async () => {
    const t = await setup()
    const results = await Promise.all(Array.from({ length: 10 }, () => t.call()))
    expect(results.every((r) => r.code === "APPROVAL_REQUIRED")).toBe(true)
    expect(t.fake._requests.size).toBe(1)
  })
})

describe("Section Q — error contract leaks nothing internal", () => {
  beforeEach(() => vi.resetModules())

  it("gate messages never expose digests, internal ids, policy ids, stack traces or DB errors", async () => {
    const t = await setup()
    const messages: string[] = []
    messages.push((await t.call()).message)
    t.fake.client.agentApprovalRequest.findUnique.mockRejectedValueOnce(new Error("PrismaClientKnownRequestError: relation does not exist"))
    messages.push((await t.call()).message)
    t.state.authz = DENY
    messages.push((await t.call()).message)
    const rows = Array.from(t.fake._requests.values())
    for (const m of messages) {
      expect(m).not.toMatch(/[0-9a-f]{64}/) // no binding/input digest
      expect(m).not.toMatch(/Prisma|relation|stack|at \w+ \(/)
      expect(m).not.toContain("polver_1")
      for (const r of rows) expect(m).not.toContain(r.id as string)
      expect(codeOf(`${"X"}: ${m}`)).toBe("X")
    }
  })
})
