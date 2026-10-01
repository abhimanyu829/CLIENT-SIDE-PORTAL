/**
 * lib/agent-gateway/tests/signed-request-nonce.test.ts
 *
 * Regression suite for the Phase 1 signed-request fix: the nonce is inside
 * the HMAC (canonical message "abhibhi.request.v2"), so a captured request
 * can no longer be replayed inside the clock-skew window with a fresh
 * nonce. Runs the real SignedRequestAuthenticator (signature first, then
 * the single-use nonce) against an in-memory Redis, with both the Phase 1
 * env store and the Phase 2 database-backed credential store.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { canonicalMessage } from "../auth/signature-verifier"
import { hmacSha256Hex, sha256Hex } from "../shared/crypto"
import { createFakeDb } from "./fake-db"
import { __resetCredentialStoreCacheForTests } from "./test-helpers"

const SECRET = "nonce-suite-signing-secret"
const KEY_ID = "key_nonce_suite"
const PATH = "/api/agent-gateway"

/** SET NX EX semantics of the Upstash client, in memory. */
function inMemoryRedis() {
  const keys = new Map<string, string>()
  const set = vi.fn(async (key: string, value: string, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && keys.has(key)) return null
    keys.set(key, value)
    return "OK"
  })
  return { keys, set }
}

const nonceKey = (keyId: string, nonce: string) => `agent-gateway:nonce:${keyId}:${nonce}`

function buildRequest(opts: {
  secret: string
  keyId: string
  nonce: string
  body?: string
  timestamp?: string
  /** Reuse a captured signature instead of signing. */
  signature?: string
  /** Sign the pre-fix v1 message: timestamp, METHOD, path, sha256(body) — no version line, no nonce. */
  legacyV1?: boolean
}) {
  const body = opts.body ?? JSON.stringify({ capabilityId: "products.get", input: { id: "prod_1" } })
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000))
  const bodyHash = sha256Hex(body)
  const message = opts.legacyV1
    ? [timestamp, "POST", PATH, bodyHash].join("\n")
    : canonicalMessage({ timestamp, nonce: opts.nonce, method: "POST", path: PATH, bodyHash })
  const signature = opts.signature ?? hmacSha256Hex(opts.secret, message)
  const request = new Request(`https://gateway.example${PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-abhibhi-timestamp": timestamp,
      "x-abhibhi-nonce": opts.nonce,
      "x-abhibhi-key-id": opts.keyId,
      "x-abhibhi-signature": signature,
    },
    body,
  })
  return { request, body, timestamp, signature }
}

describe("Signed requests sign the nonce (abhibhi.request.v2) — Phase 1 env store", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function setup() {
    vi.resetModules()
    __resetCredentialStoreCacheForTests()
    vi.stubEnv(
      "AGENT_GATEWAY_CREDENTIALS_JSON",
      JSON.stringify([{ connectionId: "conn_1", ownerId: "owner_1", keyId: KEY_ID, signingSecret: SECRET }])
    )
    const redis = inMemoryRedis()
    vi.doMock("@/lib/redis", () => ({ redis }))
    const { SignedRequestAuthenticator } = await import("../auth/signed-request-authenticator")
    return { redis, auth: new SignedRequestAuthenticator() }
  }

  it("accepts a v2-signed request and consumes exactly its nonce", async () => {
    const { redis, auth } = await setup()
    const { request } = buildRequest({ secret: SECRET, keyId: KEY_ID, nonce: "nonce-accept-0001" })
    expect(await auth.authenticate(request)).toMatchObject({
      authenticated: true,
      authMethod: "SIGNED_REQUEST",
      connectionId: "conn_1",
      ownerId: "owner_1",
      tokenId: KEY_ID,
    })
    expect(Array.from(redis.keys.keys())).toEqual([nonceKey(KEY_ID, "nonce-accept-0001")])
  })

  it("refuses an exact replay (same nonce)", async () => {
    const { auth } = await setup()
    const { request } = buildRequest({ secret: SECRET, keyId: KEY_ID, nonce: "nonce-replay-0001" })
    const copy = request.clone()
    expect((await auth.authenticate(request)).authenticated).toBe(true)
    expect(await auth.authenticate(copy)).toEqual({ authenticated: false, failureCode: "AUTH_INVALID" })
  })

  it("refuses a captured request replayed with a fresh nonce, and the forged attempt burns no nonce", async () => {
    const { redis, auth } = await setup()
    const captured = buildRequest({ secret: SECRET, keyId: KEY_ID, nonce: "nonce-captured-01" })
    expect((await auth.authenticate(captured.request)).authenticated).toBe(true)

    // The pre-fix attack: same timestamp, body and signature, a new nonce.
    const forged = buildRequest({
      secret: SECRET,
      keyId: KEY_ID,
      nonce: "nonce-attacker-01",
      timestamp: captured.timestamp,
      body: captured.body,
      signature: captured.signature,
    })
    expect(await auth.authenticate(forged.request)).toEqual({ authenticated: false, failureCode: "AUTH_INVALID" })

    // The signature is checked first, so the attacker's nonce was never consumed...
    expect(redis.keys.has(nonceKey(KEY_ID, "nonce-attacker-01"))).toBe(false)
    expect(redis.set).toHaveBeenCalledTimes(1)
    // ...and the real client can still use that nonce in its own signed request.
    const legit = buildRequest({ secret: SECRET, keyId: KEY_ID, nonce: "nonce-attacker-01" })
    expect((await auth.authenticate(legit.request)).authenticated).toBe(true)
  })

  it("refuses a request signed the legacy v1 way, before the nonce store is touched (no downgrade)", async () => {
    const { redis, auth } = await setup()
    const { request } = buildRequest({ secret: SECRET, keyId: KEY_ID, nonce: "nonce-legacy-0001", legacyV1: true })
    expect(await auth.authenticate(request)).toEqual({ authenticated: false, failureCode: "AUTH_INVALID" })
    expect(redis.set).not.toHaveBeenCalled()
  })
})

describe("Signed requests sign the nonce — Phase 2 database credentials", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("a SIGNED_REQUEST connection authenticates with a v2 signature, refuses a nonce swap, and stops once suspended", async () => {
    vi.resetModules()
    process.env.ENCRYPTION_KEY = "4".repeat(64)
    const fake = createFakeDb()
    const redis = inMemoryRedis()
    vi.doMock("@/lib/db", () => ({ db: fake.client }))
    vi.doMock("@/lib/redis", () => ({ redis }))
    vi.doMock("@/lib/audit", () => ({ auditLog: vi.fn() }))
    vi.doMock("../identity/connection-cache", () => ({
      invalidateConnectionStatus: vi.fn(async () => {}),
      getCachedStatus: vi.fn(async () => null),
      setCachedStatus: vi.fn(async () => {}),
    }))
    const { PrismaAgentConnectionService, __setAgentConnectionServiceForTests } = await import("../identity/connection-service")
    const { DbCredentialStore } = await import("../auth/db-credential-store")
    const { __setCredentialStoreForTests } = await import("../auth/credential-store-provider")
    const { SignedRequestAuthenticator } = await import("../auth/signed-request-authenticator")
    const service = new PrismaAgentConnectionService()
    __setAgentConnectionServiceForTests(service)
    __setCredentialStoreForTests(new DbCredentialStore())
    fake.seedUser("owner_1")

    const created = await service.create({
      name: "Signed agent",
      provider: "custom",
      ownerId: "owner_1",
      authMethod: "SIGNED_REQUEST",
      actorId: "admin_1",
    })
    if (created.credential.authMethod !== "SIGNED_REQUEST") throw new Error("expected a signing credential")
    const { keyId, signingSecret } = created.credential
    const auth = new SignedRequestAuthenticator()

    const ok = buildRequest({ secret: signingSecret, keyId, nonce: "nonce-db-0000001" })
    expect(await auth.authenticate(ok.request)).toMatchObject({
      authenticated: true,
      authMethod: "SIGNED_REQUEST",
      connectionId: created.connection.id,
      ownerId: "owner_1",
      connectionStatus: "ACTIVE",
    })

    const swapped = buildRequest({
      secret: signingSecret,
      keyId,
      nonce: "nonce-db-0000002",
      timestamp: ok.timestamp,
      body: ok.body,
      signature: ok.signature,
    })
    expect(await auth.authenticate(swapped.request)).toEqual({ authenticated: false, failureCode: "AUTH_INVALID" })
    expect(redis.keys.has(nonceKey(keyId, "nonce-db-0000002"))).toBe(false)

    await service.suspend(created.connection.id, "admin_1")
    const afterSuspend = buildRequest({ secret: signingSecret, keyId, nonce: "nonce-db-0000003" })
    expect((await auth.authenticate(afterSuspend.request)).authenticated).toBe(false)
  })
})
