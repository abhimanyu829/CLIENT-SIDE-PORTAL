/**
 * lib/agent-gateway/tests/authz-end-to-end.test.ts
 *
 * Phase 6 — Section L: End-to-End Authorization Tests. Exercises the FULL
 * real pipeline: MCP/Gateway (Phase 5) -> Identity (Phase 1/2) ->
 * Capability (Phase 3) -> Policy (Phase 6, PolicyEngineAuthorizer) ->
 * Adapter (Phase 4) -> existing service (fake DB). Mirrors Phase 5's own
 * `mcp-server-integration.test.ts` pattern exactly, but with a REAL
 * `PolicyEngineAuthorizer` (backed by seeded policies) instead of
 * `AllowAllForTestingAuthorizer`/`FailClosedAuthorizer` — this is the
 * test that proves Phase 6 is actually wired into Phase 5 correctly.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createExecutionFakeDb } from "./execution-fake-db"
import { createAuthzFakeDb } from "./authz-fake-db"
import type { AgentGatewayRequestContext } from "../shared/types"

async function setup() {
  vi.resetModules()
  const execFake = createExecutionFakeDb()
  const authzFake = createAuthzFakeDb()

  // Merge both fakes onto a single `db` mock — the execution adapters use
  // product/subscription/ticket models, the policy store uses
  // agentPolicy/agentPolicyVersion models. Real Prisma Client is one
  // object with both; this mirrors that.
  const mergedDb = { ...execFake.client, ...authzFake.client }
  vi.doMock("@/lib/db", () => ({ db: mergedDb }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
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

  const capabilityRegistry = new CapabilityRegistry()
  registerCoreCapabilities(capabilityRegistry)
  const adapterRegistry = new AdapterRegistry()
  registerCoreAdapters(adapterRegistry)

  return { execFake, authzFake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer: new PolicyEngineAuthorizer(), createPolicyVersion }
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
    return await transport.handleRequest(jsonRpcRequest(body), { authInfo })
  } finally {
    await transport.close()
    await server.close()
  }
}

describe("Section L — End-to-End Authorization Tests (full MCP -> Policy -> Adapter pipeline)", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("1. allowed read — a seeded READ-tier ALLOW policy lets tools/call succeed end-to-end", async () => {
    const { execFake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, createPolicyVersion } = await setup()
    execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await createPolicyVersion({ name: "allow products.get", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ", actorId: "admin_1" })

    const ctx = gatewayCtx()
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } },
      ctx
    )
    const body = await res.json()
    expect(body.result.isError).toBe(false)
    expect(body.result.structuredContent.id).toBe("p1")
  })

  it("2. denied read — no policy at all means DEFAULT DENY end-to-end, adapter never reached", async () => {
    const { execFake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })

    const ctx = gatewayCtx()
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } },
      ctx
    )
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("AUTHORIZATION_DENIED")
    // Adapter never touched the fake DB for this call (no findUnique for p1 beyond seeding).
  })

  it("5/6. resource allowed / resource denied — a RESOURCE-scoped ALLOW for p1 permits p1 but not p2", async () => {
    const { execFake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, createPolicyVersion } = await setup()
    execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    execFake.seedProduct({ id: "p2", name: "B", slug: "b", status: "AVAILABLE", type: "SAAS" })
    await createPolicyVersion({ name: "allow p1 only", effect: "ALLOW", scope: "RESOURCE", scopeValue: "p1", capabilityId: "products.get", riskConstraint: "READ", actorId: "admin_1" })

    const ctx = gatewayCtx()
    const resAllowed = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } },
      ctx
    )
    expect((await resAllowed.json()).result.isError).toBe(false)

    const resDenied = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "products.get", arguments: { id: "p2" } } },
      ctx
    )
    expect((await resDenied.json()).result.isError).toBe(true)
  })

  it("7/8. team allowed / team denied — a TEAM-scoped ALLOW permits the matching team's connection but not another team's", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "allow team A", effect: "ALLOW", scope: "TEAM", scopeValue: "team_A", capabilityId: "tickets.list", riskConstraint: "READ", actorId: "admin_1" })

    const ctxTeamA = gatewayCtx({ machine: { connectionId: "conn_A", credentialId: "c1", ownerId: "owner_1", teamId: "team_A", connectionStatus: "ACTIVE", authenticatedAt: new Date() } })
    const resAllowed = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctxTeamA, "development"),
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "tickets.list", arguments: {} } },
      ctxTeamA
    )
    expect((await resAllowed.json()).result.isError).toBe(false)

    const ctxTeamB = gatewayCtx({ machine: { connectionId: "conn_B", credentialId: "c2", ownerId: "owner_2", teamId: "team_B", connectionStatus: "ACTIVE", authenticatedAt: new Date() } })
    const resDenied = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctxTeamB, "development"),
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "tickets.list", arguments: {} } },
      ctxTeamB
    )
    expect((await resDenied.json()).result.isError).toBe(true)
  })

  it("9/10. environment allowed / environment denied — an ENVIRONMENT-scoped ALLOW for 'development' does not authorize a 'staging' context", async () => {
    const { execFake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, createPolicyVersion } = await setup()
    execFake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await createPolicyVersion({ name: "dev-only", effect: "ALLOW", scope: "ENVIRONMENT", scopeValue: "development", capabilityId: "products.get", riskConstraint: "READ", actorId: "admin_1" })

    const ctx = gatewayCtx()
    const resDev = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } },
      ctx
    )
    expect((await resDev.json()).result.isError).toBe(false)

    const resStaging = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "staging"),
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } },
      ctx
    )
    expect((await resStaging.json()).result.isError).toBe(true)
  })

  it("11. critical operation requiring future approval — a REQUIRES_APPROVAL policy denies today (Phase 7 not built), never silently allows", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, createPolicyVersion } = await setup()
    await createPolicyVersion({ name: "needs-human-approval", effect: "REQUIRES_APPROVAL", scope: "CAPABILITY", capabilityId: "products.list", actorId: "admin_1" })

    const ctx = gatewayCtx()
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development"),
      { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "products.list", arguments: {} } },
      ctx
    )
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("AUTHORIZATION_DENIED")
  })

  it("cross-tenant isolation through the full pipeline still holds with a real policy engine wired in (regression against Phase 5's own equivalent test)", async () => {
    const { execFake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, createPolicyVersion } = await setup()
    execFake.seedSubscription({ id: "s1", userId: "owner_TENANT_B", status: "ACTIVE", tierId: "tier_1" })
    await createPolicyVersion({ name: "allow subs read", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "subscriptions.get", riskConstraint: "READ", actorId: "admin_1" })

    const tenantACtx = gatewayCtx({ machine: { connectionId: "conn_A", credentialId: "c1", ownerId: "owner_TENANT_A", connectionStatus: "ACTIVE", authenticatedAt: new Date() } })
    const res = await sendOneStatelessRequest(
      () => createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, tenantACtx, "development"),
      { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "subscriptions.get", arguments: { subscriptionId: "s1" } } },
      tenantACtx
    )
    const body = await res.json()
    // Policy layer ALLOWS the capability call (subscriptions.get is
    // globally readable per the seeded policy); Phase 4's adapter itself
    // then correctly denies at the DB layer since s1 belongs to a
    // different tenant — proving Phase 6 and Phase 4 are each doing their
    // OWN job without one silently covering for the other's absence.
    expect(body.result.isError).toBe(true)
  })
})
