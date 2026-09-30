import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeDb } from "./fake-db"

const ENCRYPTION_KEY = "0".repeat(64)

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
  const service = new PrismaAgentConnectionService()
  fake.seedUser("owner_1")
  fake.seedTeam("team_1")
  return { service, fake }
}

describe("PrismaAgentConnectionService.create", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("creates a BEARER connection, activates it, and returns the credential exactly once", async () => {
    const { service } = await setupService()
    const result = await service.create({
      name: "Test Agent",
      provider: "claude",
      ownerId: "owner_1",
      actorId: "admin_1",
    })

    expect(result.connection.status).toBe("ACTIVE")
    expect(result.credential.authMethod).toBe("BEARER")
    if (result.credential.authMethod === "BEARER") {
      expect(result.credential.bearerToken).toMatch(/^agw_[0-9a-f]{64}$/)
    }
  })

  it("creates a SIGNED_REQUEST connection with a keyId and signingSecret", async () => {
    const { service } = await setupService()
    const result = await service.create({
      name: "Signed Agent",
      provider: "custom",
      ownerId: "owner_1",
      authMethod: "SIGNED_REQUEST",
      actorId: "admin_1",
    })

    expect(result.credential.authMethod).toBe("SIGNED_REQUEST")
    if (result.credential.authMethod === "SIGNED_REQUEST") {
      expect(result.credential.keyId).toMatch(/^key_/)
      expect(result.credential.signingSecret).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it("rejects creation for a non-existent owner", async () => {
    const { service } = await setupService()
    await expect(
      service.create({ name: "X", provider: "claude", ownerId: "does-not-exist", actorId: "admin_1" })
    ).rejects.toThrow("owner")
  })

  it("rejects creation for a non-existent team", async () => {
    const { service } = await setupService()
    await expect(
      service.create({ name: "X", provider: "claude", ownerId: "owner_1", teamId: "no-such-team", actorId: "admin_1" })
    ).rejects.toThrow("team")
  })

  it("binds the connection to the specified owner and team", async () => {
    const { service } = await setupService()
    const result = await service.create({
      name: "Team-bound Agent",
      provider: "claude",
      ownerId: "owner_1",
      teamId: "team_1",
      actorId: "admin_1",
    })
    expect(result.connection.ownerId).toBe("owner_1")
    expect(result.connection.teamId).toBe("team_1")
  })
})

describe("PrismaAgentConnectionService.authenticateCredential", () => {
  it("resolves machine identity for a valid, active bearer credential", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    const identity = await service.authenticateCredential(token)
    expect(identity).not.toBeNull()
    expect(identity?.connectionId).toBe(created.connection.id)
    expect(identity?.ownerId).toBe("owner_1")
    expect(identity?.connectionStatus).toBe("ACTIVE")
  })

  it("returns null for an unrecognized token", async () => {
    const { service } = await setupService()
    const identity = await service.authenticateCredential("agw_" + "f".repeat(64))
    expect(identity).toBeNull()
  })

  it("returns null for a PENDING connection (should never happen post-create, but must be defensive)", async () => {
    const { service, fake } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    // Force the connection back to PENDING directly at the storage layer to
    // simulate a defensive-programming scenario.
    fake._connections.set(created.connection.id, { ...fake._connections.get(created.connection.id)!, status: "PENDING" })
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).toBeNull()
  })

  it("returns null for a SUSPENDED connection (Property 2)", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    await service.suspend(created.connection.id, "admin_1")
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).toBeNull()
  })

  it("returns null for a REVOKED connection/credential (Property 1)", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    await service.revoke(created.connection.id, "admin_1")
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).toBeNull()
  })

  it("returns null for an expired credential and never grants access", async () => {
    const { service } = await setupService()
    const past = new Date(Date.now() - 60_000)
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1", expiresAt: past })
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).toBeNull()
  })

  it("a credential from connection A never resolves connection B (Property 3)", async () => {
    const { service } = await setupService()
    const a = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const b = await service.create({ name: "B", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const tokenA = a.credential.authMethod === "BEARER" ? a.credential.bearerToken : ""

    const identity = await service.authenticateCredential(tokenA)
    expect(identity?.connectionId).toBe(a.connection.id)
    expect(identity?.connectionId).not.toBe(b.connection.id)
  })
})

describe("PrismaAgentConnectionService lifecycle transitions", () => {
  it("suspend then reactivate restores authentication", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    await service.suspend(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).toBeNull()

    await service.reactivate(created.connection.id, "admin_1")
    const identity = await service.authenticateCredential(token)
    expect(identity).not.toBeNull()
  })

  it("suspend is idempotent — suspending twice does not throw", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    await service.suspend(created.connection.id, "admin_1")
    await expect(service.suspend(created.connection.id, "admin_1")).resolves.not.toThrow()
  })

  it("revoke is idempotent — revoking twice does not throw", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    await service.revoke(created.connection.id, "admin_1")
    await expect(service.revoke(created.connection.id, "admin_1")).resolves.not.toThrow()
  })

  it("revoke is terminal — cannot reactivate a revoked connection", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    await service.revoke(created.connection.id, "admin_1")
    await expect(service.reactivate(created.connection.id, "admin_1")).rejects.toThrow()
  })

  it("throws CONNECTION_NOT_FOUND for lifecycle actions on a nonexistent connection", async () => {
    const { service } = await setupService()
    await expect(service.suspend("does-not-exist", "admin_1")).rejects.toThrow()
    await expect(service.revoke("does-not-exist", "admin_1")).rejects.toThrow()
    await expect(service.reactivate("does-not-exist", "admin_1")).rejects.toThrow()
  })
})

describe("PrismaAgentConnectionService.rotateCredential", () => {
  it("the old credential stops working and the new one works after rotation", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const oldToken = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    const rotated = await service.rotateCredential(created.connection.id, "admin_1")
    const newToken = rotated.credential.authMethod === "BEARER" ? rotated.credential.bearerToken : ""

    expect(await service.authenticateCredential(oldToken)).toBeNull()
    const identity = await service.authenticateCredential(newToken)
    expect(identity).not.toBeNull()
    expect(identity?.connectionId).toBe(created.connection.id)
  })

  it("never exposes the old secret in the rotation result (Property 8)", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const oldToken = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    const rotated = await service.rotateCredential(created.connection.id, "admin_1")
    expect(JSON.stringify(rotated)).not.toContain(oldToken)
  })

  it("throws for rotation on a nonexistent connection", async () => {
    const { service } = await setupService()
    await expect(service.rotateCredential("does-not-exist", "admin_1")).rejects.toThrow()
  })
})
