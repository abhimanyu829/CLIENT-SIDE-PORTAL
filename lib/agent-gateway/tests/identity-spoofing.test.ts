import { afterEach, describe, expect, it, vi } from "vitest"
import { createFakeDb } from "./fake-db"

const ENCRYPTION_KEY = "2".repeat(64)

async function setupService() {
  vi.resetModules()
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
  const fake = createFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/audit", () => ({ auditLog: vi.fn() }))
  vi.doMock("../identity/connection-cache", () => ({
    invalidateConnectionStatus: vi.fn(async () => {}),
    getCachedStatus: vi.fn(async () => null),
    setCachedStatus: vi.fn(async () => {}),
  }))
  const { PrismaAgentConnectionService } = await import("../identity/connection-service")
  const { DbCredentialStore } = await import("../auth/db-credential-store")
  const { __setAgentConnectionServiceForTests } = await import("../identity/connection-service")
  const service = new PrismaAgentConnectionService()
  __setAgentConnectionServiceForTests(service)
  fake.seedUser("owner_1")
  fake.seedUser("owner_2")
  return { service, fake, credentialStore: new DbCredentialStore() }
}

describe("Identity spoofing resistance (Phase 2 spec §15/§34 Properties 5-7)", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("client-supplied identity headers are never consulted by buildRequestContext (Property 5/6/7)", async () => {
    const { buildRequestContext } = await import("../identity/request-identity")
    const req = new Request("https://example.com/api/agent-gateway", {
      headers: {
        "x-agent-id": "spoofed-agent",
        "x-owner-id": "spoofed-owner",
        "x-team-id": "spoofed-team",
        "x-connection-id": "spoofed-connection",
      },
    })
    const context = buildRequestContext(
      req,
      { authenticated: true, connectionId: "real-conn", ownerId: "real-owner", credentialId: "real-cred", connectionStatus: "ACTIVE" },
      new AbortController().signal
    )
    expect(context.ownerId).toBe("real-owner")
    expect(context.connectionId).toBe("real-conn")
    expect(context.machine?.ownerId).toBe("real-owner")
    // None of the spoofed values leak into the context anywhere.
    expect(JSON.stringify(context)).not.toContain("spoofed")
  })

  it("a credential presented for connection A resolves to owner A's identity even when a different owner exists", async () => {
    const { service, credentialStore } = await setupService()
    const connA = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    await service.create({ name: "B", provider: "claude", ownerId: "owner_2", actorId: "admin_1" })

    const tokenA = connA.credential.authMethod === "BEARER" ? connA.credential.bearerToken : ""
    const { sha256Hex } = await import("../shared/crypto")
    const record = await credentialStore.resolveBearerTokenHash(sha256Hex(tokenA))
    expect(record?.ownerId).toBe("owner_1")
    expect(record?.ownerId).not.toBe("owner_2")
  })

  it("an unknown token hash never resolves to any owner (no fallback identity)", async () => {
    const { credentialStore } = await setupService()
    const { sha256Hex } = await import("../shared/crypto")
    const record = await credentialStore.resolveBearerTokenHash(sha256Hex("completely-made-up-token"))
    expect(record).toBeNull()
  })
})
