import { describe, expect, it } from "vitest"
import {
  validateMethod,
  validateContentType,
  validateDeclaredContentLength,
  validateBodySize,
  parseJsonBody,
} from "../security/request-validation"
import { GatewayError } from "../shared/errors"

function req(method: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/agent-gateway", { method, headers })
}

describe("validateMethod", () => {
  it("accepts GET and POST", () => {
    expect(() => validateMethod(req("GET"))).not.toThrow()
    expect(() => validateMethod(req("POST"))).not.toThrow()
  })

  it("rejects unsupported methods", () => {
    expect(() => validateMethod(req("DELETE"))).toThrow(GatewayError)
    expect(() => validateMethod(req("PUT"))).toThrow(GatewayError)
  })
})

describe("validateContentType", () => {
  it("skips validation for GET regardless of content-type", () => {
    expect(() => validateContentType(req("GET"))).not.toThrow()
  })

  it("accepts application/json for POST", () => {
    expect(() => validateContentType(req("POST", { "content-type": "application/json" }))).not.toThrow()
  })

  it("accepts application/json with a charset parameter", () => {
    expect(() => validateContentType(req("POST", { "content-type": "application/json; charset=utf-8" }))).not.toThrow()
  })

  it("rejects a missing content-type on POST", () => {
    expect(() => validateContentType(req("POST"))).toThrow(GatewayError)
  })

  it("rejects an unsupported content-type", () => {
    expect(() => validateContentType(req("POST", { "content-type": "text/plain" }))).toThrow(GatewayError)
  })
})

describe("validateDeclaredContentLength", () => {
  it("passes when header is absent", () => {
    expect(() => validateDeclaredContentLength(req("POST"))).not.toThrow()
  })

  it("passes when within the configured maximum", () => {
    expect(() => validateDeclaredContentLength(req("POST", { "content-length": "1000" }))).not.toThrow()
  })

  it("rejects a declared length beyond the configured maximum", () => {
    expect(() => validateDeclaredContentLength(req("POST", { "content-length": "999999999" }))).toThrow(GatewayError)
  })

  it("rejects a malformed (non-numeric) content-length", () => {
    expect(() => validateDeclaredContentLength(req("POST", { "content-length": "abc" }))).toThrow(GatewayError)
  })
})

describe("validateBodySize", () => {
  it("passes for a small body", () => {
    expect(() => validateBodySize("{}")).not.toThrow()
  })

  it("rejects a body exceeding the configured maximum", () => {
    const huge = "a".repeat(300_000)
    expect(() => validateBodySize(huge)).toThrow(GatewayError)
  })
})

describe("parseJsonBody", () => {
  it("returns undefined for an empty body", () => {
    expect(parseJsonBody("")).toBeUndefined()
  })

  it("parses valid JSON", () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 })
  })

  it("throws MALFORMED_REQUEST for invalid JSON, never leaking the parse error", () => {
    try {
      parseJsonBody("{not json")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError)
      expect((err as GatewayError).code).toBe("MALFORMED_REQUEST")
    }
  })
})
