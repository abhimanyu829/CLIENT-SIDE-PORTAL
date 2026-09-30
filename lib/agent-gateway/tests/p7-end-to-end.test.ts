/**
 * Phase 7 — Section U: end-to-end scenarios through the FULL real pipeline:
 * MCP (Phase 5) -> identity (Phase 1/2) -> capability (Phase 3) ->
 * ExecutionGate (Phase 7) wrapping PolicyEngineAuthorizer (Phase 6) ->
 * adapter (Phase 4) -> existing data (fake DB), with the human decision made
 * through the real decision service. Mirrors authz-end-to-end.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createExecutionFakeDb } from "./execution-fake-db"
import { createAuthzFakeDb } from "./authz-fake-db"
import { createApprovalFakeDb } from "./approval-fake-db"
import type { AgentGatewayRequestContext } from "../shared/types"

const SUPER = { userId: "admin_1", role: "SUPER_ADMIN", sessionReference: "sess_1" }

async function setup() {
  vi.resetModules()
  const execFake = createExecutionFakeDb()
  const authzFake = createAuthzFakeDb()
  const approvalFake = createApprovalFakeDb()
  approvalFake.seedConnection({ id: "conn_1", name: "Claude" })
  approvalFake.seedUser({ id: "admin_1", phone: "+919999999999", phoneVerified: true })

  const mergedDb: Record<string, unknown> = { ...execFake.client, ...authzFake.client, ...approvalFake.client }
  // One transaction surface over every model, like the real Prisma client.
  mergedDb.$transaction = async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : (arg as (tx: unknown) => Promise<unknown>)(mergedDb)
  vi.doMock("@/lib/db", () => ({ db: mergedDb }))
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
  const autonomyStore = await import("../autonomy/policy-store")
  const decisions = await import("../approvals/decision-service")

  const capabilityRegistry = new CapabilityRegistry()
  registerCoreCapabilities(capabilityRegistry)
  const adapterRegistry = new AdapterRegistry()
  registerCoreAdapters(adapterRegistry)
  // Exactly the production wiring in mcp/route-handler.ts.
  const authorizer = new ExecutionGate({ authorization: new PolicyEngineAuthorizer() })

  async function callTool(name: string, args: Record<string, unknown>) {
    const ctx = gatewayCtx()
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
      ctx
    )
    const body = await res.json()
    return body.result as { isError: boolean; content: Array<{ text: string }>; structuredContent?: Record<string, unknown> }
  }

  async function humanApprove(text: string) {
    const ref = /apr_[0-9a-f]{32}/.exec(text)![0]
    const row = Array.from(approvalFake._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.startApprovalStepUp(ref, SUPER, new Date(), async () => true)
    await decisions.decideApproval({ publicRef: ref, decision: "APPROVE", approver: SUPER, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" })
    return ref
  }

  async function humanReject(text: string) {
    const ref = /apr_[0-9a-f]{32}/.exec(text)![0]
    const row = Array.from(approvalFake._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.decideApproval({ publicRef: ref, decision: "REJECT", approver: SUPER, confirmedBindingDigest: row.bindingDigest as string })
    return ref
  }

  const allowProductsGet = () => createPolicyVersion({ name: "allow products.get", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ", actorId: "admin_1" })
  const statusOf = (ref: string) => Array.from(approvalFake._requests.values()).find((r) => r.publicRef === ref)?.status

  return { execFake, approvalFake, callTool, humanApprove, humanReject, allowProductsGet, createPolicyVersion, autonomyStore, statusOf }
}

function gatewayCtx(): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId: "owner_1", connectionStatus: "ACTIVE", authenticatedAt: new Date() },
    protocol: "HTTP",
    signal: new AbortController().signal,
  }
}

async function sendOneStatelessRequest(
  buildServer: () => import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
  body: unknown,
  gatewayContext: AgentGatewayRequestContext
): Promise<Response> {
  const { buildAuthInfoExtra } = await import("../mcp/identity-context")
  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    const authInfo = { token: "", clientId: gatewayContext.machine?.connectionId ?? "", scopes: [], extra: buildAuthInfoExtra(gatewayContext, "development") }
    const request = new Request("https://example.com/api/agent-gateway/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    })
    return await transport.handleRequest(request, { authInfo })
  } finally {
    await transport.close()
    await server.close()
  }
}

const seedP1 = (execFake: ReturnType<typeof createExecutionFakeDb>) => {
  execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
  execFake.seedProduct({ id: "p2", name: "B", slug: "b", status: "AVAILABLE", type: "SAAS" })
}

describe("Section U — end-to-end scenarios (MCP -> Gate -> Policy -> Adapter)", () => {
  beforeEach(() => vi.resetModules())

  it("1. authorized READ with no autonomy policy runs autonomously end to end", async () => {
    const t = await setup()
    seedP1(t.execFake)
    await t.allowProductsGet()
    const r = await t.callTool("products.get", { id: "p1" })
    expect(r.isError).toBe(false)
    expect(r.structuredContent?.id).toBe("p1")
    expect(t.approvalFake._requests.size).toBe(0)
  })

  it("2. approval required -> human approves with SMS step-up -> identical retry executes once -> replay blocked", async () => {
    const t = await setup()
    seedP1(t.execFake)
    await t.allowProductsGet()
    await t.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", approvalRequiredFor: ["products.get"], actorId: "admin_1" })

    const first = await t.callTool("products.get", { id: "p1" })
    expect(first.isError).toBe(true)
    expect(first.content[0].text.startsWith("APPROVAL_REQUIRED:")).toBe(true)
    expect(first.structuredContent).toBeUndefined() // adapter never ran

    const ref = await t.humanApprove(first.content[0].text)
    const second = await t.callTool("products.get", { id: "p1" })
    expect(second.isError).toBe(false)
    expect(second.structuredContent?.id).toBe("p1")
    expect(t.statusOf(ref)).toBe("CONSUMED")

    const replay = await t.callTool("products.get", { id: "p1" })
    expect(replay.content[0].text.startsWith("APPROVAL_REQUIRED:")).toBe(true)
  })

  it("3. Phase 6 REQUIRES_APPROVAL is routed into the approval engine (not a bare denial)", async () => {
    const t = await setup()
    seedP1(t.execFake)
    await t.createPolicyVersion({ name: "gate products.get", effect: "REQUIRES_APPROVAL", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ", actorId: "admin_1" })
    const r = await t.callTool("products.get", { id: "p1" })
    expect(r.content[0].text.startsWith("APPROVAL_REQUIRED:")).toBe(true)
    const ref = await t.humanApprove(r.content[0].text)
    const ok = await t.callTool("products.get", { id: "p1" })
    expect(ok.isError).toBe(false)
    expect(t.statusOf(ref)).toBe("CONSUMED")
  })

  it("4. Phase 6 default deny: AUTHORIZATION_DENIED, no approval request is ever created", async () => {
    const t = await setup()
    seedP1(t.execFake)
    const r = await t.callTool("products.get", { id: "p1" })
    expect(r.content[0].text.startsWith("AUTHORIZATION_DENIED:")).toBe(true)
    expect(t.approvalFake._requests.size).toBe(0)
  })

  it("5. human rejection: the agent's retry gets APPROVAL_REJECTED and nothing executes", async () => {
    const t = await setup()
    seedP1(t.execFake)
    await t.allowProductsGet()
    await t.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: "admin_1" })
    const first = await t.callTool("products.get", { id: "p1" })
    await t.humanReject(first.content[0].text)
    const retry = await t.callTool("products.get", { id: "p1" })
    expect(retry.content[0].text.startsWith("APPROVAL_REJECTED:")).toBe(true)
    expect(retry.structuredContent).toBeUndefined()
  })

  it("6. approval for resource p1 never authorizes resource p2", async () => {
    const t = await setup()
    seedP1(t.execFake)
    await t.allowProductsGet()
    await t.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: "admin_1" })
    const ref = await t.humanApprove((await t.callTool("products.get", { id: "p1" })).content[0].text)
    const other = await t.callTool("products.get", { id: "p2" })
    expect(other.isError).toBe(true)
    expect(other.content[0].text.startsWith("APPROVAL_REQUIRED:")).toBe(true)
    expect(t.statusOf(ref)).toBe("APPROVED")
  })

  it("7. autonomy policy changed by an admin after approval -> APPROVAL_POLICY_CHANGED", async () => {
    const t = await setup()
    seedP1(t.execFake)
    await t.allowProductsGet()
    const opts = { connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY" as const, maxRiskTier: "READ" as const, approvalRequiredFor: ["products.get"], actorId: "admin_1" }
    await t.autonomyStore.setAutonomyPolicy(opts)
    const ref = await t.humanApprove((await t.callTool("products.get", { id: "p1" })).content[0].text)
    await t.autonomyStore.setAutonomyPolicy(opts) // new version, same content
    const r = await t.callTool("products.get", { id: "p1" })
    expect(r.content[0].text.startsWith("APPROVAL_POLICY_CHANGED:")).toBe(true)
    expect(t.statusOf(ref)).toBe("CANCELLED")
  })

  it("8. OBSERVE_ONLY default blocks a mutation before any adapter or approval", async () => {
    const t = await setup()
    await t.createPolicyVersion({ name: "allow coupons", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "coupons.create", riskConstraint: "LOW_RISK_WRITE", actorId: "admin_1" })
    const r = await t.callTool("coupons.create", { code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10 })
    expect(r.content[0].text.startsWith("AUTONOMY_DENIED:")).toBe(true)
    expect(t.approvalFake._requests.size).toBe(0)
  })

  it("9. ASSISTED mutation requires approval; the approval surface path is returned to the agent", async () => {
    const t = await setup()
    await t.createPolicyVersion({ name: "allow coupons", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "coupons.create", riskConstraint: "LOW_RISK_WRITE", actorId: "admin_1" })
    await t.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", actorId: "admin_1" })
    const r = await t.callTool("coupons.create", { code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10 })
    expect(r.content[0].text).toMatch(/^APPROVAL_REQUIRED: .*\/admin\/agent-approvals\/apr_[0-9a-f]{32}/)
    const row = Array.from(t.approvalFake._requests.values())[0]
    expect((row.displaySummary as Record<string, unknown>).riskTier).toBe("LOW_RISK_WRITE")
  })

  it("10. the agent cannot approve through MCP: no tool exists for approvals or autonomy", async () => {
    const t = await setup()
    const ctx = gatewayCtx()
    const { createMcpServerForRequest } = await import("../mcp/server")
    const { CapabilityRegistry } = await import("../capabilities/registry")
    const { registerCoreCapabilities } = await import("../capabilities/manifest")
    const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
    const reg = new CapabilityRegistry()
    registerCoreCapabilities(reg)
    const { ExecutionGate } = await import("../execution-gate/gate")
    const { PolicyEngineAuthorizer } = await import("../authorization/authorizer")
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry: reg, adapterRegistry: new AdapterRegistry(), authorizer: new ExecutionGate({ authorization: new PolicyEngineAuthorizer() }) }, ctx, "development"),
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      ctx
    )
    const names = ((await res.json()).result.tools as Array<{ name: string }>).map((x) => x.name)
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) expect(n).not.toMatch(/approv|autonomy|cua|decision/i)
    // Calling a non-existent approval tool is refused by the MCP layer (either a
    // JSON-RPC error or an isError tool result) and changes no approval state.
    const attempt = await t.callTool("approvals.approve", { ref: "apr_x" })
    expect(attempt === undefined || attempt.isError === true).toBe(true)
    expect(t.approvalFake._decisions.size).toBe(0)
  })
})
