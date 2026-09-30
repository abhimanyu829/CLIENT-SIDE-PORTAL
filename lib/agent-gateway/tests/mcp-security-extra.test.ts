/**
 * Additional Phase 5 security/concurrency tests not covered by the other
 * mcp-*.test.ts files: token-leakage checks, concurrent tool calls, and a
 * credential-revoked-mid-request scenario.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createExecutionFakeDb } from "./execution-fake-db"
import type { AgentGatewayRequestContext } from "../shared/types"

const SECRET_TOKEN = "agw_" + "s".repeat(60)

async function setup() {
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
  const { AllowAllForTestingAuthorizer } = await import("../mcp/authorization-hook")
  const { buildAuthInfoExtra } = await import("../mcp/identity-context")

  const capabilityRegistry = new CapabilityRegistry()
  registerCoreCapabilities(capabilityRegistry)
  const adapterRegistry = new AdapterRegistry()
  registerCoreAdapters(adapterRegistry)

  return { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer: new AllowAllForTestingAuthorizer(), buildAuthInfoExtra }
}

function gatewayCtx(ownerId = "owner_1"): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId, connectionStatus: "ACTIVE", authenticatedAt: new Date() },
    protocol: "HTTP",
    signal: new AbortController().signal,
  }
}

function jsonRpcRequest(body: unknown, extraHeaders: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/agent-gateway/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...extraHeaders },
    body: JSON.stringify(body),
  })
}

describe("Phase 5 — additional security coverage", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("10. token leakage — a bearer token supplied in the Authorization header never appears in any MCP response body", async () => {
    const { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, buildAuthInfoExtra } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const ctx = gatewayCtx()
    const server = createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development")
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try {
      const authInfo = { token: SECRET_TOKEN, clientId: "conn_1", scopes: [], extra: buildAuthInfoExtra(ctx, "development") }
      const req = jsonRpcRequest(
        { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } },
        { authorization: `Bearer ${SECRET_TOKEN}` }
      )
      const res = await transport.handleRequest(req, { authInfo })
      const text = await res.text()
      expect(text).not.toContain(SECRET_TOKEN)
    } finally {
      await transport.close()
      await server.close()
    }
  })

  it("concurrency: simultaneous tools/call for the same capability from two independent requests both resolve correctly, without cross-contamination", async () => {
    const { fake, capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer, buildAuthInfoExtra } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    fake.seedProduct({ id: "p2", name: "B", slug: "b", status: "AVAILABLE", type: "SAAS" })

    async function callOnce(productId: string) {
      const ctx = gatewayCtx()
      const server = createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, ctx, "development")
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      await server.connect(transport)
      try {
        const authInfo = { token: "", clientId: "conn_1", scopes: [], extra: buildAuthInfoExtra(ctx, "development") }
        const req = jsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "products.get", arguments: { id: productId } } })
        const res = await transport.handleRequest(req, { authInfo })
        return res.json()
      } finally {
        await transport.close()
        await server.close()
      }
    }

    const [resultA, resultB] = await Promise.all([callOnce("p1"), callOnce("p2")])
    expect(resultA.result.structuredContent.id).toBe("p1")
    expect(resultB.result.structuredContent.id).toBe("p2")
  })

  it("24. revoked credential reuse — a connection whose status is not ACTIVE at execution time is denied even if the initial authentication succeeded", async () => {
    const { capabilityRegistry, adapterRegistry, createMcpServerForRequest, authorizer } = await setup()
    const revokedCtx: AgentGatewayRequestContext = {
      requestId: "req_1",
      receivedAt: new Date(),
      authenticated: true,
      machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId: "owner_1", connectionStatus: "REVOKED", authenticatedAt: new Date() },
      protocol: "HTTP",
      signal: new AbortController().signal,
    }
    const server = createMcpServerForRequest({ capabilityRegistry, adapterRegistry, authorizer }, revokedCtx, "development")
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try {
      const req = jsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "products.list", arguments: {} } })
      const res = await transport.handleRequest(req)
      const body = await res.json()
      expect(body.result.isError).toBe(true)
    } finally {
      await transport.close()
      await server.close()
    }
  })
})
