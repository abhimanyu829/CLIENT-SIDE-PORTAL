import { describe, expect, it } from "vitest"
import { buildRequestContext, rateLimitKeyFor } from "../identity/request-identity"

describe("buildRequestContext", () => {
  it("never fabricates identity fields for an unauthenticated result", () => {
    const req = new Request("https://example.com/api/agent-gateway")
    const context = buildRequestContext(req, { authenticated: false, failureCode: "AUTH_REQUIRED" }, new AbortController().signal)
    expect(context.authenticated).toBe(false)
    expect(context.connectionId).toBeUndefined()
    expect(context.ownerId).toBeUndefined()
    expect(context.agentId).toBeUndefined()
    expect(context.teamId).toBeUndefined()
    expect(context.policyVersion).toBeUndefined()
    expect(context.protocol).toBe("HTTP")
  })

  it("carries through only the fields the authenticator actually resolved", () => {
    const req = new Request("https://example.com/api/agent-gateway", {
      headers: { "user-agent": "test-agent/1.0" },
    })
    const context = buildRequestContext(
      req,
      { authenticated: true, connectionId: "conn_1", ownerId: "owner_1", authMethod: "BEARER" },
      new AbortController().signal
    )
    expect(context.connectionId).toBe("conn_1")
    expect(context.ownerId).toBe("owner_1")
    expect(context.agentId).toBeUndefined()
    expect(context.userAgent).toBe("test-agent/1.0")
  })

  it("ignores any client-supplied identity headers entirely", () => {
    const req = new Request("https://example.com/api/agent-gateway", {
      headers: {
        "x-agent-id": "spoofed-agent",
        "x-owner-id": "spoofed-owner",
        "x-admin": "true",
      },
    })
    const context = buildRequestContext(req, { authenticated: true, connectionId: "conn_1", ownerId: "real-owner" }, new AbortController().signal)
    expect(context.ownerId).toBe("real-owner")
    expect(context.agentId).toBeUndefined()
  })
})

describe("rateLimitKeyFor", () => {
  it("keys by connectionId when authenticated", () => {
    const context = buildRequestContext(
      new Request("https://example.com/api/agent-gateway"),
      { authenticated: true, connectionId: "conn_42", ownerId: "o" },
      new AbortController().signal
    )
    expect(rateLimitKeyFor(context)).toBe("conn:conn_42")
  })

  it("keys by IP when unauthenticated", () => {
    const context = buildRequestContext(
      new Request("https://example.com/api/agent-gateway", { headers: { "x-real-ip": "1.2.3.4" } }),
      { authenticated: false, failureCode: "AUTH_REQUIRED" },
      new AbortController().signal
    )
    expect(rateLimitKeyFor(context)).toBe("ip:1.2.3.4")
  })
})
