/**
 * Phase 11 C — observability: one trace id per agent operation across every
 * layer and async boundary (MCP request -> gate -> resolver -> adapter;
 * task submission -> stored traceId -> worker; webhook -> trigger -> task ->
 * worker), allowlisted span attributes, and request-level evidence.
 *
 * Runs the REAL Phase 5 MCP server, Phase 7 gate, Phase 8 engine/worker,
 * Phase 9 webhook handler and the Phase 11 ledger (governance test kit).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildGovernanceKit, SUPER, type GovernanceKit } from "./governance-test-kit"
import type { SpanRecord } from "../observability/tracing"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit
let spans: SpanRecord[]
let removeObserver: () => void
let obs: {
  withRequestTrace: typeof import("../observability/request-evidence").withRequestTrace
  tracing: typeof import("../observability/tracing")
  traceContext: typeof import("../observability/trace-context")
  ledger: typeof import("../audit-ledger")
  metrics: typeof import("../observability/agent-metrics")
}

beforeEach(async () => {
  k = await buildGovernanceKit()
  obs = {
    withRequestTrace: (await import("../observability/request-evidence")).withRequestTrace,
    tracing: await import("../observability/tracing"),
    traceContext: await import("../observability/trace-context"),
    ledger: await import("../audit-ledger"),
    metrics: await import("../observability/agent-metrics"),
  }
  await obs.ledger.flushAuditLedger()
  spans = []
  removeObserver = obs.tracing.addSpanObserver((s) => spans.push(s))
})

afterEach(() => removeObserver())

const ledgerRows = () => (Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>).sort((a, b) => a.sequence - b.sequence)
const reqId = (c: string) => `req_${c.repeat(32)}`

describe("Phase 11 C — one trace across a synchronous MCP call", () => {
  it("request, authorization, execution and business-service spans share the request's trace id; ledger events carry it too", async () => {
    await k.allowRead("products.get")
    const requestId = reqId("a")
    const ctx = { ...k.agentCtx(), requestId }
    const out = await obs.withRequestTrace("MCP", requestId, () => k.tool("products.get", { id: "prod_1" }, ctx))
    expect(out.isError).toBe(false)
    await obs.ledger.flushAuditLedger()

    const request = spans.find((s) => s.name === "agent.request")!
    expect(request.attributes).toMatchObject({ "agent.protocol": "MCP", "agent.request.id": requestId })
    const traceId = request.traceId!
    expect(obs.traceContext.isValidTraceId(traceId)).toBe(true)
    for (const name of ["agent.authorization", "agent.execution", "agent.business_service"] as const) {
      const span = spans.find((s) => s.name === name)
      expect(span, name).toBeDefined()
      expect(span!.traceId, name).toBe(traceId)
      expect(span!.status).toBe("OK")
    }
    const evidence = ledgerRows().filter((r) => r.requestId === requestId)
    expect(evidence.map((r) => r.action)).toEqual(expect.arrayContaining(["authorization.allowed", "execution.succeeded"]))
    for (const r of evidence) expect(r.traceId).toBe(traceId)
  })

  it("span attributes are allowlisted: no input values, owner ids, emails or free text ever become attributes", async () => {
    await k.allowRead("products.get")
    await obs.withRequestTrace("MCP", reqId("b"), () => k.tool("products.get", { id: "prod_1" }, { ...k.agentCtx(), requestId: reqId("b") }))
    const keys = new Set(spans.flatMap((s) => Object.keys(s.attributes)))
    for (const key of keys) expect(key).toMatch(/^agent\./)
    const values = JSON.stringify(spans.map((s) => s.attributes))
    expect(values).not.toContain("prod_1")
    expect(values).not.toContain("owner_1")
    expect(obs.tracing.sanitizeSpanAttributes({ "agent.capability.id": "products.get", "agent.input": "secret", "user.email": "a@b.c", "agent.reason_code": "has spaces; DROP" })).toEqual({
      "agent.capability.id": "products.get",
      "agent.reason_code": "redacted",
    })
  })

  it("a failing span records only the stable error code, never the message", async () => {
    const { ExecutionError } = await import("../execution/contracts/execution-error")
    await expect(
      obs.tracing.withAgentSpan("agent.execution", {}, async () => {
        throw new ExecutionError("INTERNAL_ERROR", "connection string postgres://u:p@h/db leaked")
      })
    ).rejects.toThrow()
    const failed = spans.at(-1)!
    expect(failed).toMatchObject({ name: "agent.execution", status: "ERROR", errorCode: "INTERNAL_ERROR" })
    expect(JSON.stringify(failed)).not.toContain("postgres://")
  })

  it("an inbound traceparent header is never trusted: every request gets a server-side trace id", async () => {
    const traces = new Set<string>()
    for (const c of ["c", "d", "e"]) {
      await obs.withRequestTrace("MCP", reqId(c), async () => {
        traces.add(obs.traceContext.currentTraceContext()!.traceId)
      })
    }
    expect(traces.size).toBe(3)
    const source = (await import("fs")).readFileSync((await import("path")).resolve("lib/agent-gateway/observability/trace-context.ts"), "utf8")
    expect(source).not.toMatch(/headers\.get\(["']traceparent/)
  })
})

describe("Phase 11 C — the trace continues into the worker", () => {
  it("submission stores the trace id on the task; the worker's spans and ledger events continue it with the task ref", async () => {
    await k.allowRead("products.get")
    const requestId = reqId("f")
    let requestTrace = ""
    const submitted = await obs.withRequestTrace("MCP", requestId, async () => {
      requestTrace = obs.traceContext.currentTraceContext()!.traceId
      return k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } }, { ...k.agentCtx(), requestId })
    })
    expect(submitted.isError).toBe(false)
    const taskRef = submitted.json.taskRef as string
    expect(k.taskRow(taskRef)!.traceId).toBe(requestTrace)

    // The worker runs later, in another "process", outside any request scope.
    expect(obs.traceContext.currentTraceContext()).toBeUndefined()
    await k.drain()
    expect(k.taskRow(taskRef)!.status).toBe("SUCCEEDED")
    await obs.ledger.flushAuditLedger()

    const worker = spans.find((s) => s.name === "agent.worker")!
    expect(worker.traceId).toBe(requestTrace)
    const workerExecution = spans.filter((s) => s.name === "agent.execution").at(-1)!
    expect(workerExecution.traceId).toBe(requestTrace)

    const taskEvents = ledgerRows().filter((r) => r.taskRef === taskRef)
    expect(taskEvents.map((r) => r.action)).toEqual(expect.arrayContaining(["task.created", "task.queued", "task.started", "task.succeeded", "execution.succeeded"]))
    for (const r of taskEvents) {
      expect(r.traceId, r.action).toBe(requestTrace)
      expect(r.requestId, r.action).toBe(requestId)
    }
  })

  it("a webhook firing gets one trace from delivery to the task's execution, carrying the trigger ref", async () => {
    await k.allowRead("products.list")
    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list" }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    const res = await k.deliver(trigger.triggerRef, k.signedWebhook(trigger.triggerRef, webhookSecret!, { type: "order.created" }))
    expect(res.status).toBe(202)
    await k.drain()
    await obs.ledger.flushAuditLedger()

    const accepted = ledgerRows().find((r) => r.action === "webhook.accepted")!
    expect(accepted.triggerRef).toBe(trigger.triggerRef)
    const traceId = accepted.traceId as string
    expect(obs.traceContext.isValidTraceId(traceId)).toBe(true)
    const task = Array.from(k.approval._tasks.values()).find((t) => t.triggerId)!
    expect(task.traceId).toBe(traceId)
    const executed = ledgerRows().filter((r) => r.taskRef === task.taskRef && r.action === "execution.succeeded")
    expect(executed).toHaveLength(1)
    expect(executed[0].traceId).toBe(traceId)
    expect(spans.find((s) => s.name === "agent.trigger")?.traceId).toBe(traceId)
  })
})

describe("Phase 11 C — request-level evidence", () => {
  it("unauthenticated failures are counted and evidenced, but throttled per failure code", async () => {
    const evidence = await import("../observability/request-evidence")
    for (let i = 0; i < 30; i += 1) evidence.recordAuthenticationFailure("MCP", reqId("1"), "AUTH_INVALID")
    evidence.recordAuthenticationFailure("HTTP", reqId("2"), "SIGNATURE_INVALID")
    await obs.ledger.flushAuditLedger()
    const failures = ledgerRows().filter((r) => r.action === "authentication.failed")
    expect(failures).toHaveLength(2)
    expect(failures.map((r) => r.errorCode).sort()).toEqual(["AUTH_INVALID", "SIGNATURE_INVALID"])
    expect(obs.metrics.counterTotal("agent_requests_total", { protocol: "MCP", outcome: "DENIED" })).toBe(30)
    expect(obs.metrics.counterTotal("agent_security_denial_total", { reason: "AUTH_INVALID" })).toBe(30)
  })

  it("the real MCP route handler opens the request trace and counts the request", async () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    try {
      vi.doMock("../auth/composite-authenticator", () => ({
        CompositeAuthenticator: class {
          authenticate = vi.fn(async () => ({ authenticated: false, failureCode: "AUTH_INVALID" }))
        },
      }))
      const { __resetGatewayConfigForTests } = await import("../config")
      const { __resetMcpConfigForTests } = await import("../mcp/config")
      __resetGatewayConfigForTests()
      __resetMcpConfigForTests()
      const { handleMcpRequest } = await import("../mcp/route-handler")
      const res = await handleMcpRequest(
        new Request("https://abhibhideveloper.online/api/agent-gateway/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream", traceparent: "00-" + "f".repeat(32) + "-" + "1".repeat(16) + "-01" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        })
      )
      expect(res.status).toBe(401)
      const request = spans.find((s) => s.name === "agent.request")!
      expect(request.attributes["agent.protocol"]).toBe("MCP")
      expect(request.traceId).not.toBe("f".repeat(32))
      expect(request.attributes["agent.request.id"]).toMatch(/^req_[0-9a-f]{32}$/)
      await obs.ledger.flushAuditLedger()
      expect(ledgerRows().find((r) => r.action === "authentication.failed")).toMatchObject({ errorCode: "AUTH_INVALID", traceId: request.traceId })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
