import { describe, expect, it } from "vitest"
import { toMcpSafeError, AuthorizationDeniedError } from "../mcp/errors"
import { GatewayError } from "../shared/errors"
import { CapabilityError } from "../capabilities/errors"
import { ExecutionError } from "../execution/contracts/execution-error"

describe("toMcpSafeError", () => {
  it("20. application error formatting — categorizes an AuthorizationDeniedError as AUTHORIZATION", () => {
    const err = new AuthorizationDeniedError("no policy configured")
    const safe = toMcpSafeError(err)
    expect(safe.category).toBe("AUTHORIZATION")
    expect(safe.code).toBe("AUTHORIZATION_DENIED")
  })

  it("categorizes an auth-shaped GatewayError as AUTHENTICATION", () => {
    const err = new GatewayError("AUTH_INVALID", "bad credential")
    const safe = toMcpSafeError(err)
    expect(safe.category).toBe("AUTHENTICATION")
  })

  it("categorizes a signature/replay GatewayError as AUTHENTICATION", () => {
    expect(toMcpSafeError(new GatewayError("SIGNATURE_INVALID", "x")).category).toBe("AUTHENTICATION")
    expect(toMcpSafeError(new GatewayError("REPLAY_DETECTED", "x")).category).toBe("AUTHENTICATION")
  })

  it("categorizes a non-auth GatewayError as TRANSPORT", () => {
    const err = new GatewayError("RATE_LIMITED", "too many requests")
    expect(toMcpSafeError(err).category).toBe("TRANSPORT")
  })

  it("categorizes a CapabilityError as CAPABILITY", () => {
    const err = new CapabilityError("CAPABILITY_NOT_FOUND", "no such capability")
    const safe = toMcpSafeError(err)
    expect(safe.category).toBe("CAPABILITY")
    expect(safe.code).toBe("CAPABILITY_NOT_FOUND")
  })

  it("categorizes an ExecutionError as EXECUTION", () => {
    const err = new ExecutionError("RESOURCE_NOT_FOUND", "no such resource")
    const safe = toMcpSafeError(err)
    expect(safe.category).toBe("EXECUTION")
    expect(safe.code).toBe("RESOURCE_NOT_FOUND")
  })

  it("categorizes an unexpected raw Error/exception as INTERNAL, never leaking its message", () => {
    const secretLeak = new Error("Prisma: connection string postgres://user:SECRETPASS@host/db")
    const safe = toMcpSafeError(secretLeak)
    expect(safe.category).toBe("INTERNAL")
    expect(safe.code).toBe("INTERNAL_ERROR")
    expect(safe.message).not.toContain("SECRETPASS")
  })

  it("categorizes a plain string throw as INTERNAL", () => {
    const safe = toMcpSafeError("some raw string")
    expect(safe.category).toBe("INTERNAL")
  })

  it("never leaks a stack trace in the safe error message", () => {
    const err = new Error("boom")
    const safe = toMcpSafeError(err)
    expect(safe.message).not.toContain("at ")
    expect(safe.message).not.toContain(".ts:")
  })
})
