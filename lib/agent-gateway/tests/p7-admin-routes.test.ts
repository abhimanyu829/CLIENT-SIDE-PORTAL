/**
 * Phase 7 — Section F/Q at the HTTP boundary: the human approval admin
 * routes refuse agent credentials, validate input strictly, take the
 * approver identity only from the server-side session, and expose only
 * stable codes (never internals).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApprovalFakeDb } from "./approval-fake-db"

const REF = "apr_" + "a".repeat(32)
const DIGEST = "b".repeat(64)

async function setup(role = "SUPER_ADMIN") {
  vi.resetModules()
  const fake = createApprovalFakeDb()
  fake.seedConnection({ id: "conn_1" })
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))
  vi.doMock("@/lib/admin-auth", () => ({ requireSuperAdmin: vi.fn(async () => ({ userId: "admin_1", role, isSuperAdmin: role === "SUPER_ADMIN" })) }))
  vi.doMock("@clerk/nextjs/server", () => ({ auth: vi.fn(async () => ({ userId: "clerk_1", sessionId: "sess_1" })) }))
  const decision = await import("@/app/api/admin/agent-approvals/[ref]/decision/route")
  const view = await import("@/app/api/admin/agent-approvals/[ref]/route")
  const list = await import("@/app/api/admin/agent-approvals/route")
  return { fake, decision, view, list }
}

const params = (ref: string) => ({ params: Promise.resolve({ ref }) })
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://x/api/admin/agent-approvals/${REF}/decision`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })

describe("admin approval routes", () => {
  beforeEach(() => vi.resetModules())

  it("an agent bearer credential is refused with HUMAN_APPROVAL_INVALID", async () => {
    const { decision } = await setup()
    const res = await decision.POST(post({ decision: "APPROVE", confirmedBindingDigest: DIGEST, stepUpCode: "123456" }, { authorization: "Bearer agw_" + "1".repeat(64) }), params(REF))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe("HUMAN_APPROVAL_INVALID")
  })

  it("an approver id in the body is rejected (strict schema); identity comes only from the session", async () => {
    const { decision } = await setup()
    const res = await decision.POST(post({ decision: "APPROVE", confirmedBindingDigest: DIGEST, stepUpCode: "123456", approverUserId: "someone_else" }), params(REF))
    expect(res.status).toBe(400)
  })

  it("malformed reference -> 404 APPROVAL_NOT_FOUND without touching storage", async () => {
    const { decision, fake } = await setup()
    const res = await decision.POST(post({ decision: "REJECT", confirmedBindingDigest: DIGEST }), params("../../etc"))
    expect(res.status).toBe(404)
    expect(fake.client.agentApprovalRequest.findUnique).not.toHaveBeenCalled()
  })

  it("non-SUPER_ADMIN session -> 403 HUMAN_APPROVER_UNAUTHORIZED", async () => {
    const { decision, fake } = await setup("SUB_ADMIN")
    await fake.client.agentApprovalRequest.create({
      data: { publicRef: REF, connectionId: "conn_1", bindingDigest: DIGEST, requiredApproverScope: "SUPER_ADMIN", status: "PENDING", expiresAt: new Date(Date.now() + 60_000) },
    })
    const res = await decision.POST(post({ decision: "REJECT", confirmedBindingDigest: DIGEST }), params(REF))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("HUMAN_APPROVER_UNAUTHORIZED")
  })

  it("storage failure -> generic 500 with no internal detail", async () => {
    const { view, fake } = await setup()
    fake.client.agentApprovalRequest.findUnique.mockRejectedValueOnce(new Error("PrismaClientInitializationError: can't reach db at 10.0.0.5"))
    const res = await view.GET(new Request(`https://x/api/admin/agent-approvals/${REF}`), params(REF))
    expect(res.status).toBe(500)
    const text = JSON.stringify(await res.json())
    expect(text).not.toMatch(/Prisma|10\.0\.0\.5/)
  })

  it("the view never returns the step-up code hash; viewing does not change state", async () => {
    const { view, fake } = await setup()
    await fake.client.agentApprovalRequest.create({
      data: { publicRef: REF, connectionId: "conn_1", bindingDigest: DIGEST, stepUpCodeHash: "c".repeat(64), requiredApproverScope: "SUPER_ADMIN", status: "PENDING", expiresAt: new Date(Date.now() + 60_000), displaySummary: {} },
    })
    const res = await view.GET(new Request(`https://x/api/admin/agent-approvals/${REF}`), params(REF))
    const body = await res.json()
    expect(body.approval.publicRef).toBe(REF)
    expect(JSON.stringify(body)).not.toContain("c".repeat(64))
    expect(body.approval.id).toBeUndefined()
    expect(Array.from(fake._requests.values())[0].status).toBe("PENDING")
  })

  it("list returns only pending, unexpired requests", async () => {
    const { list, fake } = await setup()
    const base = { connectionId: "conn_1", bindingDigest: DIGEST, requiredApproverScope: "SUPER_ADMIN" }
    await fake.client.agentApprovalRequest.create({ data: { ...base, publicRef: "apr_" + "1".repeat(32), status: "PENDING", expiresAt: new Date(Date.now() + 60_000) } })
    await fake.client.agentApprovalRequest.create({ data: { ...base, publicRef: "apr_" + "2".repeat(32), status: "PENDING", expiresAt: new Date(Date.now() - 1) } })
    await fake.client.agentApprovalRequest.create({ data: { ...base, publicRef: "apr_" + "3".repeat(32), status: "APPROVED", expiresAt: new Date(Date.now() + 60_000) } })
    const res = await list.GET(new Request("https://x/api/admin/agent-approvals"))
    const body = await res.json()
    expect(body.approvals.map((a: { publicRef: string }) => a.publicRef)).toEqual(["apr_" + "1".repeat(32)])
  })
})
