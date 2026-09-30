import { describe, expect, it } from "vitest"
import { toExternalAuthErrorCode } from "../auth/error-mapping"
import type { InternalAuthFailureCode } from "../shared/types"

describe("toExternalAuthErrorCode — anti-enumeration collapsing", () => {
  it("preserves AUTH_REQUIRED distinctly (no credential presented at all)", () => {
    expect(toExternalAuthErrorCode("AUTH_REQUIRED")).toBe("AUTH_REQUIRED")
  })

  const collapsedToAuthInvalid: InternalAuthFailureCode[] = [
    "AUTH_INVALID",
    "AUTH_EXPIRED",
    "CONNECTION_INACTIVE",
    "CONNECTION_NOT_FOUND",
    "CONNECTION_PENDING",
    "CONNECTION_SUSPENDED",
    "CONNECTION_REVOKED",
    "CONNECTION_EXPIRED",
    "CREDENTIAL_EXPIRED",
    "CREDENTIAL_REVOKED",
    "ENVIRONMENT_MISMATCH",
  ]

  it.each(collapsedToAuthInvalid)("collapses %s to AUTH_INVALID externally", (internal) => {
    expect(toExternalAuthErrorCode(internal)).toBe("AUTH_INVALID")
  })

  it("never distinguishes between two different internal codes externally, except AUTH_REQUIRED", () => {
    const outputs = new Set(collapsedToAuthInvalid.map(toExternalAuthErrorCode))
    expect(outputs.size).toBe(1)
    expect(outputs.has("AUTH_INVALID")).toBe(true)
  })
})
