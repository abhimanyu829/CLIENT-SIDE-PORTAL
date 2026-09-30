import { describe, expect, it } from "vitest"
import {
  fingerprintSecret,
  generateBearerToken,
  generateKeyId,
  generateSigningSecret,
  hashSecret,
} from "../shared/crypto"

describe("generateBearerToken / generateSigningSecret / generateKeyId", () => {
  it("generates unique values across calls", () => {
    const a = generateBearerToken()
    const b = generateBearerToken()
    expect(a).not.toBe(b)
    expect(a.startsWith("agw_")).toBe(true)
  })

  it("generates a signing secret and key id with no overlap in shape", () => {
    const secret = generateSigningSecret()
    const keyId = generateKeyId()
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(keyId.startsWith("key_")).toBe(true)
  })
})

describe("hashSecret", () => {
  it("is deterministic for the same input", () => {
    const secret = "example-secret-value"
    expect(hashSecret(secret)).toBe(hashSecret(secret))
  })

  it("produces different hashes for different inputs", () => {
    expect(hashSecret("secret-a")).not.toBe(hashSecret("secret-b"))
  })
})

describe("fingerprintSecret", () => {
  it("is deterministic for the same input", () => {
    const secret = "example-secret-value"
    expect(fingerprintSecret(secret)).toBe(fingerprintSecret(secret))
  })

  it("never equals the secret's own hash — cannot be swapped in for authentication", () => {
    const secret = "example-secret-value"
    expect(fingerprintSecret(secret)).not.toBe(hashSecret(secret))
  })

  it("never contains the raw secret as a substring", () => {
    const secret = "super-secret-token-value-123456"
    expect(fingerprintSecret(secret)).not.toContain(secret)
  })

  it("produces different fingerprints for different secrets", () => {
    expect(fingerprintSecret("secret-a")).not.toBe(fingerprintSecret("secret-b"))
  })
})
