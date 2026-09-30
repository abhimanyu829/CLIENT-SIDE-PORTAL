import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalMessage, parseSignatureHeaders } from "../auth/signature-verifier"
import { hmacSha256Hex, sha256Hex } from "../shared/crypto"
import { __resetCredentialStoreCacheForTests } from "./test-helpers"

const SECRET = "test-signing-secret"
const KEY_ID = "key_test_1"

function signedRequest(opts: {
  timestamp?: string
  nonce?: string
  keyId?: string
  signature?: string
  method?: string
  path?: string
  body?: string
}): { request: Request; body: string } {
  const method = opts.method ?? "POST"
  const path = opts.path ?? "/api/agent-gateway"
  const body = opts.body ?? "{}"
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000))
  const nonce = opts.nonce ?? "nonce-" + Math.random().toString(36).slice(2)
  const keyId = opts.keyId ?? KEY_ID

  const bodyHash = sha256Hex(body)
  const signature = opts.signature ?? hmacSha256Hex(SECRET, canonicalMessage(timestamp, method, path, bodyHash))

  const headers = new Headers({
    "x-abhibhi-timestamp": timestamp,
    "x-abhibhi-nonce": nonce,
    "x-abhibhi-key-id": keyId,
    "x-abhibhi-signature": signature,
    "content-type": "application/json",
  })

  return { request: new Request(`https://example.com${path}`, { method, headers, body: method === "GET" ? undefined : body }), body }
}

describe("parseSignatureHeaders", () => {
  it("returns null when any required header is missing", () => {
    const headers = new Headers({ "x-abhibhi-timestamp": "123" })
    const req = new Request("https://example.com/api/agent-gateway", { headers })
    expect(parseSignatureHeaders(req)).toBeNull()
  })

  it("returns null for a malformed (non-hex, wrong length) signature", () => {
    const { request } = signedRequest({ signature: "not-a-signature" })
    expect(parseSignatureHeaders(request)).toBeNull()
  })

  it("parses well-formed signature headers", () => {
    const { request } = signedRequest({})
    const parsed = parseSignatureHeaders(request)
    expect(parsed).not.toBeNull()
    expect(parsed?.keyId).toBe(KEY_ID)
  })
})

describe("HmacSignatureVerifier", () => {
  beforeEach(() => {
    vi.resetModules()
    __resetCredentialStoreCacheForTests()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("accepts a validly signed request", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const { request, body } = signedRequest({})
    const result = await verifier.verify(request, body)
    expect(result.valid).toBe(true)
  })

  it("rejects a request with a tampered signature", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const { request, body } = signedRequest({ signature: "a".repeat(64) })
    const result = await verifier.verify(request, body)
    expect(result.valid).toBe(false)
    expect(result.failureCode).toBe("SIGNATURE_INVALID")
  })

  it("rejects a request signed with the wrong secret", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: "wrong-secret" }])
    )
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const { request, body } = signedRequest({})
    const result = await verifier.verify(request, body)
    expect(result.valid).toBe(false)
    expect(result.failureCode).toBe("SIGNATURE_INVALID")
  })

  it("rejects an expired timestamp (beyond clock skew)", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    vi.stubEnv("AGENT_GATEWAY_MAX_CLOCK_SKEW_SECONDS", "60")
    const { getGatewayConfig, __resetGatewayConfigForTests } = await import("../config")
    __resetGatewayConfigForTests()
    void getGatewayConfig()

    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600)
    const { request, body } = signedRequest({ timestamp: staleTimestamp })
    const result = await verifier.verify(request, body)
    expect(result.valid).toBe(false)
    expect(result.failureCode).toBe("SIGNATURE_EXPIRED")
  })

  it("rejects an unknown key id", async () => {
    vi.stubEnv("AGENT_GATEWAY_CREDENTIALS_JSON", JSON.stringify([]))
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const { request, body } = signedRequest({ keyId: "unknown-key" })
    const result = await verifier.verify(request, body)
    expect(result.valid).toBe(false)
    expect(result.failureCode).toBe("SIGNATURE_INVALID")
  })
})
