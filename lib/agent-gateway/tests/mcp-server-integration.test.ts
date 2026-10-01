/**
 * Integration tests for mcp/server.ts's createMcpServerForRequest(),
 * exercising the REAL McpServer + WebStandardStreamableHTTPServerTransport
 * from @modelcontextprotocol/sdk against REAL JSON-RPC requests (initialize,
 * tools/list, tools/call) — only the underlying Prisma client and Redis
 * are faked (same pattern as Phase 4's execution-fake-db.ts).
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createExecutionFakeDb } from "./execution-fake-db"
import type { AgentGatewayRequestContext } from "../shared/types"

async function setup(overrides?: { authorizer?: "allow" | "denyDefault" }) {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({ getById: vi.fn(async (id: string) => ({ id, environment: "development" })) }),
  }))

  const { CapabilityRegistry } = await import("../capabilities/registry")
  const { registerCoreCapabilities } = await import("../capabilities/manifest")
  const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
  const { registerCoreAdapters } = await import("../execution/adapters/index")
  const { createMcpServerForRequest } = await import("../mcp/server")
  const { AllowAllForTestingAuthorizer, FailClosedAuthorizer } = await import("../mcp/authorization-hook")

  const capabilityRegistry = new CapabilityRegistry()
  registerCoreCapabilities(capabilityRegistry)
  const adapterRegistry = new AdapterRegistry()
  registerCoreAdapters(adapterRegistry)

  const authorizer = overrides?.authorizer === "denyDefault" ? new FailClosedAuthorizer() : new AllowAllForTestingAuthorizer()

  return { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer }
}

function gatewayCtx(overrides: Partial<AgentGatewayRequestContext> = {}): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId: "owner_1", connectionStatus: "ACTIVE", authenticatedAt: new Date() },
    protocol: "HTTP",
    signal: new AbortController().signal,
    ...overrides,
  }
}

function jsonRpcRequest(body: unknown): Request {
  return new Request("https://example.com/api/agent-gateway/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  })
}

/**
 * Each real HTTP request gets its OWN server + transport in this
 * architecture (matching production's route-handler.ts, and matching the
 * SDK's own stateless example — a `WebStandardStreamableHTTPServerTransport`
 * configured with `sessionIdGenerator: undefined` explicitly cannot have
 * `handleRequest()` called more than once: "Stateless transport cannot be
 * reused across requests. Create a new transport per request."). This
 * helper mirrors that: it builds one fresh server+transport, sends ONE
 * JSON-RPC call, and returns the raw Response — callers make one call per
 * invocation, never reusing the returned transport for a second call.
 */
async function sendOneStatelessRequest(
  buildServer: () => import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
  body: unknown,
  gatewayContext: AgentGatewayRequestContext = gatewayCtx()
): Promise<Response> {
  const { buildAuthInfoExtra } = await import("../mcp/identity-context")
  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    const authInfo = { token: "", clientId: gatewayContext.machine?.connectionId ?? "", scopes: [], extra: buildAuthInfoExtra(gatewayContext, "development") }
    return await transport.handleRequest(jsonRpcRequest(body), { authInfo })
  } finally {
    await transport.close()
    await server.close()
  }
}

describe("MCP server integration — initialize + tools/list + tools/call", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("1. server initialization succeeds and identifies itself", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.serverInfo.name).toBe("abhibhi-agent-gateway")
  })

  it("9. tools/list returns only Phase-3-exposed capabilities, deterministically ordered", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    const listRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }
    )
    const body = await listRes.json()
    const names = body.result.tools.map((t: { name: string }) => t.name)

    expect(names).toContain("products.list")
    expect(names).toContain("products.get")
    expect(names).toContain("subscriptions.get")
    expect(names).toContain("tickets.list")
    // Phase 3 marks products.createDraft/coupons.create AGENT_AVAILABLE
    // (their CONTRACT is agent-available in principle), but they have NO
    // registered adapter. Phase 5 listed them anyway ("listing !=
    // executability"); Phase 12 tightened the tool surface to executable
    // capabilities only, so they are no longer listed (see below).
    expect(names).not.toContain("products.createDraft")
    expect(names).not.toContain("coupons.create")
    // Never exposed regardless: INTERNAL_ONLY / FORBIDDEN capabilities.
    expect(names).not.toContain("products.updatePricing")
    expect(names).not.toContain("refunds.process")
  })

  it("an unadaptered capability (products.createDraft) is not a tool: tools/call is refused and nothing executes (Phase 12 executable-only)", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "products.createDraft", arguments: { name: "x", slug: "x", tagline: "x", description: "x", type: "SAAS" } } }
    )
    const body = await callRes.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/not found/i)
    expect(body.result.structuredContent).toBeUndefined()
  })

  it("10/12. tools/call with valid arguments executes through Phase 4 and returns structured output", async () => {
    const { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } }
    )
    const body = await callRes.json()

    expect(body.result.isError).toBe(false)
    expect(body.result.structuredContent).toEqual({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
  })

  it("11. tools/call with invalid arguments fails deterministically, never reaching the adapter", async () => {
    const { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    const before = fake.lastCallArgs("product.findUnique")
    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "products.get", arguments: { id: 12345 } } }
    )
    const body = await callRes.json()

    expect(body.result?.isError ?? body.error).toBeTruthy()
    expect(fake.lastCallArgs("product.findUnique")).toEqual(before)
  })

  it("8. unknown tool call is rejected", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "totally.unknown.tool", arguments: {} } }
    )
    const body = await callRes.json()

    expect(body.result?.isError ?? !!body.error).toBeTruthy()
  })

  it("16. a call to a tool disabled before tools/call is rejected, not executed", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    capabilityRegistry.disable("products.list", 1)

    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "products.list", arguments: {} } }
    )
    const body = await callRes.json()
    // Since the tool is no longer projected at all (disabled), the SDK
    // itself reports it as an unknown tool.
    expect(body.result?.isError ?? !!body.error).toBeTruthy()
  })

  it("Phase 6 authorization hook: FailClosedAuthorizer denies every tool call by default", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup({ authorizer: "denyDefault" })
    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, gatewayCtx(), "development"),
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "products.list", arguments: {} } }
    )
    const body = await callRes.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("AUTHORIZATION_DENIED")
  })

  it("cross-tenant isolation through the full MCP call path: connection A cannot read connection B's tenant data", async () => {
    const { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_TENANT_B", status: "ACTIVE", tierId: "tier_1" })
    const tenantACtx = gatewayCtx({ machine: { connectionId: "conn_A", credentialId: "cred_A", ownerId: "owner_TENANT_A", connectionStatus: "ACTIVE", authenticatedAt: new Date() } })
    const callRes = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, tenantACtx, "development"),
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "subscriptions.get", arguments: { subscriptionId: "s1" } } },
      tenantACtx
    )
    const body = await callRes.json()
    expect(body.result.isError).toBe(true)
  })
})
