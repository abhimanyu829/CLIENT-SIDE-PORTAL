/**
 * Phase 7 — Section E (human approval), Section F (anti-self-approval),
 * Section M/N/P (replay, single-use, concurrency, DB integrity) against the
 * approval request + decision services on the Phase 7 fake DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApprovalFakeDb } from "./approval-fake-db"
import type { CreateApprovalRequestInput } from "../approvals/request-service"

const NOW = new Date("2026-09-29T12:00:00.000Z")
const later = (ms: number) => new Date(NOW.getTime() + ms)
const DIGEST = "a".repeat(64)
const SUPER = { userId: "admin_1", role: "SUPER_ADMIN", sessionReference: "sess_1" }

async function setup(opts: { code?: string; smsOk?: boolean } = {}) {
  vi.resetModules()
  const fake = createApprovalFakeDb()
  fake.seedConnection({ id: "conn_1", name: "Claude" })
  fake.seedUser({ id: "admin_1", phone: "+919999999999", phoneVerified: true })
  fake.seedUser({ id: "admin_nophone", phone: null, phoneVerified: false })
  fake.seedUser({ id: "admin_2", phone: "+918888888888", phoneVerified: true })
  const sendSms = vi.fn(async () => opts.smsOk ?? true)
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => opts.code ?? "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms }))
  const requests = await import("../approvals/request-service")
  const decisions = await import("../approvals/decision-service")
  const { ApprovalError } = await import("../approvals/errors")
  return { fake, requests, decisions, ApprovalError, sendSms }
}

function input(overrides: Partial<CreateApprovalRequestInput> = {}): CreateApprovalRequestInput {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    agentId: "agent_1",
    ownerId: "owner_1",
    teamId: null,
    capabilityId: "coupons.create",
    capabilityVersion: 1,
    resourceType: "Coupon",
    resourceId: null,
    environment: "development",
    riskTier: "LOW_RISK_WRITE",
    autonomyLevel: "ASSISTED",
    autonomyPolicyVersion: 1,
    authorizationPolicyRef: "polver_1@v1",
    inputDigest: "b".repeat(64),
    bindingDigest: DIGEST,
    requiredApproverScope: "SUPER_ADMIN",
    approvalMethod: "HUMAN_SESSION_PLUS_SMS_STEP_UP",
    displaySummary: { capabilityId: "coupons.create" },
    expiresAt: later(30 * 60_000),
    ...overrides,
  }
}

async function approve(ctx: Awaited<ReturnType<typeof setup>>, publicRef: string, at = NOW) {
  await ctx.decisions.startApprovalStepUp(publicRef, SUPER, at, ctx.sendSms)
  return ctx.decisions.decideApproval({ publicRef, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: DIGEST, stepUpCode: "123456" }, at)
}

describe("request service — creation, idempotency, uniqueness", () => {
  beforeEach(() => vi.resetModules())

  it("creates a PENDING request with an unpredictable public ref, never the DB id", async () => {
    const { requests } = await setup()
    const { request, created } = await requests.findOrCreateApprovalRequest(input(), NOW)
    expect(created).toBe(true)
    expect(request.status).toBe("PENDING")
    expect(request.publicRef).toMatch(/^apr_[0-9a-f]{32}$/)
    expect(request.publicRef).not.toContain(request.id)
  })

  it("an identical retry returns the same live request (idempotent)", async () => {
    const { requests, fake } = await setup()
    const a = await requests.findOrCreateApprovalRequest(input(), NOW)
    const b = await requests.findOrCreateApprovalRequest(input(), NOW)
    expect(b.created).toBe(false)
    expect(b.request.publicRef).toBe(a.request.publicRef)
    expect(fake._requests.size).toBe(1)
  })

  it("10 concurrent identical requests collapse onto exactly one live row (unique activeBindingKey)", async () => {
    const { requests, fake } = await setup()
    const results = await Promise.all(Array.from({ length: 10 }, () => requests.findOrCreateApprovalRequest(input(), NOW)))
    expect(new Set(results.map((r) => r.request.publicRef)).size).toBe(1)
    expect(results.filter((r) => r.created).length).toBe(1)
    expect(fake._requests.size).toBe(1)
  })

  it("an expired live request is retired and a fresh one created", async () => {
    const { requests, fake } = await setup()
    const a = await requests.findOrCreateApprovalRequest(input({ expiresAt: later(1000) }), NOW)
    const b = await requests.findOrCreateApprovalRequest(input({ expiresAt: later(60_000) }), later(1000))
    expect(b.created).toBe(true)
    expect(b.request.publicRef).not.toBe(a.request.publicRef)
    const old = Array.from(fake._requests.values()).find((r) => r.publicRef === a.request.publicRef)!
    expect(old.status).toBe("EXPIRED")
    expect(old.activeBindingKey).toBeNull()
  })
})

describe("Section E — human approval verification", () => {
  beforeEach(() => vi.resetModules())

  it("SUPER_ADMIN + correct digest + correct SMS code approves and records exactly one decision", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    const delivered = await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    expect(delivered.deliveredTo).toBe("***9999")
    expect(ctx.sendSms).toHaveBeenCalledTimes(1)
    const res = await ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: DIGEST, stepUpCode: "123456" }, NOW)
    expect(res.status).toBe("APPROVED")
    expect(ctx.fake._decisions.size).toBe(1)
    const d = Array.from(ctx.fake._decisions.values())[0]
    expect(d.approverUserId).toBe("admin_1")
    expect(d.approvalMethod).toBe("HUMAN_SESSION_PLUS_SMS_STEP_UP")
    expect(d.approverSessionRef).not.toBe("sess_1") // hashed, never raw
    expect(d.scopeDigest).toBe(DIGEST)
  })

  it("the SMS code is stored only as a hash and never returned", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    const res = await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    expect(JSON.stringify(res)).not.toContain("123456")
    const row = Array.from(ctx.fake._requests.values())[0]
    expect(row.stepUpCodeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain("123456")
  })

  it("non-SUPER_ADMIN roles are unauthorized", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    for (const role of ["SUB_ADMIN", "CLIENT", "VENDOR", "AGENT", ""]) {
      await expect(ctx.decisions.startApprovalStepUp(request.publicRef, { ...SUPER, role }, NOW, ctx.sendSms)).rejects.toMatchObject({ code: "HUMAN_APPROVER_UNAUTHORIZED" })
      await expect(ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "APPROVE", approver: { ...SUPER, role }, confirmedBindingDigest: DIGEST, stepUpCode: "123456" }, NOW)).rejects.toMatchObject({ code: "HUMAN_APPROVER_UNAUTHORIZED" })
    }
  })

  it("missing human session reference is invalid", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await expect(ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "REJECT", approver: { ...SUPER, sessionReference: "" }, confirmedBindingDigest: DIGEST }, NOW)).rejects.toMatchObject({ code: "HUMAN_APPROVAL_INVALID" })
  })

  it("a wrong confirmed digest is refused (human confirmed a different operation)", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    await expect(ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: "c".repeat(64), stepUpCode: "123456" }, NOW)).rejects.toMatchObject({ code: "HUMAN_APPROVAL_INVALID" })
  })

  it("approval without a step-up code, before requesting one, or with a malformed code is refused", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    const base = { publicRef: request.publicRef, decision: "APPROVE" as const, approver: SUPER, confirmedBindingDigest: DIGEST }
    await expect(ctx.decisions.decideApproval({ ...base }, NOW)).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" })
    await expect(ctx.decisions.decideApproval({ ...base, stepUpCode: "123456" }, NOW)).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" })
    await expect(ctx.decisions.decideApproval({ ...base, stepUpCode: "12ab56" }, NOW)).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" })
  })

  it("a wrong code is refused, counted, and locks out after 5 attempts", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    const wrong = { publicRef: request.publicRef, decision: "APPROVE" as const, approver: SUPER, confirmedBindingDigest: DIGEST, stepUpCode: "000000" }
    for (let i = 0; i < 5; i += 1) await expect(ctx.decisions.decideApproval(wrong, NOW)).rejects.toMatchObject({ code: "STEP_UP_INVALID" })
    await expect(ctx.decisions.decideApproval({ ...wrong, stepUpCode: "123456" }, NOW)).rejects.toMatchObject({ code: "STEP_UP_LOCKED" })
    expect(Array.from(ctx.fake._requests.values())[0].status).toBe("PENDING")
  })

  it("a code issued to one approver cannot be used by another approver", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    await expect(ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "APPROVE", approver: { ...SUPER, userId: "admin_2" }, confirmedBindingDigest: DIGEST, stepUpCode: "123456" }, NOW)).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" })
  })

  it("a code issued for one request cannot approve another request", async () => {
    const ctx = await setup()
    const a = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    const b = await ctx.requests.findOrCreateApprovalRequest(input({ bindingDigest: "d".repeat(64) }), NOW)
    await ctx.decisions.startApprovalStepUp(a.request.publicRef, SUPER, NOW, ctx.sendSms)
    await expect(ctx.decisions.decideApproval({ publicRef: b.request.publicRef, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: "d".repeat(64), stepUpCode: "123456" }, NOW)).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" })
  })

  it("an expired step-up code is refused", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    await expect(ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: DIGEST, stepUpCode: "123456" }, later(5 * 60_000))).rejects.toMatchObject({ code: "STEP_UP_INVALID" })
  })

  it("an approver without a verified phone cannot approve (fails closed); SMS failure fails closed", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await expect(ctx.decisions.startApprovalStepUp(request.publicRef, { ...SUPER, userId: "admin_nophone" }, NOW, ctx.sendSms)).rejects.toMatchObject({ code: "STEP_UP_DELIVERY_FAILED" })
    const failing = vi.fn(async () => false)
    await expect(ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, failing)).rejects.toMatchObject({ code: "STEP_UP_DELIVERY_FAILED" })
    expect(Array.from(ctx.fake._requests.values())[0].stepUpCodeHash).toBeNull()
  })

  it("an expired request can be neither approved nor rejected", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input({ expiresAt: later(1000) }), NOW)
    await expect(ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST }, later(1000))).rejects.toMatchObject({ code: "APPROVAL_EXPIRED" })
    expect(Array.from(ctx.fake._requests.values())[0].status).toBe("EXPIRED")
  })

  it("unknown reference -> APPROVAL_NOT_FOUND", async () => {
    const ctx = await setup()
    await expect(ctx.decisions.decideApproval({ publicRef: "apr_" + "0".repeat(32), decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST }, NOW)).rejects.toMatchObject({ code: "APPROVAL_NOT_FOUND" })
  })

  it("duplicate decisions: a decided request cannot be re-decided (approve after reject, reject after approve)", async () => {
    const ctx = await setup()
    const a = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.decideApproval({ publicRef: a.request.publicRef, decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST }, NOW)
    await expect(ctx.decisions.startApprovalStepUp(a.request.publicRef, SUPER, NOW, ctx.sendSms)).rejects.toMatchObject({ code: "APPROVAL_ALREADY_DECIDED" })
    await expect(ctx.decisions.decideApproval({ publicRef: a.request.publicRef, decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST }, NOW)).rejects.toMatchObject({ code: "APPROVAL_ALREADY_DECIDED" })

    const b = await ctx.requests.findOrCreateApprovalRequest(input({ bindingDigest: DIGEST }), NOW)
    await approve(ctx, b.request.publicRef)
    await expect(ctx.decisions.decideApproval({ publicRef: b.request.publicRef, decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST }, NOW)).rejects.toMatchObject({ code: "APPROVAL_ALREADY_DECIDED" })
    expect(ctx.fake._decisions.size).toBe(2)
  })

  it("two concurrent approvals of the same request: exactly one decision is recorded", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.startApprovalStepUp(request.publicRef, SUPER, NOW, ctx.sendSms)
    const args = { publicRef: request.publicRef, decision: "APPROVE" as const, approver: SUPER, confirmedBindingDigest: DIGEST, stepUpCode: "123456" }
    const results = await Promise.allSettled([ctx.decisions.decideApproval(args, NOW), ctx.decisions.decideApproval(args, NOW)])
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1)
    expect(ctx.fake._decisions.size).toBe(1)
  })

  it("reject needs no step-up and releases the binding key", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.decideApproval({ publicRef: request.publicRef, decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST, reasonCode: "NOT_NEEDED" }, NOW)
    const row = Array.from(ctx.fake._requests.values())[0]
    expect(row.status).toBe("REJECTED")
    expect(row.activeBindingKey).toBeNull()
    expect(await ctx.requests.findRecentRejection("conn_1", DIGEST, NOW)).not.toBeNull()
  })
})

describe("Section M/N — single-use consumption and replay", () => {
  beforeEach(() => vi.resetModules())

  it("an APPROVED approval is consumed exactly once; a replay is APPROVAL_ALREADY_CONSUMED", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await approve(ctx, request.publicRef)
    expect(await ctx.requests.consumeApproval(request.id, DIGEST, NOW)).toEqual({ ok: true })
    expect(await ctx.requests.consumeApproval(request.id, DIGEST, NOW)).toEqual({ ok: false, code: "APPROVAL_ALREADY_CONSUMED" })
    const row = Array.from(ctx.fake._requests.values())[0]
    expect(row.status).toBe("CONSUMED")
    expect(row.activeBindingKey).toBeNull()
  })

  it("PENDING cannot be consumed; wrong digest is a binding mismatch; expired cannot be consumed", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input({ expiresAt: later(60_000) }), NOW)
    expect(await ctx.requests.consumeApproval(request.id, DIGEST, NOW)).toEqual({ ok: false, code: "APPROVAL_REQUIRED" })
    await approve(ctx, request.publicRef)
    expect(await ctx.requests.consumeApproval(request.id, "e".repeat(64), NOW)).toEqual({ ok: false, code: "APPROVAL_BINDING_MISMATCH" })
    expect(await ctx.requests.consumeApproval(request.id, DIGEST, later(60_000))).toEqual({ ok: false, code: "APPROVAL_EXPIRED" })
    expect(Array.from(ctx.fake._requests.values())[0].status).toBe("EXPIRED")
  })

  it("cancelled and rejected approvals cannot be consumed", async () => {
    const ctx = await setup()
    const a = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await approve(ctx, a.request.publicRef)
    await ctx.decisions.cancelApprovalByHuman(a.request.publicRef, SUPER, NOW)
    expect(await ctx.requests.consumeApproval(a.request.id, DIGEST, NOW)).toEqual({ ok: false, code: "APPROVAL_CANCELLED" })

    const b = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await ctx.decisions.decideApproval({ publicRef: b.request.publicRef, decision: "REJECT", approver: SUPER, confirmedBindingDigest: DIGEST }, NOW)
    expect(await ctx.requests.consumeApproval(b.request.id, DIGEST, NOW)).toEqual({ ok: false, code: "APPROVAL_REJECTED" })
  })

  for (const n of [2, 10]) {
    it(`${n} concurrent consumers of one approval: exactly one succeeds`, async () => {
      const ctx = await setup()
      const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
      await approve(ctx, request.publicRef)
      const results = await Promise.all(Array.from({ length: n }, () => ctx.requests.consumeApproval(request.id, DIGEST, NOW)))
      expect(results.filter((r) => r.ok).length).toBe(1)
      expect(results.filter((r) => !r.ok && r.code === "APPROVAL_ALREADY_CONSUMED").length).toBe(n - 1)
    })
  }

  it("cancel after consume reports the real state, never silent success", async () => {
    const ctx = await setup()
    const { request } = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await approve(ctx, request.publicRef)
    await ctx.requests.consumeApproval(request.id, DIGEST, NOW)
    await expect(ctx.decisions.cancelApprovalByHuman(request.publicRef, SUPER, NOW)).rejects.toMatchObject({ code: "APPROVAL_ALREADY_CONSUMED" })
  })

  it("connection lifecycle: cancelApprovalsForConnection retires every live approval for that connection only", async () => {
    const ctx = await setup()
    ctx.fake.seedConnection({ id: "conn_2" })
    const a = await ctx.requests.findOrCreateApprovalRequest(input(), NOW)
    await approve(ctx, a.request.publicRef)
    await ctx.requests.findOrCreateApprovalRequest(input({ bindingDigest: "f".repeat(64) }), NOW)
    await ctx.requests.findOrCreateApprovalRequest(input({ connectionId: "conn_2" }), NOW)
    expect(await ctx.requests.cancelApprovalsForConnection("conn_1", "CONNECTION_SUSPENDED", NOW)).toBe(2)
    expect(await ctx.requests.consumeApproval(a.request.id, DIGEST, NOW)).toEqual({ ok: false, code: "APPROVAL_CANCELLED" })
    const conn2 = Array.from(ctx.fake._requests.values()).filter((r) => r.connectionId === "conn_2")
    expect(conn2.map((r) => r.status)).toEqual(["PENDING"])
  })
})

describe("Section F — anti-self-approval (human session resolver)", () => {
  beforeEach(() => vi.resetModules())

  async function sessionSetup(role = "SUPER_ADMIN", sessionId: string | null = "sess_1") {
    vi.doMock("@/lib/admin-auth", () => ({ requireSuperAdmin: vi.fn(async () => ({ userId: "admin_1", role, isSuperAdmin: role === "SUPER_ADMIN" })) }))
    vi.doMock("@clerk/nextjs/server", () => ({ auth: vi.fn(async () => ({ userId: "clerk_1", sessionId })) }))
    return import("../approvals/human-session")
  }

  it("a request carrying an Agent Gateway bearer credential is refused even with a human session", async () => {
    const { requireHumanApprover, carriesAgentCredential } = await sessionSetup()
    const req = new Request("https://x/api/admin/agent-approvals", { headers: { authorization: "Bearer agw_" + "0".repeat(64) } })
    expect(carriesAgentCredential(req)).toBe(true)
    await expect(requireHumanApprover(req)).rejects.toMatchObject({ code: "HUMAN_APPROVAL_INVALID" })
  })

  it("a request carrying signed-request agent headers is refused", async () => {
    const { requireHumanApprover } = await sessionSetup()
    const req = new Request("https://x", { headers: { "x-abhibhi-signature": "0".repeat(64) } })
    await expect(requireHumanApprover(req)).rejects.toMatchObject({ code: "HUMAN_APPROVAL_INVALID" })
  })

  it("a human SUPER_ADMIN session resolves to an approver built only from server-side session data", async () => {
    const { requireHumanApprover } = await sessionSetup()
    const approver = await requireHumanApprover(new Request("https://x", { headers: { "x-approver-id": "evil" } }))
    expect(approver).toEqual({ userId: "admin_1", role: "SUPER_ADMIN", sessionReference: "sess_1" })
  })

  it("no Clerk session id -> HUMAN_APPROVAL_INVALID", async () => {
    const { requireHumanApprover } = await sessionSetup("SUPER_ADMIN", null)
    await expect(requireHumanApprover(new Request("https://x"))).rejects.toMatchObject({ code: "HUMAN_APPROVAL_INVALID" })
  })
})
