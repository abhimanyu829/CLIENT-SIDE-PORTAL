import { describe, expect, it } from "vitest"
import { buildAuthInfoExtra, extractTrustedIdentity } from "../mcp/identity-context"
import { ExecutionError } from "../execution/contracts/execution-error"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"

function gatewayCtx(overrides: Partial<AgentGatewayRequestContext> = {}): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: {
      connectionId: "conn_1",
      credentialId: "cred_1",
      ownerId: "owner_1",
      teamId: "team_1",
      connectionStatus: "ACTIVE",
      authenticatedAt: new Date(),
    },
    protocol: "HTTP",
    signal: new AbortController().signal,
    ...overrides,
  }
}

describe("buildAuthInfoExtra / extractTrustedIdentity round-trip", () => {
  it("round-trips the trusted identity fields exactly", () => {
    const extra = buildAuthInfoExtra(gatewayCtx(), "development")
    const authInfo: AuthInfo = { token: "", clientId: "conn_1", scopes: [], extra }
    const identity = extractTrustedIdentity(authInfo)
    expect(identity).toEqual({
      connectionId: "conn_1",
      ownerId: "owner_1",
      teamId: "team_1",
      agentId: undefined,
      connectionStatus: "ACTIVE",
      environment: "development",
    })
  })

  it("throws (fails closed) when no machine identity is present on the gateway context", () => {
    expect(() => buildAuthInfoExtra(gatewayCtx({ machine: undefined }), "development")).toThrow(ExecutionError)
  })

  it("8/9. forged/missing identity — extractTrustedIdentity fails closed on a completely absent AuthInfo", () => {
    expect(() => extractTrustedIdentity(undefined)).toThrow(ExecutionError)
  })

  it("fails closed on an AuthInfo with no extra field at all", () => {
    const authInfo: AuthInfo = { token: "", clientId: "x", scopes: [] }
    expect(() => extractTrustedIdentity(authInfo)).toThrow(ExecutionError)
  })

  it("fails closed on a forged/malformed extra payload missing required fields", () => {
    const authInfo: AuthInfo = { token: "", clientId: "x", scopes: [], extra: { "abhibhi.trustedIdentity": { connectionId: "conn_1" } } }
    expect(() => extractTrustedIdentity(authInfo)).toThrow(ExecutionError)
  })

  it("never reads clientInfo-shaped fields as trusted identity — the extraction key is namespaced and specific", () => {
    const authInfo: AuthInfo = {
      token: "",
      clientId: "x",
      scopes: [],
      extra: { clientInfo: { name: "attacker-supplied-client", ownerId: "forged_owner" } },
    }
    expect(() => extractTrustedIdentity(authInfo)).toThrow(ExecutionError)
  })
})
