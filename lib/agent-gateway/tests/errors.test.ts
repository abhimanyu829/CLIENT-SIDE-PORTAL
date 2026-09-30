import { describe, expect, it } from "vitest"
import { GatewayError, toErrorBody, toGatewayError } from "../shared/errors"

describe("GatewayError", () => {
  it("maps each code to a stable HTTP status", () => {
    expect(new GatewayError("AUTH_REQUIRED", "x").statusCode).toBe(401)
    expect(new GatewayError("RATE_LIMITED", "x").statusCode).toBe(429)
    expect(new GatewayError("REQUEST_TOO_LARGE", "x").statusCode).toBe(413)
    expect(new GatewayError("REPLAY_DETECTED", "x").statusCode).toBe(409)
    expect(new GatewayError("INTERNAL_GATEWAY_ERROR", "x").statusCode).toBe(500)
  })
})

describe("toErrorBody", () => {
  it("produces the stable error contract shape", () => {
    const err = new GatewayError("AUTH_INVALID", "bad token")
    const body = toErrorBody(err, "req_123")
    expect(body).toEqual({
      success: false,
      error: { code: "AUTH_INVALID", message: "bad token", requestId: "req_123" },
    })
  })
})

describe("toGatewayError", () => {
  it("passes through an existing GatewayError unchanged", () => {
    const original = new GatewayError("SIGNATURE_INVALID", "nope")
    expect(toGatewayError(original)).toBe(original)
  })

  it("never leaks the original error's message for arbitrary thrown values", () => {
    const secretLeak = new Error("Prisma: connection string postgres://user:SECRETPASS@host/db")
    const converted = toGatewayError(secretLeak)
    expect(converted.code).toBe("INTERNAL_GATEWAY_ERROR")
    expect(converted.message).not.toContain("SECRETPASS")
  })

  it("converts a plain string throw to a generic internal error", () => {
    const converted = toGatewayError("some raw string")
    expect(converted.code).toBe("INTERNAL_GATEWAY_ERROR")
  })
})
