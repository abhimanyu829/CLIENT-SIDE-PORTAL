import { afterEach, describe, expect, it, vi } from "vitest"
import { createFakeDb } from "./fake-db"

const ENCRYPTION_KEY = "1".repeat(64)

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
  return { service, fake }
}

describe("Phase 2 integration: full admin lifecycle flow (Phase 2 spec §45)", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("create -> credential issued -> credential authenticates -> machine identity resolved", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "Integration Agent", provider: "hermes", ownerId: "owner_1", actorId: "admin_1" })
    expect(created.connection.status).toBe("ACTIVE")

    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    const identity = await service.authenticateCredential(token)
    expect(identity).not.toBeNull()
    expect(identity?.connectionId).toBe(created.connection.id)
    expect(identity?.provider).toBe("hermes")
  })

  it("suspend -> credential rejected -> reactivate -> credential works again", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "Agent", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    await service.suspend(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).toBeNull()

    await service.reactivate(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).not.toBeNull()
  })

  it("rotate -> new credential works -> old credential eventually fails", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "Agent", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const oldToken = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    const rotated = await service.rotateCredential(created.connection.id, "admin_1")
    const newToken = rotated.credential.authMethod === "BEARER" ? rotated.credential.bearerToken : ""

    expect(await service.authenticateCredential(newToken)).not.toBeNull()
    expect(await service.authenticateCredential(oldToken)).toBeNull()
  })

  it("revoke -> credential fails permanently, even after attempting reactivate", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "Agent", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""

    await service.revoke(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).toBeNull()

    await expect(service.reactivate(created.connection.id, "admin_1")).rejects.toThrow()
    expect(await service.authenticateCredential(token)).toBeNull()
  })

  it("full end-to-end: create -> authenticate -> suspend -> reactivate -> rotate -> revoke", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "Full Flow Agent", provider: "paperclip", ownerId: "owner_1", actorId: "admin_1" })
    let token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).not.toBeNull()

    await service.suspend(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).toBeNull()

    await service.reactivate(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).not.toBeNull()

    const rotated = await service.rotateCredential(created.connection.id, "admin_1")
    token = rotated.credential.authMethod === "BEARER" ? rotated.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).not.toBeNull()

    await service.revoke(created.connection.id, "admin_1")
    expect(await service.authenticateCredential(token)).toBeNull()

    const finalConnection = await service.getById(created.connection.id)
    expect(finalConnection?.status).toBe("REVOKED")
  })
})
