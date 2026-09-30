import { describe, expect, it } from "vitest"
import { parseBearerAuthorizationHeader } from "../auth/token-parser"

function reqWithAuth(header: string | null): Request {
  const headers = new Headers()
  if (header !== null) headers.set("authorization", header)
  return new Request("https://example.com/api/agent-gateway", { headers })
}

describe("parseBearerAuthorizationHeader", () => {
  it("returns null when the header is absent", () => {
    expect(parseBearerAuthorizationHeader(reqWithAuth(null))).toBeNull()
  })

  it("returns null for a non-Bearer scheme", () => {
    expect(parseBearerAuthorizationHeader(reqWithAuth("Basic dXNlcjpwYXNz"))).toBeNull()
  })

  it("returns null for an empty bearer token", () => {
    expect(parseBearerAuthorizationHeader(reqWithAuth("Bearer "))).toBeNull()
  })

  it("returns null for a too-short token", () => {
    expect(parseBearerAuthorizationHeader(reqWithAuth("Bearer short"))).toBeNull()
  })

  it("returns null for a token containing whitespace", () => {
    expect(parseBearerAuthorizationHeader(reqWithAuth("Bearer abc def ghijklmnop"))).toBeNull()
  })

  it("parses a well-formed bearer token", () => {
    const token = "a".repeat(32)
    const result = parseBearerAuthorizationHeader(reqWithAuth(`Bearer ${token}`))
    expect(result).toEqual({ scheme: "Bearer", token })
  })
})
