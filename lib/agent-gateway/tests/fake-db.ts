/**
 * lib/agent-gateway/tests/fake-db.ts
 *
 * A minimal in-memory fake of the Prisma client surface used by
 * connection-service.ts. Not a general-purpose Prisma mock — only
 * implements exactly the models/methods connection-service.ts calls,
 * including a real (in-memory) transactional rollback so rollback
 * behavior can be tested honestly.
 */
import { vi } from "vitest"

export interface FakeUserRow {
  id: string
}
export interface FakeTeamRow {
  id: string
}

export interface FakeAgentConnectionRow {
  id: string
  name: string
  provider: string
  externalAgentId: string | null
  description: string | null
  ownerId: string
  teamId: string | null
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED"
  authMethod: "BEARER" | "SIGNED_REQUEST"
  environment: string
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastAuthenticatedAt: Date | null
  lastSeenAt: Date | null
  revokedAt: Date | null
  suspendedAt: Date | null
  createdById: string
  updatedById: string | null
}

export interface FakeAgentCredentialRow {
  id: string
  connectionId: string
  status: "ACTIVE" | "ROTATING" | "REVOKED" | "EXPIRED"
  secretHash: string
  fingerprint: string
  keyId: string | null
  signingSecretRef: string | null
  replacesCredentialId: string | null
  createdAt: Date
  activatedAt: Date | null
  expiresAt: Date | null
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdById: string
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

export function createFakeDb() {
  const users = new Map<string, FakeUserRow>()
  const teams = new Map<string, FakeTeamRow>()
  const connections = new Map<string, FakeAgentConnectionRow>()
  const credentials = new Map<string, FakeAgentCredentialRow>()

  function findConnection(id: string) {
    return connections.get(id) ?? null
  }
  function findCredentialBySecretHash(secretHash: string) {
    for (const c of credentials.values()) if (c.secretHash === secretHash) return c
    return null
  }
  function findCredentialByKeyId(keyId: string) {
    for (const c of credentials.values()) if (c.keyId === keyId) return c
    return null
  }
  function withConnection<T extends FakeAgentCredentialRow>(credential: T) {
    return { ...credential, connection: connections.get(credential.connectionId) }
  }

  const client = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null),
    },
    team: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => teams.get(where.id) ?? null),
    },
    agentConnection: {
      create: vi.fn(async ({ data }: { data: Partial<FakeAgentConnectionRow> }) => {
        const now = new Date()
        const row: FakeAgentConnectionRow = {
          id: nextId("conn"),
          name: data.name ?? "",
          provider: data.provider ?? "",
          externalAgentId: data.externalAgentId ?? null,
          description: data.description ?? null,
          ownerId: data.ownerId!,
          teamId: data.teamId ?? null,
          status: (data.status as FakeAgentConnectionRow["status"]) ?? "PENDING",
          authMethod: (data.authMethod as FakeAgentConnectionRow["authMethod"]) ?? "BEARER",
          environment: data.environment ?? "development",
          expiresAt: data.expiresAt ?? null,
          createdAt: now,
          updatedAt: now,
          lastAuthenticatedAt: null,
          lastSeenAt: null,
          revokedAt: null,
          suspendedAt: null,
          createdById: data.createdById!,
          updatedById: null,
        }
        connections.set(row.id, row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeAgentConnectionRow> }) => {
        const row = connections.get(where.id)
        if (!row) throw new Error("connection not found")
        const updated = { ...row, ...data, updatedAt: new Date() }
        connections.set(where.id, updated)
        return updated
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => findConnection(where.id)),
      findMany: vi.fn(async () => Array.from(connections.values())),
    },
    agentCredential: {
      create: vi.fn(async ({ data }: { data: Partial<FakeAgentCredentialRow> }) => {
        const now = new Date()
        const row: FakeAgentCredentialRow = {
          id: nextId("cred"),
          connectionId: data.connectionId!,
          status: (data.status as FakeAgentCredentialRow["status"]) ?? "ACTIVE",
          secretHash: data.secretHash!,
          fingerprint: data.fingerprint!,
          keyId: data.keyId ?? null,
          signingSecretRef: data.signingSecretRef ?? null,
          replacesCredentialId: data.replacesCredentialId ?? null,
          createdAt: now,
          activatedAt: data.activatedAt ?? null,
          expiresAt: data.expiresAt ?? null,
          lastUsedAt: null,
          revokedAt: null,
          createdById: data.createdById!,
        }
        credentials.set(row.id, row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeAgentCredentialRow> }) => {
        const row = credentials.get(where.id)
        if (!row) throw new Error("credential not found")
        const updated = { ...row, ...data }
        credentials.set(where.id, updated)
        return updated
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { connectionId: string; status?: { not: string } }
          data: Partial<FakeAgentCredentialRow>
        }) => {
          let count = 0
          for (const [id, row] of credentials) {
            if (row.connectionId !== where.connectionId) continue
            if (where.status && row.status === where.status.not) continue
            credentials.set(id, { ...row, ...data })
            count += 1
          }
          return { count }
        }
      ),
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { secretHash?: string; keyId?: string }
          include?: { connection?: boolean }
        }) => {
          const row = where.secretHash ? findCredentialBySecretHash(where.secretHash) : where.keyId ? findCredentialByKeyId(where.keyId) : null
          if (!row) return null
          return include?.connection ? withConnection(row) : row
        }
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { connectionId: string; status: string } }) => {
          for (const c of credentials.values()) {
            if (c.connectionId === where.connectionId && c.status === where.status) return c
          }
          return null
        }
      ),
    },
    // Real (in-memory) transactional semantics: snapshot before, restore on
    // throw, AND serialized so concurrent $transaction calls never
    // interleave — matching real Postgres transaction isolation, where one
    // transaction's writes are never visible mid-flight to another. Without
    // this lock, JS's cooperative async scheduling would let two "transactions"
    // interleave their statements arbitrarily (e.g. a callback-form
    // transaction's writes between its own internal `await`s could be
    // clobbered by another transaction that starts and finishes in that gap),
    // which is a fake-db-only artifact, not a real DB behavior.
    //
    // NOTE: the array-form `db.$transaction([opA, opB])` call shape is
    // intentionally NOT used anywhere in connection-service.ts's production
    // code paths that need this serialization guarantee across other
    // concurrent transactions — every mutation that must be atomic with
    // respect to concurrent lifecycle changes uses the callback form so its
    // full body runs while holding this lock.
    $transaction: (() => {
      let queue: Promise<unknown> = Promise.resolve()
      const run = vi.fn(async (arg: unknown) => {
        const previous = queue
        let release: () => void
        const next = new Promise<void>((resolve) => {
          release = resolve
        })
        queue = previous.then(() => next)
        await previous

        const snapshot = {
          connections: new Map(connections),
          credentials: new Map(credentials),
        }
        try {
          if (Array.isArray(arg)) {
            const results: unknown[] = []
            for (const p of arg as Promise<unknown>[]) results.push(await p)
            return results
          }
          return await (arg as (tx: typeof client) => Promise<unknown>)(client)
        } catch (err) {
          connections.clear()
          for (const [k, v] of snapshot.connections) connections.set(k, v)
          credentials.clear()
          for (const [k, v] of snapshot.credentials) credentials.set(k, v)
          throw err
        } finally {
          release!()
        }
      })
      return run
    })(),
  }

  return {
    client,
    seedUser: (id: string) => users.set(id, { id }),
    seedTeam: (id: string) => teams.set(id, { id }),
    _connections: connections,
    _credentials: credentials,
  }
}
