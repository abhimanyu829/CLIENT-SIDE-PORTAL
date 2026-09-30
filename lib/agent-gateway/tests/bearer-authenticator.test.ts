import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetCredentialStoreCacheForTests } from "./test-helpers"

const TOKEN = "b".repeat(40)

function reqWithAuth(header: string | null): Request {
  const headers = new Headers()
  if (header !== null) headers.set("authorization", header)
  return new Request("https://example.com/api/agent-gateway", { headers })
}

describe("BearerTokenAuthenticator", () => {
  beforeEach(() => {
    vi.resetModules()
    __resetCredentialStoreCacheForTests()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("denies with AUTH_REQUIRED when no Authorization header is present", async () => {
    const { BearerTokenAuthenticator } = await import("../auth/bearer-authenticator")
    const auth = new BearerTokenAuthenticator()
    const result = await auth.authenticate(reqWithAuth(null))
    expect(result).toEqual({ authenticated: false, failureCode: "AUTH_REQUIRED" })
  })

  it("denies with AUTH_INVALID for an unrecognized token", async () => {
    vi.stubEnv("AGENT_GATEWAY_CREDENTIALS_JSON", JSON.stringify([]))
    const { BearerTokenAuthenticator } = await import("../auth/bearer-authenticator")
    const auth = new BearerTokenAuthenticator()
    const result = await auth.authenticate(reqWithAuth(`Bearer ${TOKEN}`))
    expect(result).toEqual({ authenticated: false, failureCode: "AUTH_INVALID" })
  })

  it("resolves identity for a valid, active token", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", agentId: "agent_1", bearerToken: TOKEN, scopes: ["read"] }])
    )
    const { BearerTokenAuthenticator } = await import("../auth/bearer-authenticator")
    const auth = new BearerTokenAuthenticator()
    const result = await auth.authenticate(reqWithAuth(`Bearer ${TOKEN}`))
    expect(result.authenticated).toBe(true)
    expect(result.connectionId).toBe("conn_1")
    expect(result.ownerId).toBe("owner_1")
    expect(result.agentId).toBe("agent_1")
    expect(result.authMethod).toBe("BEARER")
    expect(result.scopes).toEqual(["read"])
    // The raw token must never appear anywhere in the result.
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it("denies with CONNECTION_INACTIVE for a valid token whose connection is inactive", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", bearerToken: TOKEN, status: "INACTIVE" }])
    )
    const { BearerTokenAuthenticator } = await import("../auth/bearer-authenticator")
    const auth = new BearerTokenAuthenticator()
    const result = await auth.authenticate(reqWithAuth(`Bearer ${TOKEN}`))
    expect(result).toEqual({ authenticated: false, failureCode: "CONNECTION_INACTIVE" })
  })

  it("degrades to no-credentials (never throws) when AGENT_GATEWAY_CREDENTIALS_JSON is malformed", async () => {
    vi.stubEnv("AGENT_GATEWAY_CREDENTIALS_JSON", "{ not valid json")
    const { BearerTokenAuthenticator } = await import("../auth/bearer-authenticator")
    const auth = new BearerTokenAuthenticator()
    const result = await auth.authenticate(reqWithAuth(`Bearer ${TOKEN}`))
    expect(result).toEqual({ authenticated: false, failureCode: "AUTH_INVALID" })
  })
})
