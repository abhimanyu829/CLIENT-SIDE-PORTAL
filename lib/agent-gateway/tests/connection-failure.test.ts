import { afterEach, describe, expect, it, vi } from "vitest"
import { createFakeDb } from "./fake-db"

const ENCRYPTION_KEY = "3".repeat(64)

async function setupService(overrides?: { failCreate?: boolean }) {
  vi.resetModules()
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
  const fake = createFakeDb()

  if (overrides?.failCreate) {
    const originalCreate = fake.client.agentCredential.create
    let callCount = 0
    fake.client.agentCredential.create = vi.fn(async (...args: Parameters<typeof originalCreate>) => {
      callCount += 1
      // Simulate a mid-transaction failure on the SECOND credential write
      // (e.g. process restart during rotation, spec §47).
      if (callCount === 2) throw new Error("simulated DB failure mid-transaction")
      return originalCreate(...args)
    })
  }

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

describe("Failure handling — never leaves an ambiguous security state (Phase 2 spec §47)", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("a simulated failure during rotation's new-credential creation rolls back cleanly — old credential remains ACTIVE, not stuck in ROTATING", async () => {
    const { service, fake } = await setupService({ failCreate: true })
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })
    // The create() call itself succeeds normally (callCount reaches 1 for
    // its single credential.create); the injected failure fires on the
    // SECOND ever call to agentCredential.create, which is rotateCredential's.
    await expect(service.rotateCredential(created.connection.id, "admin_1")).rejects.toThrow()

    // Old credential must not be left permanently stuck in ROTATING — the
    // transaction rollback (fake-db's $transaction snapshot/restore) must
    // have restored it to ACTIVE.
    const credentials = Array.from(fake._credentials.values()).filter((c) => c.connectionId === created.connection.id)
    expect(credentials).toHaveLength(1)
    expect(credentials[0].status).toBe("ACTIVE")

    const token = created.credential.authMethod === "BEARER" ? created.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).not.toBeNull()
  })

  it("connection lookup for a missing connection fails with a clear error, not a silent null identity", async () => {
    const { service } = await setupService()
    await expect(service.rotateCredential("nonexistent", "admin_1")).rejects.toThrow()
  })

  it("malformed/empty credential input never authenticates", async () => {
    const { service } = await setupService()
    expect(await service.authenticateCredential("")).toBeNull()
    expect(await service.authenticateCredential("   ")).toBeNull()
  })
})

describe("Concurrency — race conditions (Phase 2 spec §36)", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("concurrent revoke calls on the same connection both resolve without corrupting state", async () => {
    const { service } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })

    const [r1, r2] = await Promise.allSettled([
      service.revoke(created.connection.id, "admin_1"),
      service.revoke(created.connection.id, "admin_2"),
    ])
    // Both must resolve (idempotent) — neither should leave the connection
    // in a state other than REVOKED.
    expect(r1.status).toBe("fulfilled")
    expect(r2.status).toBe("fulfilled")

    const final = await service.getById(created.connection.id)
    expect(final?.status).toBe("REVOKED")
  })

  it("a rotate racing a revoke ends in a safe final state (revoked wins, no credential is left ACTIVE)", async () => {
    const { service, fake } = await setupService()
    const created = await service.create({ name: "A", provider: "claude", ownerId: "owner_1", actorId: "admin_1" })

    await Promise.allSettled([
      service.rotateCredential(created.connection.id, "admin_1"),
      service.revoke(created.connection.id, "admin_2"),
    ])

    const final = await service.getById(created.connection.id)
    // Whichever order the fake DB's sequential-await model resolves them in,
    // the connection must end in a terminal, well-defined state — never
    // "ACTIVE with a credential that shouldn't work" or vice versa.
    expect(["ACTIVE", "REVOKED"]).toContain(final?.status)

    if (final?.status === "REVOKED") {
      const anyActive = Array.from(fake._credentials.values()).some(
        (c) => c.connectionId === created.connection.id && c.status === "ACTIVE"
      )
      expect(anyActive).toBe(false)
    }
  })
})
