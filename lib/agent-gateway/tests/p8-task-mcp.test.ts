/**
 * Phase 8 — end to end through the REAL MCP server (Phase 5), the REAL
 * ExecutionGate wrapping the REAL PolicyEngineAuthorizer (Phase 6, seeded
 * policies), the REAL task engine and worker, and the REAL Phase 4 adapters
 * over fake business data. Cross-phase scenarios 1, 2, 6, 8 and the master
 * security probes against the task tools.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createExecutionFakeDb } from "./execution-fake-db"
import { createAuthzFakeDb } from "./authz-fake-db"
import { createApprovalFakeDb } from "./approval-fake-db"
import { InMemoryTaskQueue, TEST_CONFIG, SUPER_APPROVER } from "./task-test-kit"
import type { AgentGatewayRequestContext } from "../shared/types"

async function setup() {
  vi.resetModules()
  const execFake = createExecutionFakeDb()
  const authzFake = createAuthzFakeDb()
  const approvalFake = createApprovalFakeDb()
  approvalFake.seedConnection({ id: "conn_1", name: "Claude" })
  approvalFake.seedConnection({ id: "conn_2", name: "Other", ownerId: "owner_2" })
  approvalFake.seedUser({ id: "admin_1", phone: "+919999999999", phoneVerified: true })
  const merged: Record<string, unknown> = { ...execFake.client, ...authzFake.client, ...approvalFake.client }
  merged.$transaction = async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : (arg as (tx: unknown) => Promise<unknown>)(merged)
  vi.doMock("@/lib/db", () => ({ db: merged }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({ getById: vi.fn(async (id: string) => ({ id, environment: "development" })) }),
  }))

  const { CapabilityRegistry } = await import("../capabilities/registry")
  const { registerCoreCapabilities } = await import("../capabilities/manifest")
  const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
  const { registerCoreAdapters } = await import("../execution/adapters/index")
  const { createMcpServerForRequest } = await import("../mcp/server")
  const { PolicyEngineAuthorizer } = await import("../authorization/authorizer")
  const { createPolicyVersion } = await import("../authorization/policy-store")
  const { ExecutionGate } = await import("../execution-gate/gate")
  const { AgentTaskService } = await import("../tasks/engine")
  const { AgentTaskWorker } = await import("../tasks/worker")
  const { TaskQueueUnavailableError } = await import("../tasks/queue")
  const { AGENT_TASK_JOBS } = await import("@/lib/queue")
  const autonomyStore = await import("../autonomy/policy-store")
  const decisions = await import("../approvals/decision-service")
  const { buildAuthInfoExtra } = await import("../mcp/identity-context")

  const registry = new CapabilityRegistry()
  registerCoreCapabilities(registry)
  const adapters = new AdapterRegistry()
  registerCoreAdapters(adapters)
  const queue = new InMemoryTaskQueue(TaskQueueUnavailableError)
  const config = { ...TEST_CONFIG }
  // Production wiring: one gate shared by direct calls and the task engine.
  const gate = new ExecutionGate({ authorization: new PolicyEngineAuthorizer() })
  const taskService = new AgentTaskService({ capabilityRegistry: registry, adapterRegistry: adapters, gate, queue, config })
  const worker = new AgentTaskWorker({ capabilityRegistry: registry, adapterRegistry: adapters, gate: new ExecutionGate({ authorization: new PolicyEngineAuthorizer() }), queue, config, environment: "development" })

  function ctx(connectionId = "conn_1", ownerId = "owner_1"): AgentGatewayRequestContext {
    return {
      requestId: `req_${Math.random().toString(16).slice(2)}`,
      receivedAt: new Date(),
      authenticated: true,
      machine: { connectionId, credentialId: "cred_1", ownerId, connectionStatus: "ACTIVE", authenticatedAt: new Date() },
      protocol: "HTTP",
      signal: new AbortController().signal,
    }
  }

  async function rpc(method: string, params: Record<string, unknown>, gatewayContext = ctx(), withTasks = true) {
    const server = createMcpServerForRequest(
      { capabilityRegistry: registry, adapterRegistry: adapters, authorizer: gate, taskService: withTasks ? taskService : undefined },
      gatewayContext,
      "development"
    )
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try {
      const authInfo = { token: "", clientId: gatewayContext.machine!.connectionId, scopes: [], extra: buildAuthInfoExtra(gatewayContext, "development") }
      const res = await transport.handleRequest(
        new Request("https://example.com/api/agent-gateway/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }),
        { authInfo }
      )
      return (await res.json()) as { result?: any; error?: any }
    } finally {
      await transport.close()
      await server.close()
    }
  }

  const call = (name: string, args: Record<string, unknown>, gatewayContext = ctx()) => rpc("tools/call", { name, arguments: args }, gatewayContext)

  async function drain() {
    for (let i = 0; i < 20; i += 1) {
      const job = queue.take()
      if (!job) return
      await worker.process({ name: AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })
    }
  }

  const allowRead = (capabilityId: string) =>
    createPolicyVersion({ name: `allow ${capabilityId}`, effect: "ALLOW", scope: "CAPABILITY", capabilityId, riskConstraint: "READ", actorId: "admin_1" })

  async function humanApprove(text: string) {
    const ref = /apr_[0-9a-f]{32}/.exec(text)![0]
    const row = Array.from(approvalFake._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.startApprovalStepUp(ref, SUPER_APPROVER, new Date(), async () => true)
    await decisions.decideApproval({ publicRef: ref, decision: "APPROVE", approver: SUPER_APPROVER, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" })
  }

  return { execFake, approvalFake, rpc, call, drain, allowRead, autonomyStore, humanApprove, ctx, queue }
}

const text = (r: { result?: any }) => r.result?.content?.[0]?.text as string

describe("Phase 8 through MCP", () => {
  beforeEach(() => vi.resetModules())

  it("task tools are listed only when the task engine is wired; names never collide with capability ids", async () => {
    const t = await setup()
    const withTasks = ((await t.rpc("tools/list", {})).result.tools as Array<{ name: string }>).map((x) => x.name)
    const without = ((await t.rpc("tools/list", {}, t.ctx(), false)).result.tools as Array<{ name: string }>).map((x) => x.name)
    expect(withTasks).toEqual(expect.arrayContaining(["agent_task_submit", "agent_task_status", "agent_task_cancel"]))
    expect(without).not.toContain("agent_task_submit")
    expect(withTasks.filter((n) => !n.startsWith("agent_task_"))).toEqual(without)
  })

  it("Scenario 1: submit -> queue -> worker -> existing adapter -> DB -> status SUCCEEDED with the filtered result", async () => {
    const t = await setup()
    t.execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await t.allowRead("products.get")
    const submitted = await t.call("agent_task_submit", { capabilityId: "products.get", input: { id: "p1" } })
    expect(submitted.result.isError).toBe(false)
    const ref = submitted.result.structuredContent.taskRef as string
    expect(submitted.result.structuredContent.status).toBe("QUEUED")
    await t.drain()
    const status = await t.call("agent_task_status", { taskRef: ref })
    expect(status.result.structuredContent).toMatchObject({ status: "SUCCEEDED", attempts: 1, result: { id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" } })
  })

  it("the direct capability tool is unchanged (still synchronous)", async () => {
    const t = await setup()
    t.execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await t.allowRead("products.get")
    const direct = await t.call("products.get", { id: "p1" })
    expect(direct.result.structuredContent.id).toBe("p1")
    expect(t.queue.enqueued).toHaveLength(0)
  })

  it("default deny applies to async submission exactly like a direct call; no task is created", async () => {
    const t = await setup()
    const res = await t.call("agent_task_submit", { capabilityId: "products.get", input: { id: "p1" } })
    expect(text(res).startsWith("AUTHORIZATION_DENIED:")).toBe(true)
    expect(t.approvalFake._tasks.size).toBe(0)
  })

  it("Scenario 2: approval required -> human approves -> async task bound to the approval -> executes once", async () => {
    const t = await setup()
    t.execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await t.allowRead("products.get")
    await t.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: "admin_1" })
    const first = await t.call("agent_task_submit", { capabilityId: "products.get", input: { id: "p1" } })
    expect(text(first).startsWith("APPROVAL_REQUIRED:")).toBe(true)
    await t.humanApprove(text(first))
    const second = await t.call("agent_task_submit", { capabilityId: "products.get", input: { id: "p1" } })
    const ref = second.result.structuredContent.taskRef as string
    const row = Array.from(t.approvalFake._tasks.values()).find((r) => r.taskRef === ref)! as Record<string, any>
    expect(row.approvalRequestId).toBeTruthy()
    await t.drain()
    expect((await t.call("agent_task_status", { taskRef: ref })).result.structuredContent.status).toBe("SUCCEEDED")
  })

  it("Scenario 6: authorization revoked while queued -> the task never executes", async () => {
    const t = await setup()
    t.execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const policyRow = await t.allowRead("products.get")
    const submitted = await t.call("agent_task_submit", { capabilityId: "products.get", input: { id: "p1" } })
    const ref = submitted.result.structuredContent.taskRef as string
    const { disablePolicy } = await import("../authorization/policy-store")
    await disablePolicy(policyRow.policyId)
    await t.drain()
    expect((await t.call("agent_task_status", { taskRef: ref })).result.structuredContent).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
    expect(t.execFake.client.product.findUnique).not.toHaveBeenCalled()
  })

  it("Scenario 8: connection revoked while pending -> the task never executes", async () => {
    const t = await setup()
    t.execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await t.allowRead("products.get")
    const submitted = await t.call("agent_task_submit", { capabilityId: "products.get", input: { id: "p1" } })
    const ref = submitted.result.structuredContent.taskRef as string
    t.approvalFake.updateConnection("conn_1", { status: "REVOKED" })
    await t.drain()
    const row = Array.from(t.approvalFake._tasks.values()).find((r) => r.taskRef === ref)! as Record<string, any>
    expect(row).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
    expect(t.execFake.client.product.findUnique).not.toHaveBeenCalled()
  })

  it("security: another tenant cannot read or cancel my task (identical TASK_NOT_FOUND)", async () => {
    const t = await setup()
    await t.allowRead("products.list")
    const submitted = await t.call("agent_task_submit", { capabilityId: "products.list", input: {} })
    const ref = submitted.result.structuredContent.taskRef as string
    const other = t.ctx("conn_2", "owner_2")
    const s = await t.call("agent_task_status", { taskRef: ref }, other)
    const c = await t.call("agent_task_cancel", { taskRef: ref }, other)
    const unknown = await t.call("agent_task_status", { taskRef: "atk_" + "1".repeat(32) })
    expect(text(s)).toBe("TASK_NOT_FOUND: Task not found.")
    expect(text(c)).toBe(text(s))
    expect(text(unknown)).toBe(text(s))
  })

  it("security: identity, adapter, owner and approval cannot be supplied as tool arguments", async () => {
    const t = await setup()
    await t.allowRead("products.list")
    for (const forged of [{ ownerId: "owner_2" }, { connectionId: "conn_2" }, { adapterId: "refunds.processAdapter" }, { approvalRequestId: "apr_x" }, { environment: "production" }, { teamId: "team_x" }]) {
      const res = await t.call("agent_task_submit", { capabilityId: "products.list", input: {}, ...forged })
      expect(res.result?.isError ?? true).toBe(true)
    }
    expect(t.approvalFake._tasks.size).toBe(0)
  })

  it("security: FORBIDDEN / INTERNAL capabilities cannot be submitted asynchronously", async () => {
    const t = await setup()
    for (const capabilityId of ["refunds.process", "products.updatePricing", "../../etc/passwd", "products.get@v1"]) {
      const res = await t.call("agent_task_submit", { capabilityId, input: {} })
      expect(text(res).startsWith("CAPABILITY_NOT_FOUND:")).toBe(true)
    }
  })
})
