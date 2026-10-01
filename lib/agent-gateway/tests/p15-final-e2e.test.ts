/**
 * Phase 15 — final end-to-end acceptance (22 steps, in order, one world).
 *
 * The agent side goes through the REAL MCP route handler
 * (lib/agent-gateway/mcp/route-handler.ts) with a REAL bearer credential
 * issued by the Phase 2 connection service and verified by the DB
 * credential store; the operator side goes through the REAL governance
 * routes and services as a SUPER_ADMIN with a live session. Rollout
 * enforcement is ON: nothing is available until it is released.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"
import { IDEMPOTENCY_META_KEY } from "../mcp/request-meta"
import { checkInvariants } from "../simulation/invariants"
import { NEVER_EXECUTABLE } from "../simulation/world"
import type { Observation } from "../simulation/types"

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 })

const API = "@/app/api/admin/agent-governance"
const TICKET = { subject: "Cannot download invoice", description: "The download button on my invoice page does nothing." }
const RELEASED = ["products.get", "tickets.create", "tickets.close", "tickets.get"]

let k: GovernanceKit
let ledger: typeof import("../audit-ledger")
let handle: (req: Request) => Promise<Response>
let token = ""
let connectionId = ""
let ticketId = ""
let creationEventId = ""
let recoveryApproval = ""
let ksRef = ""
let ksVersion = 0
const observations: Observation[] = []

async function agent(method: string, params: Record<string, unknown>, label: string) {
  const res = await handle(
    new Request("https://abhibhideveloper.online/api/agent-gateway/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: observations.length + 1, method, params }),
    })
  )
  const body = (await res.json()) as { result?: any; error?: any }
  const first: string = body.result?.content?.[0]?.text ?? (body.error ? `MCP error ${body.error.code}: ${body.error.message}` : "")
  let output: unknown
  try {
    output = JSON.parse(first)
  } catch {
    output = undefined
  }
  observations.push({
    index: observations.length,
    kind: "tool",
    label,
    actor: { connectionId, ownerId: "owner_e2e" },
    isError: body.result?.isError === true || !!body.error,
    code: body.result?.isError ? /^([A-Z_]+):/.exec(first)?.[1] ?? "UNKNOWN" : null,
    text: JSON.stringify(body),
    message: first,
    output,
  })
  return { status: res.status, body, first, output: output as any }
}
const listTools = async (label: string) => ((await agent("tools/list", {}, label)).body.result?.tools ?? []).map((t: { name: string }) => t.name).sort() as string[]
const post = async (route: string, body: unknown, params: Record<string, string> = {}) => k.call(await import(`${API}/${route}/route`), "POST", { path: `/api/admin/agent-governance/${route}`, body, params })
const rows = async () => {
  await ledger.flushAuditLedger()
  return (Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>).sort((a, b) => a.sequence - b.sequence)
}
const versionOf = (capabilityId: string) => (Array.from(k.approval._rollouts.values()) as Array<Record<string, any>>).find((r) => r.capabilityId === capabilityId)!.version as number

beforeAll(async () => {
  k = await buildGovernanceKit()
  ledger = await import("../audit-ledger")
  k.approval.seedUser({ id: "owner_e2e", role: "CLIENT", name: "E2E Customer", email: "e2e@example.test", phone: null, phoneVerified: false, isBanned: false })
  vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
  vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
  vi.stubEnv("AGENT_GATEWAY_CREDENTIAL_STORE", "db")
  vi.stubEnv("AGENT_GATEWAY_ROLLOUT_ENFORCED", "1")
  vi.doMock("../limits/rate-limiter", () => ({
    GatewayRedisRateLimiter: class {
      check = vi.fn(async () => ({ allowed: true, limit: 60, remaining: 59, resetAt: new Date() }))
    },
  }))
  ;(await import("../config")).__resetGatewayConfigForTests()
  ;(await import("../mcp/config")).__resetMcpConfigForTests()
  handle = (await import("../mcp/route-handler")).handleMcpRequest
  k.as(SUPER)
}, 90_000)

afterAll(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.sequential("Final end-to-end acceptance", () => {
  it("01 an administrator connects an agent for a customer; the bearer credential is shown once and stored hashed", async () => {
    const created = await k.connectionService().create({ name: "Support agent", provider: "claude", ownerId: "owner_e2e", authMethod: "BEARER", actorId: SUPER })
    if (created.credential.authMethod !== "BEARER") throw new Error("expected a bearer credential")
    token = created.credential.bearerToken
    connectionId = created.connection.id
    expect(token).toMatch(/^agw_[0-9a-f]{64}$/)
    expect(JSON.stringify(Array.from(k.approval._credentials.values()))).not.toContain(token)
  })

  it("02 a forged credential is refused at the edge", async () => {
    const res = await handle(
      new Request("https://abhibhideveloper.online/api/agent-gateway/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer agw_${"0".repeat(64)}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("03 with enforcement on and nothing released, the agent sees only the task tools", async () => {
    const names = await listTools("tools-before-release")
    expect(names.filter((n) => !n.startsWith("agent_task_"))).toEqual([])
  })

  it("04 the administrator grants Phase 6 access and ASSISTED autonomy up to low-risk writes", async () => {
    for (const id of RELEASED) {
      const def = k.registry.get(id)!
      await k.policyStore.createPolicyVersion({ name: `allow ${id}`, effect: "ALLOW", scope: "CAPABILITY", capabilityId: id, riskConstraint: def.operationType as "READ", actorId: SUPER })
    }
    await k.autonomyStore.setAutonomyPolicy({ connectionId, autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", actorId: SUPER })
    expect((await listTools("tools-after-policy")).filter((n) => !n.startsWith("agent_task_"))).toEqual([]) // still not released
  })

  it("05 the administrator releases four capabilities to an INTERNAL cohort containing this connection", async () => {
    for (const id of RELEASED) {
      const conf = await post("rollouts", { capabilityId: id, canaryPercent: 0, allowedConnectionIds: [connectionId], reason: "pilot cohort" })
      expect(conf.status, id).toBe(200)
      const adv = await post("rollouts/transition", { capabilityId: id, action: "advance", expectedVersion: conf.json.rollout.version, reason: "internal pilot" })
      expect(adv.json.rollout.stage, id).toBe("INTERNAL")
    }
  })

  it("06 the agent now sees exactly the released tools", async () => {
    expect((await listTools("tools-after-release")).filter((n) => !n.startsWith("agent_task_"))).toEqual([...RELEASED].sort())
  })

  it("07 a read runs autonomously and returns only the published product's contract fields", async () => {
    const res = await agent("tools/call", { name: "products.get", arguments: { id: "prod_1" } }, "read-product")
    expect(res.body.result.isError).toBeFalsy()
    expect(res.output).toEqual({ id: "prod_1", name: "Alpha", slug: "alpha", status: "AVAILABLE", type: "SAAS" })
  })

  it("08 a write without an idempotency key is refused before any approval exists", async () => {
    const res = await agent("tools/call", { name: "tickets.create", arguments: TICKET }, "create-without-key")
    expect(res.first).toMatch(/^IDEMPOTENCY_KEY_REQUIRED/)
    expect(k.approval._requests.size).toBe(0)
  })

  it("09 the keyed write needs a human approval under ASSISTED autonomy", async () => {
    const res = await agent("tools/call", { name: "tickets.create", arguments: TICKET, _meta: { [IDEMPOTENCY_META_KEY]: "e2e-ticket-0001" } }, "create-needs-approval")
    expect(res.first).toMatch(/^APPROVAL_REQUIRED/)
    expect(k.exec._tickets.size).toBe(0)
  })

  it("10 the administrator approves it with the SMS step-up and the binding digest", async () => {
    const pending = Array.from(k.approval._requests.values()).find((r) => r.status === "PENDING")!
    await k.approve(pending.publicRef as string)
    expect(Array.from(k.approval._requests.values()).find((r) => r.publicRef === pending.publicRef)!.status).toBe("APPROVED")
  })

  it("11 the identical retry runs exactly once, for the customer, behind a recorded intent", async () => {
    const res = await agent("tools/call", { name: "tickets.create", arguments: TICKET, _meta: { [IDEMPOTENCY_META_KEY]: "e2e-ticket-0001" } }, "create-approved")
    expect(res.body.result.isError).toBeFalsy()
    ticketId = res.output.id
    expect(k.exec._tickets.size).toBe(1)
    expect(k.exec._tickets.get(ticketId)!.clientId).toBe("owner_e2e")
    const ev = (await rows()).filter((r) => r.capabilityId === "tickets.create" && r.action.startsWith("execution."))
    expect(ev.map((e) => e.action)).toEqual(["execution.started", "execution.succeeded"])
    creationEventId = ev[1].eventId
  })

  it("12 the agent reads its ticket back as labelled third-party content", async () => {
    const res = await agent("tools/call", { name: "tickets.get", arguments: { ticketId } }, "read-ticket")
    expect(res.output).toMatchObject({ id: ticketId, subject: TICKET.subject, status: "OPEN" })
    expect(res.body.result._meta["abhibhideveloper.online/content-trust"]).toMatchObject({ trust: "THIRD_PARTY_CONTENT" })
  })

  it("13 the audit ledger holds the whole story and its chain verifies", async () => {
    const res = await post("ledger/verify", {})
    expect(res.json.verification).toMatchObject({ ok: true })
    const actions = new Set((await rows()).map((r) => r.action))
    for (const a of ["authorization.allowed", "approval.required", "approval.approved", "approval.consumed", "execution.started", "execution.succeeded", "rollout.advanced"]) expect(actions.has(a), a).toBe(true)
  })

  it("14 a guarded promotion moves the connection up exactly one level", async () => {
    const res = await post("connections/[id]/autonomy", { direction: "promote", reason: "pilot went well" }, { id: connectionId })
    expect(res.json.change).toMatchObject({ outcome: "PROMOTED", levelFrom: "ASSISTED", levelTo: "APPROVAL_REQUIRED" })
  })

  it("15 the administrator asks to recover the ticket; the compensation needs an approval first", async () => {
    const res = await post("recoveries", { eventId: creationEventId, reason: "opened by mistake" })
    expect(res.json.recovery).toMatchObject({ status: "APPROVAL_REQUIRED", recoveryClass: "COMPENSATABLE" })
    recoveryApproval = res.json.recovery.approvalRef
    expect(recoveryApproval).toMatch(/^apr_[0-9a-f]{32}$/)
    expect(k.exec._tickets.get(ticketId)!.status).toBe("OPEN")
  })

  it("16 a human approves the recovery", async () => {
    await k.approve(recoveryApproval)
    expect(Array.from(k.approval._requests.values()).find((r) => r.publicRef === recoveryApproval)!.status).toBe("APPROVED")
  })

  it("17 the recovery runs once as the original connection and closes the ticket", async () => {
    const res = await post("recoveries", { eventId: creationEventId, reason: "approved" })
    expect(res.json.recovery.status).toBe("SUCCEEDED")
    expect(k.exec._tickets.get(ticketId)!.status).toBe("CLOSED")
    const closes = (await rows()).filter((r) => r.capabilityId === "tickets.close" && r.action === "execution.succeeded")
    expect(closes).toHaveLength(1)
    expect(closes[0].connectionId).toBe(connectionId)
  })

  it("18 incident: a GLOBAL kill switch removes every tool and refuses every call at once", async () => {
    const res = await post("kill-switches", { scope: "GLOBAL", reason: "suspicious traffic" })
    expect(res.status).toBe(201)
    ksRef = res.json.killSwitch.ref
    ksVersion = res.json.killSwitch.version
    expect((await listTools("tools-during-incident")).filter((n) => !n.startsWith("agent_task_"))).toEqual([])
    const call = await agent("tools/call", { name: "products.get", arguments: { id: "prod_1" } }, "read-during-incident")
    expect(call.body.result.isError).toBe(true)
  })

  it("19 deactivating the switch restores exactly the released surface", async () => {
    const res = await post("kill-switches/[ref]/deactivate", { expectedVersion: ksVersion, reason: "false alarm" }, { ref: ksRef })
    expect(res.json.killSwitch.active).toBe(false)
    expect((await listTools("tools-after-incident")).filter((n) => !n.startsWith("agent_task_"))).toEqual([...RELEASED].sort())
  })

  it("20 a failing capability is paused by its health gate in the maintenance pass and disappears", async () => {
    for (let i = 0; i < 25; i += 1) {
      await ledger.appendAuditEvent({ action: "execution.failed", outcome: "FAILED", actor: { type: "AGENT", id: connectionId }, connectionId, capabilityId: "products.get", environment: "development", errorCode: "EXECUTION_UNAVAILABLE" })
    }
    const { runTaskMaintenance } = await import("../tasks/maintenance")
    const report = await runTaskMaintenance({ queue: k.queue, config: (await import("./task-test-kit")).TEST_CONFIG, clock: () => new Date() })
    expect(report.autoPaused).toBe(1)
    expect(await listTools("tools-after-auto-pause")).not.toContain("products.get")
  })

  it("21 the administrator rolls the release back and demotes the agent", async () => {
    const back = await post("rollouts/transition", { capabilityId: "tickets.create", action: "rollback", targetStage: "DISABLED", expectedVersion: versionOf("tickets.create"), reason: "end of pilot" })
    expect(back.json.rollout.stage).toBe("DISABLED")
    const demote = await post("connections/[id]/autonomy", { direction: "demote", targetLevel: "OBSERVE_ONLY", reason: "end of pilot" }, { id: connectionId })
    expect(demote.json.change).toMatchObject({ outcome: "DEMOTED", levelTo: "OBSERVE_ONLY" })
    expect(await listTools("tools-after-rollback")).not.toContain("tickets.create")
  })

  it("22 final verification: chain intact, every operator change in the AuditLog, no secret anywhere, every platform invariant holds", async () => {
    await k.settle()
    expect(await ledger.verifyAuditChain()).toMatchObject({ ok: true })
    const audit = k.auditEntries().map((a) => a.action)
    for (const a of ["AGENT_ROLLOUT_CONFIGURED", "AGENT_ROLLOUT_TRANSITIONED", "AGENT_KILL_SWITCH_ACTIVATED", "AGENT_KILL_SWITCH_DEACTIVATED", "AGENT_AUTONOMY_PROMOTION", "AGENT_RECOVERY_REQUESTED", "AGENT_AUDIT_LEDGER_VERIFIED"]) {
      expect(audit, a).toContain(a)
    }
    const everything = JSON.stringify({ observations, tables: [k.approval._auditEvents, k.approval._auditLogs, k.approval._requests, k.approval._tasks, k.approval._credentials].map((m) => Array.from(m.values())) })
    expect(everything).not.toContain(token)
    const evidence = await rows()
    const violations = checkInvariants(
      observations,
      {
        ledger: evidence.map((r) => ({ sequence: r.sequence, action: r.action, outcome: r.outcome, requestId: r.requestId, connectionId: r.connectionId, ownerId: r.ownerId, capabilityId: r.capabilityId, riskTier: r.riskTier })),
        ledgerChainValid: true,
        writes: [{ model: "Ticket", id: ticketId, ownerId: "owner_e2e", change: "created" }],
        tenantMarkers: { owner_1: ["prod_1_private_never_shown"], owner_2: ["owner_2_private_marker"] },
        approvals: Array.from(k.approval._requests.values()).map((r) => ({
          publicRef: r.publicRef as string,
          status: r.status as string,
          consumedCount: evidence.filter((e) => e.action === "approval.consumed" && e.approvalRef === r.publicRef).length,
        })),
      },
      { neverExecutable: NEVER_EXECUTABLE }
    )
    expect(violations).toEqual([])
  })
})
