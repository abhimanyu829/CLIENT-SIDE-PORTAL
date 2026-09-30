import { describe, expect, it, afterEach, vi } from "vitest"
import { validateHostHeader, validateOriginHeader } from "../mcp/transport-security"
import { GatewayError } from "../shared/errors"

function reqWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/agent-gateway/mcp", { headers })
}

describe("validateHostHeader", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("skips validation when no allowlist is configured (safe degradation, matches Phase 1 convention)", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_HOSTS", "")
    expect(() => validateHostHeader(reqWithHeaders({ host: "evil.example.com" }))).not.toThrow()
  })

  it("12. Host header attack — rejects a Host not in the configured allowlist", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_HOSTS", "abhibhideveloper.online,www.abhibhideveloper.online")
    expect(() => validateHostHeader(reqWithHeaders({ host: "evil.example.com" }))).toThrow(GatewayError)
  })

  it("accepts an allowed Host", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_HOSTS", "abhibhideveloper.online,www.abhibhideveloper.online")
    expect(() => validateHostHeader(reqWithHeaders({ host: "abhibhideveloper.online" }))).not.toThrow()
  })

  it("accepts an allowed Host even with a port suffix", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_HOSTS", "abhibhideveloper.online")
    expect(() => validateHostHeader(reqWithHeaders({ host: "abhibhideveloper.online:443" }))).not.toThrow()
  })

  it("rejects a missing Host header when an allowlist is configured", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_HOSTS", "abhibhideveloper.online")
    expect(() => validateHostHeader(new Request("https://example.com/api/agent-gateway/mcp"))).toThrow(GatewayError)
  })
})

describe("validateOriginHeader", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("never validates when no Origin header is present (machine callers typically send none)", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_ORIGINS", "https://trusted.example.com")
    expect(() => validateOriginHeader(reqWithHeaders({}))).not.toThrow()
  })

  it("13. Origin attack — rejects a disallowed Origin when an allowlist is configured", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_ORIGINS", "https://trusted.example.com")
    expect(() => validateOriginHeader(reqWithHeaders({ origin: "https://evil.example.com" }))).toThrow(GatewayError)
  })

  it("accepts an allowed Origin", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_ORIGINS", "https://trusted.example.com")
    expect(() => validateOriginHeader(reqWithHeaders({ origin: "https://trusted.example.com" }))).not.toThrow()
  })

  it("skips validation when no allowlist is configured", () => {
    vi.stubEnv("AGENT_GATEWAY_MCP_ALLOWED_ORIGINS", "")
    expect(() => validateOriginHeader(reqWithHeaders({ origin: "https://anything.example.com" }))).not.toThrow()
  })
})
