import { describe, expect, it } from "vitest"
import { assertLegalTransition, isLegalTransition } from "../identity/state-machine"
import { GatewayError } from "../shared/errors"

describe("isLegalTransition", () => {
  it("allows PENDING -> ACTIVE", () => expect(isLegalTransition("PENDING", "ACTIVE")).toBe(true))
  it("allows PENDING -> REVOKED", () => expect(isLegalTransition("PENDING", "REVOKED")).toBe(true))
  it("allows ACTIVE -> SUSPENDED", () => expect(isLegalTransition("ACTIVE", "SUSPENDED")).toBe(true))
  it("allows ACTIVE -> REVOKED", () => expect(isLegalTransition("ACTIVE", "REVOKED")).toBe(true))
  it("allows ACTIVE -> EXPIRED", () => expect(isLegalTransition("ACTIVE", "EXPIRED")).toBe(true))
  it("allows SUSPENDED -> ACTIVE", () => expect(isLegalTransition("SUSPENDED", "ACTIVE")).toBe(true))
  it("allows SUSPENDED -> REVOKED", () => expect(isLegalTransition("SUSPENDED", "REVOKED")).toBe(true))
  it("allows EXPIRED -> REVOKED", () => expect(isLegalTransition("EXPIRED", "REVOKED")).toBe(true))

  it("treats a same-state transition as legal (idempotent no-op, decided by callers)", () => {
    expect(isLegalTransition("ACTIVE", "ACTIVE")).toBe(true)
  })

  it("rejects PENDING -> SUSPENDED (must activate first)", () => {
    expect(isLegalTransition("PENDING", "SUSPENDED")).toBe(false)
  })

  it("rejects REVOKED -> anything (terminal state)", () => {
    expect(isLegalTransition("REVOKED", "ACTIVE")).toBe(false)
    expect(isLegalTransition("REVOKED", "SUSPENDED")).toBe(false)
    expect(isLegalTransition("REVOKED", "PENDING")).toBe(false)
  })

  it("rejects EXPIRED -> ACTIVE (no self-reactivation from expiry)", () => {
    expect(isLegalTransition("EXPIRED", "ACTIVE")).toBe(false)
  })

  it("rejects SUSPENDED -> PENDING", () => {
    expect(isLegalTransition("SUSPENDED", "PENDING")).toBe(false)
  })

  it("rejects ACTIVE -> PENDING", () => {
    expect(isLegalTransition("ACTIVE", "PENDING")).toBe(false)
  })
})

describe("assertLegalTransition", () => {
  it("does not throw for a legal transition", () => {
    expect(() => assertLegalTransition("ACTIVE", "SUSPENDED")).not.toThrow()
  })

  it("does not throw for a same-state transition", () => {
    expect(() => assertLegalTransition("SUSPENDED", "SUSPENDED")).not.toThrow()
  })

  it("throws GatewayError with ILLEGAL_STATE_TRANSITION for an illegal transition", () => {
    try {
      assertLegalTransition("REVOKED", "ACTIVE")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError)
      expect((err as GatewayError).code).toBe("ILLEGAL_STATE_TRANSITION")
    }
  })
})
