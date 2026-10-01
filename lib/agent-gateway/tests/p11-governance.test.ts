/**
 * Phase 11 F — governance of the evidence layer: the audit-ledger and
 * recoveries pages and the two Phase 11 routes (chain verification,
 * recovery request) are SUPER_ADMIN only, refuse agent credentials and
 * non-JSON bodies, validate strictly, are themselves audited, and never
 * expose a secret. Real lib/admin-auth.ts, Phase 7 human-session checks,
 * route and page modules (governance test kit).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BANNED, PLAIN_USER, SUB, SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PAGE = "@/app/(admin)/admin/agent-governance"
const API = "@/app/api/admin/agent-governance"

let k: GovernanceKit
let ledger: typeof import("../audit-ledger")

beforeEach(async () => {
  k = await buildGovernanceKit()
  ledger = await import("../audit-ledger")
  await k.allowRead("products.get")
  const out = await k.tool("products.get", { id: "prod_1" })
  expect(out.isError).toBe(false)
  await ledger.flushAuditLedger()
}, 60_000)

const rows = () => (Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>).sort((a, b) => a.sequence - b.sequence)

/** A recorded execution of a write with no declared recovery (as Phase 4 records one). */
async function recordedWrite() {
  return ledger.appendAuditEvent({
    action: "execution.succeeded",
    outcome: "SUCCESS",
    actor: { type: "AGENT", id: "conn_1" },
    connectionId: "conn_1",
    ownerId: "owner_1",
    capabilityId: "coupons.create",
    capabilityVersion: 1,
    riskTier: "LOW_RISK_WRITE",
    environment: "development",
    executionStatus: "SUCCEEDED",
  })
}

const verify = async (body: unknown = {}, headers?: Record<string, string>) =>
  k.call(await import(`${API}/ledger/verify/route`), "POST", { path: "/api/admin/agent-governance/ledger/verify", body, headers })
const recover = async (body: unknown, headers?: Record<string, string>) =>
  k.call(await import(`${API}/recoveries/route`), "POST", { path: "/api/admin/agent-governance/recoveries", body, headers })

describe("Phase 11 F — pages", () => {
  it("a super administrator sees the ledger (digests, never inputs) and the recoveries page", async () => {
    k.as(SUPER)
    const out = await k.render(await import(`${PAGE}/ledger/page`))
    expect(out.html).toContain("Audit ledger")
    expect(out.html).toContain("Verify chain integrity")
    expect(out.html).toContain("execution.succeeded")
    expect(out.html).toContain("authorization.allowed")
    expect(out.html).toContain(rows().at(-1)!.eventDigest.slice(0, 12))
    expect(out.html).not.toContain("Alpha") // the product name returned to the agent is never evidence
    const recoveries = await k.render(await import(`${PAGE}/recoveries/page`))
    expect(recoveries.html).toContain("Recoveries")
    expect(recoveries.html).toContain("No recovery has been requested.")
  })

  it("only successful writes offer a recovery action; filters are allowlisted", async () => {
    k.as(SUPER)
    const write = await recordedWrite()
    const all = await k.render(await import(`${PAGE}/ledger/page`))
    expect((all.html!.match(/Request recovery/g) ?? []).length).toBe(1)
    const byTrace = await k.render(await import(`${PAGE}/ledger/page`), { searchParams: { traceId: "not-a-trace' OR 1=1" } })
    expect(byTrace.html).toContain(write.eventDigest.slice(0, 12)) // an invalid filter is ignored, not interpolated
    const byCategory = await k.render(await import(`${PAGE}/ledger/page`), { searchParams: { category: "EXECUTION" } })
    expect(byCategory.html).not.toContain("authorization.allowed")
  })

  it("a storage failure shows a distinct error state, never an empty ledger", async () => {
    k.as(SUPER)
    k.approval.client.agentAuditEvent.findMany.mockRejectedValueOnce(new Error("db down"))
    const out = await k.render(await import(`${PAGE}/ledger/page`))
    expect(out.html).toContain('role="alert"')
    expect(out.html).toContain("could not be loaded")
  })

  it.each([
    ["a sub-admin holding EVERY sub-admin permission", SUB, "/unauthorized"],
    ["a regular user", PLAIN_USER, "/unauthorized"],
    ["a banned super administrator", BANNED, "/unauthorized"],
    ["an anonymous visitor", null, "/login"],
  ])("%s is redirected from both pages", async (_label, user, target) => {
    k.as(user)
    for (const page of ["ledger", "recoveries"]) {
      const out = await k.render(await import(`${PAGE}/${page}/page`))
      expect(out.redirect, page).toBe(target)
      expect(out.html, page).toBeUndefined()
    }
  })

  it("the governance navigation lists both sections", async () => {
    k.as(SUPER)
    const layout = await k.render(await import(`${PAGE}/layout`), { layout: true, pathname: "/admin/agent-governance/ledger" })
    // Attribute order is React's; match each <a> by lookaheads.
    expect(layout.html).toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/admin\/agent-governance\/ledger")[^>]*>Audit ledger<\/a>/)
    expect(layout.html).toMatch(/<a(?=[^>]*href="\/admin\/agent-governance\/recoveries")[^>]*>Recoveries<\/a>/)
    expect(layout.html).not.toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/admin\/agent-governance\/recoveries")[^>]*>/)
  })
})

describe("Phase 11 F — chain verification route", () => {
  it("verifies, reports the head, and is audited (AuditLog + ledger)", async () => {
    k.as(SUPER)
    const existing = rows().length
    expect(existing).toBeGreaterThan(0)
    const res = await verify()
    expect(res.status).toBe(200)
    expect(res.json.verification).toMatchObject({ ok: true, checked: existing, headSequence: existing })
    await k.settle()
    await ledger.flushAuditLedger()
    expect(k.auditEntries().find((a) => a.action === "AGENT_AUDIT_LEDGER_VERIFIED")).toMatchObject({ userId: SUPER, entity: "AgentAuditEvent" })
    expect(rows().at(-1)).toMatchObject({ action: "governance.ledger_verified", actorType: "HUMAN", actorId: SUPER })
  })

  it("reports tampering with the failing sequence and reason", async () => {
    k.as(SUPER)
    const [, second] = Array.from(k.approval._auditEvents.entries()).sort((a, b) => (a[1].sequence as number) - (b[1].sequence as number))
    k.approval._auditEvents.set(second[0], { ...second[1], outcome: "DENIED" })
    const res = await verify()
    expect(res.status).toBe(200)
    expect(res.json.verification).toMatchObject({ ok: false, failure: { sequence: 2, reason: "DIGEST_MISMATCH" } })
  })

  it("strict body validation; an unreadable ledger is 503, never 'ok'", async () => {
    k.as(SUPER)
    expect((await verify({ fromSequence: 0 })).status).toBe(400)
    expect((await verify({ maxEvents: 10, extra: true })).status).toBe(400)
    k.approval.client.agentAuditEvent.findFirst.mockRejectedValueOnce(new Error("db down"))
    const down = await verify()
    expect(down.status).toBe(503)
    expect(down.json).toMatchObject({ success: false, code: "UNAVAILABLE" })
  })
})

describe("Phase 11 F — recovery route", () => {
  it("a recorded write with no declared recovery is recorded for manual recovery; the request is idempotent and audited", async () => {
    k.as(SUPER)
    const write = await recordedWrite()
    const res = await recover({ eventId: write.eventId, reason: "agent created a coupon by mistake" })
    expect(res.status).toBe(200)
    expect(res.json.recovery).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", recoveryClass: "IRREVERSIBLE", capabilityId: "coupons.create", sourceEventId: write.eventId })
    const again = await recover({ eventId: write.eventId, reason: "second click" })
    expect(again.json.recovery.recoveryRef).toBe(res.json.recovery.recoveryRef)
    expect(k.approval._recoveries.size).toBe(1)
    await k.settle()
    const audit = k.auditEntries().filter((a) => a.action === "AGENT_RECOVERY_REQUESTED")
    expect(audit).toHaveLength(2)
    expect(audit[0]).toMatchObject({ userId: SUPER, entity: "AgentRecovery", entityId: res.json.recovery.recoveryRef })
    await ledger.flushAuditLedger()
    expect(rows().filter((r) => r.action === "recovery.manual_required")).toHaveLength(1)
    // The recoveries page shows it with the recommendation.
    const page = await k.render(await import(`${PAGE}/recoveries/page`))
    expect(page.html).toContain(res.json.recovery.recoveryRef)
    expect(page.html).toContain("MANUAL RECOVERY REQUIRED")
  })

  it("reads, non-executions and unknown events are refused with stable codes", async () => {
    k.as(SUPER)
    const read = rows().find((r) => r.action === "execution.succeeded" && r.capabilityId === "products.get")!
    expect((await recover({ eventId: read.eventId, reason: "nothing to undo" })).json).toMatchObject({ code: "VALIDATION_FAILED" })
    const decision = rows().find((r) => r.action === "authorization.allowed")!
    expect((await recover({ eventId: decision.eventId, reason: "not an execution" })).json).toMatchObject({ code: "VALIDATION_FAILED" })
    const unknown = await recover({ eventId: "aud_" + "0".repeat(32), reason: "missing" })
    expect(unknown.status).toBe(404)
    expect((await recover({ eventId: read.eventId })).status).toBe(400) // a reason is mandatory
    expect((await recover({ eventId: "aud_x", reason: "bad id" })).status).toBe(400)
    expect(k.approval._recoveries.size).toBe(0)
  })

  it.each([
    ["a sub-admin holding every permission", SUB, "/unauthorized"],
    ["a regular user", PLAIN_USER, "/unauthorized"],
    ["an anonymous caller", null, "/login"],
  ])("%s is redirected by both routes and nothing is recorded", async (_label, user, target) => {
    const write = await recordedWrite()
    await ledger.flushAuditLedger()
    const before = k.approval._auditEvents.size
    k.as(user)
    expect((await verify()).redirect).toBe(target)
    expect((await recover({ eventId: write.eventId, reason: "attempt" })).redirect).toBe(target)
    await k.settle()
    await ledger.flushAuditLedger()
    expect(k.approval._recoveries.size).toBe(0)
    expect(k.approval._auditEvents.size).toBe(before)
    expect(k.auditEntries()).toHaveLength(0)
  })

  it("an agent credential is refused even alongside a super-admin session; form posts are refused", async () => {
    const write = await recordedWrite()
    k.as(SUPER)
    const headerSets: Array<Record<string, string>> = [{ authorization: "Bearer agw_" + "a".repeat(64) }, { "x-abhibhi-key-id": "key_1", "x-abhibhi-signature": "0".repeat(64) }]
    for (const headers of headerSets) {
      const v = await verify({}, headers)
      expect(v.status).toBe(401)
      expect(v.json).toMatchObject({ success: false, code: "HUMAN_APPROVAL_INVALID" })
      const r = await recover({ eventId: write.eventId, reason: "agent tries" }, headers)
      expect(r.status).toBe(401)
    }
    const form = await k.call(await import(`${API}/recoveries/route`), "POST", { path: "/x", rawBody: `eventId=${write.eventId}&reason=csrf`, contentType: "application/x-www-form-urlencoded" })
    expect(form.status).toBe(415)
    expect(k.approval._recoveries.size).toBe(0)
  })

  it("no agent-callable path reaches recovery or the ledger (no MCP tool, no capability)", async () => {
    const list = await k.mcp("tools/list", {})
    const names: string[] = list.result.tools.map((t: { name: string }) => t.name)
    expect(names.filter((n) => /recover|rollback|ledger|audit/i.test(n))).toEqual([])
    expect(k.registry.list({ includeDisabled: true, includeForbidden: true }).filter((d) => /recover|rollback|ledger|audit/i.test(d.id))).toEqual([])
  })
})
