/**
 * Known-issue fixes after Phase 15 — the execution gate's approval path.
 *
 * P14-F2: an approval is never requested (or consumed) for a resource the
 *         connection's owner cannot reach. The refusal is the adapter's own
 *         RESOURCE_NOT_FOUND, so it is no new existence oracle.
 * P14-F3: the number of approval requests a connection may leave waiting for
 *         a human is bounded (APPROVAL_LIMIT_REACHED creates nothing).
 *
 * REAL gate, REAL approval request/decision services and REAL adapters over
 * the in-memory fakes; the Phase 6 decision is scripted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApprovalFakeDb } from "./approval-fake-db"
import { createExecutionFakeDb } from "./execution-fake-db"
import { ALLOW, cap, execCtx, policy } from "./p7-helpers"
import type { EffectiveAutonomyPolicy } from "../autonomy/types"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"

const T0 = new Date("2026-09-29T12:00:00.000Z")
const SUPER = { userId: "admin_1", role: "SUPER_ADMIN", sessionReference: "sess_1" }
const NOT_FOUND_TICKET = "No ticket exists for the given id."

async function setup(deps: { resourcePreflight?: (...args: unknown[]) => Promise<void> } = {}) {
  vi.resetModules()
  const approval = createApprovalFakeDb()
  const exec = createExecutionFakeDb()
  approval.seedConnection({ id: "conn_1", name: "Claude" })
  approval.seedConnection({ id: "conn_2", name: "Other" })
  approval.seedUser({ id: "admin_1", phone: "+919999999999", phoneVerified: true })
  const db = { ...exec.client, ...approval.client }
  vi.doMock("@/lib/db", () => ({ db }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))

  const { ExecutionGate } = await import("../execution-gate/gate")
  const { AuthorizationDeniedError } = await import("../mcp/errors")
  const decisions = await import("../approvals/decision-service")

  const state = {
    policy: policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE" }) as EffectiveAutonomyPolicy | null,
    now: T0,
  }
  const gate = new ExecutionGate({
    authorization: { decide: async () => ALLOW },
    loadAutonomyPolicy: async () => state.policy,
    clock: () => state.now,
    ...(deps.resourcePreflight ? { resourcePreflight: deps.resourcePreflight } : {}),
  })

  async function call(capability: CapabilityDefinition, input: unknown, ctx: Partial<AgentExecutionContext> = {}) {
    try {
      await gate.authorize(execCtx({ capabilityId: capability.id, ...ctx }), capability, input, {})
      return { allowed: true as const, code: null, message: "" }
    } catch (err) {
      if (!(err instanceof AuthorizationDeniedError)) throw err
      return { allowed: false as const, code: err.code, message: err.message }
    }
  }

  async function approve(message: string) {
    const ref = /apr_[0-9a-f]{32}/.exec(message)?.[0]
    if (!ref) throw new Error(`no approval reference in: ${message}`)
    const row = Array.from(approval._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.startApprovalStepUp(ref, SUPER, state.now, async () => true)
    await decisions.decideApproval({ publicRef: ref, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" }, state.now)
    return ref
  }

  const statusOf = (ref: string) => Array.from(approval._requests.values()).find((r) => r.publicRef === ref)?.status
  const ticket = (id: string, clientId: string) => exec.seedTicket({ id, clientId, title: `Ticket ${id}`, status: "OPEN", assignedTo: null })

  return { approval, exec, gate, state, call, approve, statusOf, ticket }
}

describe("P14-F2 — resource preflight before an approval", () => {
  beforeEach(() => vi.resetModules())

  it("an approval-gated close of ANOTHER owner's ticket is RESOURCE_NOT_FOUND, creates no request, and matches the adapter's own answer", async () => {
    const t = await setup()
    t.ticket("tk_b", "owner_2")

    const foreign = await t.call(cap("tickets.close"), { ticketId: "tk_b" })
    const missing = await t.call(cap("tickets.close"), { ticketId: "tk_missing" })
    expect(foreign).toEqual({ allowed: false, code: "RESOURCE_NOT_FOUND", message: NOT_FOUND_TICKET })
    // Not-owned and missing are indistinguishable.
    expect(missing).toEqual(foreign)
    expect(t.approval._requests.size).toBe(0)
    expect(t.exec._tickets.get("tk_b")!.status).toBe("OPEN")

    // Exactly what the adapter itself answers on the autonomous path.
    const { TicketsCloseAdapter } = await import("../execution/adapters/tickets-close-adapter")
    await expect(new TicketsCloseAdapter().execute(execCtx({ ownerId: "owner_1" }), { ticketId: "tk_b" })).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", message: NOT_FOUND_TICKET })
  })

  it("the owner's own ticket still raises exactly one approval request, and the approved close is then allowed once", async () => {
    const t = await setup()
    t.ticket("tk_a", "owner_1")
    const first = await t.call(cap("tickets.close"), { ticketId: "tk_a" })
    expect(first.code).toBe("APPROVAL_REQUIRED")
    expect(t.approval._requests.size).toBe(1)

    const ref = await t.approve(first.message)
    expect(await t.call(cap("tickets.close"), { ticketId: "tk_a" })).toMatchObject({ allowed: true })
    expect(t.statusOf(ref)).toBe("CONSUMED")
  })

  it("a resource that stops being reachable after approval is refused WITHOUT consuming the approval", async () => {
    const t = await setup()
    t.ticket("tk_a", "owner_1")
    const ref = await t.approve((await t.call(cap("tickets.close"), { ticketId: "tk_a" })).message)

    t.exec._tickets.delete("tk_a")
    expect(await t.call(cap("tickets.close"), { ticketId: "tk_a" })).toMatchObject({ code: "RESOURCE_NOT_FOUND" })
    expect(t.statusOf(ref)).toBe("APPROVED")

    t.ticket("tk_a", "owner_1")
    expect(await t.call(cap("tickets.close"), { ticketId: "tk_a" })).toMatchObject({ allowed: true })
    expect(t.statusOf(ref)).toBe("CONSUMED")
  })

  it("approval-gated reads are covered too: tickets.get, subscriptions.get, analytics.productPerformance", async () => {
    const t = await setup()
    t.state.policy = policy({ autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["tickets.get", "subscriptions.get", "analytics.productPerformance"] })
    t.ticket("tk_b", "owner_2")
    t.exec.seedSubscription({ id: "sub_b", userId: "owner_2", status: "ACTIVE", tierId: "tier_1" })
    t.exec.seedVendor({ id: "ven_b", userId: "owner_2" })
    t.exec.seedProduct({ id: "prod_b", name: "B", slug: "b", status: "AVAILABLE", type: "SAAS", vendorId: "ven_b" })

    expect(await t.call(cap("tickets.get"), { ticketId: "tk_b" })).toMatchObject({ code: "RESOURCE_NOT_FOUND", message: NOT_FOUND_TICKET })
    expect(await t.call(cap("subscriptions.get"), { subscriptionId: "sub_b" })).toMatchObject({ code: "RESOURCE_NOT_FOUND", message: "No subscription exists for the given id." })
    expect(await t.call(cap("analytics.productPerformance"), { productId: "prod_b" })).toMatchObject({ code: "RESOURCE_NOT_FOUND", message: "No product exists for the given id." })
    expect(t.approval._requests.size).toBe(0)

    // The same reads of the caller's OWN resources reach the approval step.
    t.ticket("tk_a", "owner_1")
    t.exec.seedSubscription({ id: "sub_a", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    t.exec.seedVendor({ id: "ven_a", userId: "owner_1" })
    t.exec.seedProduct({ id: "prod_a", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS", vendorId: "ven_a" })
    expect((await t.call(cap("tickets.get"), { ticketId: "tk_a" })).code).toBe("APPROVAL_REQUIRED")
    expect((await t.call(cap("subscriptions.get"), { subscriptionId: "sub_a" })).code).toBe("APPROVAL_REQUIRED")
    expect((await t.call(cap("analytics.productPerformance"), { productId: "prod_a" })).code).toBe("APPROVAL_REQUIRED")
    expect(t.approval._requests.size).toBe(3)
  })

  it("a preflight that cannot reach its store fails closed (POLICY_UNAVAILABLE) and creates nothing", async () => {
    const t = await setup()
    t.ticket("tk_a", "owner_1")
    t.exec.client.ticket.findUnique.mockRejectedValueOnce(new Error("connection reset"))
    expect(await t.call(cap("tickets.close"), { ticketId: "tk_a" })).toMatchObject({ allowed: false, code: "POLICY_UNAVAILABLE" })
    expect(t.approval._requests.size).toBe(0)
  })

  it("the preflight runs only where an approval would be requested or consumed: never on autonomous calls or the worker's re-check", async () => {
    const preflight = vi.fn(async (..._args: unknown[]) => undefined)
    const t = await setup({ resourcePreflight: preflight })
    t.ticket("tk_a", "owner_1")

    // Autonomous (no approval needed): the adapter itself checks ownership.
    t.state.policy = policy({ autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE" })
    expect((await t.call(cap("tickets.close"), { ticketId: "tk_a" })).allowed).toBe(true)
    expect(preflight).not.toHaveBeenCalled()

    // Approval needed: the worker's evaluation-only re-check does not run it...
    t.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE" })
    await t.gate.evaluatePolicy(execCtx({ capabilityId: "tickets.close" }), cap("tickets.close"), { ticketId: "tk_a" })
    expect(preflight).not.toHaveBeenCalled()

    // ...a decision does, exactly once, with the live input.
    expect((await t.call(cap("tickets.close"), { ticketId: "tk_a" })).code).toBe("APPROVAL_REQUIRED")
    expect(preflight).toHaveBeenCalledTimes(1)
    expect(preflight.mock.calls[0][2]).toEqual({ ticketId: "tk_a" })
  })

  it("capabilities without an owner-scoped resource are unaffected (tickets.create still asks for approval)", async () => {
    const t = await setup()
    const out = await t.call(cap("tickets.create"), { subject: "Help", description: "Please help with billing." })
    expect(out.code).toBe("APPROVAL_REQUIRED")
    expect(t.approval._requests.size).toBe(1)
  })
})

describe("P14-F3 — bounded pending approvals per connection", () => {
  beforeEach(() => vi.resetModules())

  const ticketInput = (i: number) => ({ subject: `Question ${i}`, description: `Distinct description number ${i}.` })

  it("at the limit a NEW operation is refused with APPROVAL_LIMIT_REACHED and nothing is created", async () => {
    const t = await setup()
    const { MAX_PENDING_APPROVALS_PER_CONNECTION } = await import("../approvals/constants")
    for (let i = 0; i < MAX_PENDING_APPROVALS_PER_CONNECTION; i++) {
      expect((await t.call(cap("tickets.create"), ticketInput(i))).code).toBe("APPROVAL_REQUIRED")
    }
    expect(t.approval._requests.size).toBe(MAX_PENDING_APPROVALS_PER_CONNECTION)

    const refused = await t.call(cap("tickets.create"), ticketInput(999))
    expect(refused.code).toBe("APPROVAL_LIMIT_REACHED")
    expect(refused.message).toMatch(/No new request was created/)
    expect(refused.message).not.toMatch(/apr_/)
    expect(t.approval._requests.size).toBe(MAX_PENDING_APPROVALS_PER_CONNECTION)

    // Repeating an operation that is ALREADY pending still answers with its reference.
    const again = await t.call(cap("tickets.create"), ticketInput(3))
    expect(again.code).toBe("APPROVAL_REQUIRED")
    expect(again.message).toMatch(/already pending/)

    // Another connection has its own budget.
    expect((await t.call(cap("tickets.create"), ticketInput(999), { connectionId: "conn_2", ownerId: "owner_2" })).code).toBe("APPROVAL_REQUIRED")
  })

  it("a changed input under an approved request is refused AND, at the limit, creates no further request", async () => {
    const t = await setup()
    const { MAX_PENDING_APPROVALS_PER_CONNECTION } = await import("../approvals/constants")
    const approvedRef = await t.approve((await t.call(cap("tickets.create"), ticketInput(0))).message)
    for (let i = 1; i <= MAX_PENDING_APPROVALS_PER_CONNECTION; i++) await t.call(cap("tickets.create"), ticketInput(i))
    const before = t.approval._requests.size

    const altered = await t.call(cap("tickets.create"), { ...ticketInput(0), description: "Altered after approval." })
    expect(altered.code).toBe("APPROVAL_LIMIT_REACHED")
    expect(t.approval._requests.size).toBe(before)
    // The approved request is untouched and still usable for the exact operation.
    expect(t.statusOf(approvedRef)).toBe("APPROVED")
    expect((await t.call(cap("tickets.create"), ticketInput(0))).allowed).toBe(true)
  })

  it("expired requests do not count: once they lapse, new requests are accepted again", async () => {
    const t = await setup()
    const { MAX_PENDING_APPROVALS_PER_CONNECTION } = await import("../approvals/constants")
    for (let i = 0; i < MAX_PENDING_APPROVALS_PER_CONNECTION; i++) await t.call(cap("tickets.create"), ticketInput(i))
    expect((await t.call(cap("tickets.create"), ticketInput(500))).code).toBe("APPROVAL_LIMIT_REACHED")

    t.state.now = new Date(T0.getTime() + 31 * 60_000) // past every 30-minute validity window
    expect((await t.call(cap("tickets.create"), ticketInput(500))).code).toBe("APPROVAL_REQUIRED")
  })
})
