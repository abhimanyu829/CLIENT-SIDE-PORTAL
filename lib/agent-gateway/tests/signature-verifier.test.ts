import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalMessage, parseSignatureHeaders, REQUEST_SIGNATURE_VERSION } from "../auth/signature-verifier"
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
}): { request: Request; body: string; timestamp: string; nonce: string; signature: string } {
  const method = opts.method ?? "POST"
  const path = opts.path ?? "/api/agent-gateway"
  const body = opts.body ?? "{}"
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000))
  const nonce = opts.nonce ?? "nonce-" + Math.random().toString(36).slice(2)
  const keyId = opts.keyId ?? KEY_ID

  const bodyHash = sha256Hex(body)
  const signature = opts.signature ?? hmacSha256Hex(SECRET, canonicalMessage({ timestamp, nonce, method, path, bodyHash }))

  const headers = new Headers({
    "x-abhibhi-timestamp": timestamp,
    "x-abhibhi-nonce": nonce,
    "x-abhibhi-key-id": keyId,
    "x-abhibhi-signature": signature,
    "content-type": "application/json",
  })

  return {
    request: new Request(`https://example.com${path}`, { method, headers, body: method === "GET" ? undefined : body }),
    body,
    timestamp,
    nonce,
    signature,
  }
}

describe("canonicalMessage (abhibhi.request.v2)", () => {
  it("is the version line, timestamp, nonce, upper-cased method, path and body hash, newline-joined", () => {
    const bodyHash = sha256Hex('{"a":1}')
    const message = canonicalMessage({ timestamp: "1790000000", nonce: "nonce-abcdef12", method: "post", path: "/api/agent-gateway", bodyHash })
    expect(REQUEST_SIGNATURE_VERSION).toBe("abhibhi.request.v2")
    expect(message.split("\n")).toEqual(["abhibhi.request.v2", "1790000000", "nonce-abcdef12", "POST", "/api/agent-gateway", bodyHash])
    // The body is only ever represented by its hash.
    expect(message).not.toContain('{"a":1}')
  })

  it("changes when only the nonce changes", () => {
    const base = { timestamp: "1790000000", method: "POST", path: "/api/agent-gateway", bodyHash: sha256Hex("{}") }
    expect(canonicalMessage({ ...base, nonce: "nonce-aaaaaaaa" })).not.toBe(canonicalMessage({ ...base, nonce: "nonce-bbbbbbbb" }))
  })
})

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

  it("rejects a captured request whose nonce was swapped for a fresh one (the nonce is signed)", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const captured = signedRequest({ nonce: "captured-nonce-0001" })
    expect((await verifier.verify(captured.request, captured.body)).valid).toBe(true)

    // Same timestamp, body and signature; only the nonce header differs.
    const replay = signedRequest({ timestamp: captured.timestamp, nonce: "fresh-nonce-00002", signature: captured.signature })
    expect(await verifier.verify(replay.request, replay.body)).toEqual({ valid: false, failureCode: "SIGNATURE_INVALID" })
  })

  it("rejects a request signed the legacy v1 way (no version line, nonce not covered)", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const timestamp = String(Math.floor(Date.now() / 1000))
    const legacyV1 = hmacSha256Hex(SECRET, [timestamp, "POST", "/api/agent-gateway", sha256Hex("{}")].join("\n"))
    const { request, body } = signedRequest({ timestamp, signature: legacyV1 })
    expect(await verifier.verify(request, body)).toEqual({ valid: false, failureCode: "SIGNATURE_INVALID" })
  })

  it("binds every signed part: changing the timestamp, method, path or body invalidates the signature", async () => {
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    const { HmacSignatureVerifier } = await import("../auth/signature-verifier")
    const verifier = new HmacSignatureVerifier()
    const original = signedRequest({ nonce: "original-nonce-01", body: '{"capabilityId":"products.get"}' })
    expect((await verifier.verify(original.request, original.body)).valid).toBe(true)

    const keep = { timestamp: original.timestamp, nonce: original.nonce, signature: original.signature, body: original.body }
    const variants: Array<[string, Parameters<typeof signedRequest>[0]]> = [
      ["timestamp", { ...keep, timestamp: String(Number(original.timestamp) - 1) }],
      ["method", { ...keep, method: "PUT" }],
      ["path", { ...keep, path: "/api/agent-gateway/mcp" }],
      ["body", { ...keep, body: '{"capabilityId":"products.delete"}' }],
    ]
    for (const [part, opts] of variants) {
      const tampered = signedRequest(opts)
      expect(await verifier.verify(tampered.request, tampered.body), part).toEqual({ valid: false, failureCode: "SIGNATURE_INVALID" })
    }
  })
})
