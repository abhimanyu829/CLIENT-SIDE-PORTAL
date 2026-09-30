import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetCredentialStoreCacheForTests } from "./test-helpers"

const TOKEN = "c".repeat(40)

describe("CompositeAuthenticator", () => {
  beforeEach(() => {
    vi.resetModules()
    __resetCredentialStoreCacheForTests()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses bearer auth when signing is disabled, even if signature headers are present", async () => {
    vi.stubEnv("AGENT_GATEWAY_SIGNING_ENABLED", "0")
    vi.stubEnv("AGENT_GATEWAY_CREDENTIALS_JSON", JSON.stringify([{ connectionId: "conn_1", ownerId: "o", bearerToken: TOKEN }]))
    const { CompositeAuthenticator } = await import("../auth/composite-authenticator")
    const auth = new CompositeAuthenticator()

    const req = new Request("https://example.com/api/agent-gateway", {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "x-abhibhi-signature": "d".repeat(64),
        "x-abhibhi-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-abhibhi-nonce": "n1",
        "x-abhibhi-key-id": "k1",
      },
    })
    const result = await auth.authenticate(req)
    expect(result.authMethod).toBe("BEARER")
  })

  it("uses bearer auth when no signature headers are present, even if signing is enabled", async () => {
    vi.stubEnv("AGENT_GATEWAY_SIGNING_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_CREDENTIALS_JSON", JSON.stringify([{ connectionId: "conn_1", ownerId: "o", bearerToken: TOKEN }]))
    const { CompositeAuthenticator } = await import("../auth/composite-authenticator")
    const auth = new CompositeAuthenticator()

    const req = new Request("https://example.com/api/agent-gateway", { headers: { authorization: `Bearer ${TOKEN}` } })
    const result = await auth.authenticate(req)
    expect(result.authMethod).toBe("BEARER")
  })

  it("never falls back from a failed signature check to bearer auth", async () => {
    vi.stubEnv("AGENT_GATEWAY_SIGNING_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_CREDENTIALS_JSON", JSON.stringify([{ connectionId: "conn_1", ownerId: "o", bearerToken: TOKEN }]))
    const { CompositeAuthenticator } = await import("../auth/composite-authenticator")
    const auth = new CompositeAuthenticator()

    // Presents a valid bearer token AND a garbage signature — since signing
    // is enabled and signature headers are present, the signed path is
    // exclusively attempted; the valid bearer token must not rescue it.
    const req = new Request("https://example.com/api/agent-gateway", {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "x-abhibhi-signature": "e".repeat(64),
        "x-abhibhi-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-abhibhi-nonce": "n2",
        "x-abhibhi-key-id": "k1",
      },
    })
    const result = await auth.authenticate(req)
    expect(result.authenticated).toBe(false)
    expect(result.authMethod).toBeUndefined()
  })
})
