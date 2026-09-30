/**
 * Integration tests for mcp/route-handler.ts's handleMcpRequest() — the
 * full pipeline: MCP-enabled/Gateway-enabled checks -> transport security
 * -> Phase 1 request validation -> Phase 1 authentication -> Phase 2
 * identity -> Phase 1 rate limiting -> MCP protocol handling.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"

const VALID_AUTH_RESULT = {
  authenticated: true,
  connectionId: "conn_1",
  ownerId: "owner_1",
  credentialId: "cred_1",
  connectionStatus: "ACTIVE" as const,
  authMethod: "BEARER" as const,
}

async function setup() {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({ getById: vi.fn(async (id: string) => ({ id, environment: "development" })) }),
  }))
  vi.doMock("@/lib/audit", () => ({ auditLog: vi.fn() }))

  const { __resetGatewayConfigForTests } = await import("../config")
  const { __resetMcpConfigForTests } = await import("../mcp/config")
  __resetGatewayConfigForTests()
  __resetMcpConfigForTests()

  return { fake }
}

function mcpRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://abhibhideveloper.online/api/agent-gateway/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  })
}

const INIT_BODY = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "c", version: "1" } } }

describe("handleMcpRequest", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("GATEWAY_DISABLED when AGENT_GATEWAY_MCP_ENABLED is unset", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe("GATEWAY_DISABLED")
  })

  it("GATEWAY_DISABLED when the base gateway is disabled even if MCP is enabled", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "0")
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY))
    expect(res.status).toBe(503)
  })

  it("6. malformed MCP request — invalid content-type is rejected before authentication runs", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => VALID_AUTH_RESULT)
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const req = new Request("https://abhibhideveloper.online/api/agent-gateway/mcp", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not json",
    })
    const res = await handleMcpRequest(req)
    expect(res.status).toBe(400)
  })

  it("12. Host header attack — rejected before authentication when an allowlist is configured", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_HOSTS", "abhibhideveloper.online")
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY, { host: "evil.example.com" }))
    expect(res.status).toBe(400)
  })

  it("2/3. missing/invalid credential — authentication failure denies before any MCP handling occurs", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => ({ authenticated: false, failureCode: "AUTH_REQUIRED" }))
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("AUTH_REQUIRED")
  })

  it("4/5. expired/revoked credential is normalized to the same external AUTH_INVALID (never leaking internal state)", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => ({ authenticated: false, failureCode: "CONNECTION_REVOKED" }))
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY))
    const body = await res.json()
    expect(body.error.code).toBe("AUTH_INVALID") // collapsed per Phase 1's anti-enumeration mapping — never CONNECTION_REVOKED externally
  })

  it("valid credential reaches full MCP handling and returns a successful initialize result", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => VALID_AUTH_RESULT)
      },
    }))
    vi.doMock("../limits/rate-limiter", () => ({
      GatewayRedisRateLimiter: class {
        check = vi.fn(async () => ({ allowed: true, limit: 60, remaining: 59, resetAt: new Date() }))
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.serverInfo.name).toBe("abhibhi-agent-gateway")
  })

  it("rate limiting: a denied rate-limit check returns 429 before MCP handling", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => VALID_AUTH_RESULT)
      },
    }))
    vi.doMock("../limits/rate-limiter", () => ({
      GatewayRedisRateLimiter: class {
        check = vi.fn(async () => ({ allowed: false, limit: 0, remaining: 0, resetAt: new Date() }))
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest(INIT_BODY))
    expect(res.status).toBe(429)
  })

  it("19. oversized request body is rejected", async () => {
    await setup()
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_MAX_BODY_BYTES", "10")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => VALID_AUTH_RESULT)
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest({ ...INIT_BODY, params: { ...INIT_BODY.params, extra: "x".repeat(1000) } }))
    expect(res.status).toBe(413)
  })

  it("full pipeline: authenticated tools/call against a real capability returns structured output", async () => {
    const { fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.doMock("../auth/composite-authenticator", () => ({
      CompositeAuthenticator: class {
        authenticate = vi.fn(async () => VALID_AUTH_RESULT)
      },
    }))
    vi.doMock("../limits/rate-limiter", () => ({
      GatewayRedisRateLimiter: class {
        check = vi.fn(async () => ({ allowed: true, limit: 60, remaining: 59, resetAt: new Date() }))
      },
    }))
    const { handleMcpRequest } = await import("../mcp/route-handler")
    const res = await handleMcpRequest(mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "products.get", arguments: { id: "p1" } } }))
    const body = await res.json()
    // FailClosedAuthorizer is wired in production — every real tool call
    // is denied by default until Phase 6 exists. Confirms the production
    // default is active even through the FULL route-handler pipeline.
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("AUTHORIZATION_DENIED")
  })
})
