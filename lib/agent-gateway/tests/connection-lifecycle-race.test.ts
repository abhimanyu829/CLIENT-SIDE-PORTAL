/**
 * lib/agent-gateway/tests/connection-lifecycle-race.test.ts
 *
 * Regression suite for the Phase 2 lifecycle race: transitions used to be
 * read-then-`update`, so an administrator's write could land on top of a
 * transition another administrator had committed after the read — e.g. a
 * suspend turning REVOKED back into SUSPENDED. Every status write is now
 * compare-and-set on the status it was judged from.
 *
 * Each test forces the exact interleaving deterministically: the other
 * operation runs to completion right after the first one's read returns
 * (stale) data and before it writes. Against the old code the "REVOKED
 * stays" assertions fail; against the fix they hold.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { createFakeDb } from "./fake-db"

const ENCRYPTION_KEY = "5".repeat(64)
type FakeDb = ReturnType<typeof createFakeDb>

async function setupService(opts: { expiresAt?: Date } = {}) {
  vi.resetModules()
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
  const fake = createFakeDb()
  const auditLog = vi.fn()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/audit", () => ({ auditLog }))
  vi.doMock("../identity/connection-cache", () => ({
    invalidateConnectionStatus: vi.fn(async () => {}),
    getCachedStatus: vi.fn(async () => null),
    setCachedStatus: vi.fn(async () => {}),
  }))
  const { PrismaAgentConnectionService } = await import("../identity/connection-service")
  const service = new PrismaAgentConnectionService()
  fake.seedUser("owner_1")
  const created = await service.create({ name: "Race agent", provider: "claude", ownerId: "owner_1", actorId: "admin_1", expiresAt: opts.expiresAt })
  if (created.credential.authMethod !== "BEARER") throw new Error("expected a bearer credential")
  return { service, fake, auditLog, id: created.connection.id, token: created.credential.bearerToken }
}

const statusOf = (fake: FakeDb, id: string) => fake._connections.get(id)!.status
const credentialsOf = (fake: FakeDb, id: string) => Array.from(fake._credentials.values()).filter((c) => c.connectionId === id)
const actions = (auditLog: ReturnType<typeof vi.fn>) => auditLog.mock.calls.map(([entry]) => (entry as { action: string }).action)
const eventFor = (auditLog: ReturnType<typeof vi.fn>, action: string) =>
  auditLog.mock.calls.map(([entry]) => entry as { action: string; before?: unknown }).find((e) => e.action === action)
/** Lets the fire-and-forget expiry writes settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Runs `interleave` after the NEXT connection read has taken its (now stale) snapshot. */
function afterNextConnectionRead(fake: FakeDb, interleave: () => Promise<unknown>) {
  fake.client.agentConnection.findUnique.mockImplementationOnce(async ({ where }: { where: { id: string } }) => {
    const snapshot = { ...fake._connections.get(where.id)! }
    await interleave()
    return snapshot
  })
}

describe("Phase 2 lifecycle transitions are compare-and-set (REVOKED is terminal under races)", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("a suspend that read ACTIVE and lands after a concurrent revoke is refused (409); REVOKED stays", async () => {
    const { service, fake, auditLog, id, token } = await setupService()
    afterNextConnectionRead(fake, () => service.revoke(id, "admin_2"))

    await expect(service.suspend(id, "admin_1")).rejects.toMatchObject({ code: "ILLEGAL_STATE_TRANSITION", statusCode: 409 })

    expect(statusOf(fake, id)).toBe("REVOKED")
    expect(fake._connections.get(id)!.suspendedAt).toBeNull()
    expect(credentialsOf(fake, id).map((c) => c.status)).toEqual(["REVOKED"])
    expect(await service.authenticateCredential(token)).toBeNull()
    expect(actions(auditLog)).not.toContain("AGENT_CONNECTION_SUSPENDED")
  })

  it("a reactivate that read SUSPENDED and lands after a concurrent revoke is refused (409); REVOKED stays", async () => {
    const { service, fake, auditLog, id, token } = await setupService()
    await service.suspend(id, "admin_1")
    afterNextConnectionRead(fake, () => service.revoke(id, "admin_2"))

    await expect(service.reactivate(id, "admin_1")).rejects.toMatchObject({ code: "ILLEGAL_STATE_TRANSITION" })

    expect(statusOf(fake, id)).toBe("REVOKED")
    expect(await service.authenticateCredential(token)).toBeNull()
    expect(actions(auditLog)).not.toContain("AGENT_CONNECTION_REACTIVATED")
  })

  it("a revoke that read ACTIVE and lands after a concurrent suspend re-reads and still revokes, auditing the real previous status", async () => {
    const { service, fake, auditLog, id, token } = await setupService()
    afterNextConnectionRead(fake, () => service.suspend(id, "admin_2"))

    await service.revoke(id, "admin_1")

    expect(statusOf(fake, id)).toBe("REVOKED")
    expect(credentialsOf(fake, id).every((c) => c.status === "REVOKED")).toBe(true)
    expect(await service.authenticateCredential(token)).toBeNull()
    expect(eventFor(auditLog, "AGENT_CONNECTION_REVOKED")?.before).toEqual({ status: "SUSPENDED" })
  })

  it("two administrators making the same change: one transition, one idempotent no-op, one audit event", async () => {
    const { service, fake, auditLog, id } = await setupService()
    afterNextConnectionRead(fake, () => service.suspend(id, "admin_2"))
    await expect(service.suspend(id, "admin_1")).resolves.toBeUndefined()
    expect(statusOf(fake, id)).toBe("SUSPENDED")
    expect(actions(auditLog).filter((a) => a === "AGENT_CONNECTION_SUSPENDED")).toHaveLength(1)

    await Promise.all([service.revoke(id, "admin_1"), service.revoke(id, "admin_2")])
    expect(statusOf(fake, id)).toBe("REVOKED")
    expect(actions(auditLog).filter((a) => a === "AGENT_CONNECTION_REVOKED")).toHaveLength(1)
  })

  it("gives up with a stable 409 instead of looping when the status changes under every attempt", async () => {
    const { service, fake, id } = await setupService()
    let reads = 0
    fake.client.agentConnection.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      reads += 1
      const row = fake._connections.get(where.id)!
      // Another writer flips the status right after every read.
      fake._connections.set(where.id, { ...row, status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })
      return { ...row }
    })

    await expect(service.revoke(id, "admin_1")).rejects.toMatchObject({
      code: "ILLEGAL_STATE_TRANSITION",
      message: expect.stringContaining("changed concurrently"),
    })
    expect(reads).toBe(3)
    expect(statusOf(fake, id)).not.toBe("REVOKED")
  })
})

describe("Opportunistic expiry never overwrites a newer lifecycle state", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("with no race, the first authentication after expiry still records EXPIRED on the connection and credential", async () => {
    const { service, fake, id, token } = await setupService({ expiresAt: new Date(Date.now() - 60_000) })
    expect(await service.authenticateCredential(token)).toBeNull()
    await flush()
    expect(statusOf(fake, id)).toBe("EXPIRED")
    expect(credentialsOf(fake, id).map((c) => c.status)).toEqual(["EXPIRED"])
  })

  it("an authentication that observed expiry before a concurrent revoke committed leaves REVOKED in place", async () => {
    const { service, fake, id, token } = await setupService({ expiresAt: new Date(Date.now() - 60_000) })
    fake.client.agentCredential.findUnique.mockImplementationOnce(async ({ where }: { where: { secretHash?: string; keyId?: string } }) => {
      const credential = Array.from(fake._credentials.values()).find((c) => c.secretHash === where.secretHash)!
      const snapshot = { ...credential, connection: { ...fake._connections.get(credential.connectionId)! } }
      await service.revoke(id, "admin_2")
      return snapshot
    })

    expect(await service.authenticateCredential(token)).toBeNull()
    await flush()

    expect(statusOf(fake, id)).toBe("REVOKED")
    expect(credentialsOf(fake, id).map((c) => c.status)).toEqual(["REVOKED"])
  })
})

describe("Rotation is serialized with revoke and with other rotations", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("a rotation that read ACTIVE before a concurrent revoke aborts (409) and creates no credential", async () => {
    const { service, fake, auditLog, id } = await setupService()
    fake.client.agentCredential.findFirst.mockImplementationOnce(async ({ where }: { where: { connectionId: string; status: string } }) => {
      const snapshot = { ...credentialsOf(fake, where.connectionId).find((c) => c.status === where.status)! }
      await service.revoke(id, "admin_2")
      return snapshot
    })

    await expect(service.rotateCredential(id, "admin_1")).rejects.toMatchObject({ code: "ILLEGAL_STATE_TRANSITION" })

    expect(statusOf(fake, id)).toBe("REVOKED")
    expect(credentialsOf(fake, id).map((c) => c.status)).toEqual(["REVOKED"])
    expect(actions(auditLog)).not.toContain("AGENT_CREDENTIAL_ROTATED")
  })

  it("two concurrent rotations leave exactly one ACTIVE credential: the second rotates the first one's credential", async () => {
    const { service, fake, id, token } = await setupService()

    const [first, second] = await Promise.all([service.rotateCredential(id, "admin_1"), service.rotateCredential(id, "admin_2")])

    const active = credentialsOf(fake, id).filter((c) => c.status === "ACTIVE")
    expect(active.map((c) => c.id)).toEqual([second.newCredentialId])
    expect(second.oldCredentialId).toBe(first.newCredentialId)
    const firstToken = first.credential.authMethod === "BEARER" ? first.credential.bearerToken : ""
    const secondToken = second.credential.authMethod === "BEARER" ? second.credential.bearerToken : ""
    expect(await service.authenticateCredential(token)).toBeNull()
    expect(await service.authenticateCredential(firstToken)).toBeNull()
    expect(await service.authenticateCredential(secondToken)).toMatchObject({ connectionId: id })
  })
})
