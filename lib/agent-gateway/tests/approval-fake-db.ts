/**
 * lib/agent-gateway/tests/approval-fake-db.ts
 *
 * Phase 7 in-memory fake of the Prisma surface used by the autonomy policy
 * store and the approval engine (agentAutonomyPolicy, agentApprovalRequest,
 * agentApprovalDecision, plus the agentConnection/user reads they perform).
 *
 * Same conventions and the same disclosed limitation as the Phase 2/4/6
 * fakes (tests/fake-db.ts, execution-fake-db.ts, authz-fake-db.ts): there is
 * no live Postgres in this environment, so this fake proves the services'
 * query construction and atomic-conditional-update logic, not Postgres
 * itself. It deliberately REPRODUCES the database guarantees the services
 * rely on:
 *   - unique constraints (publicRef, activeBindingKey, connectionId+version)
 *     throw `{ code: "P2002" }` exactly like Prisma;
 *   - `updateMany` evaluates its WHERE and applies its data as one
 *     synchronous step (no await in between), which is the in-memory
 *     equivalent of a single conditional UPDATE statement;
 *   - `$transaction` is serialized with snapshot/rollback.
 */
import { vi } from "vitest"

type Row = Record<string, unknown>

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

let clockCounter = 0
/** Strictly increasing createdAt values so "orderBy createdAt desc" is deterministic. */
function createdAtNow(): Date {
  clockCounter += 1
  return new Date(Date.now() + clockCounter)
}

function uniqueViolation(target: string): Error & { code: string; meta: { target: string } } {
  const err = new Error(`Unique constraint failed on the fields: (\`${target}\`)`) as Error & { code: string; meta: { target: string } }
  err.code = "P2002"
  err.meta = { target }
  return err
}

function matchesCondition(actual: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>
    if ("in" in c) return (c.in as unknown[]).includes(actual)
    if ("gt" in c) return actual instanceof Date && c.gt instanceof Date ? actual.getTime() > c.gt.getTime() : (actual as number) > (c.gt as number)
    if ("lt" in c) return actual instanceof Date && c.lt instanceof Date ? actual.getTime() < c.lt.getTime() : (actual as number) < (c.lt as number)
    if ("not" in c) return actual !== c.not
    if ("equals" in c) return actual === c.equals
    throw new Error(`fake db: unsupported condition ${JSON.stringify(Object.keys(c))}`)
  }
  if (actual instanceof Date && cond instanceof Date) return actual.getTime() === cond.getTime()
  return (actual ?? null) === (cond ?? null)
}

export function matchesWhere(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    if (key === "NOT") {
      if (matchesWhere(row, cond as Record<string, unknown>)) return false
      continue
    }
    if (key === "AND") {
      if (!(cond as Record<string, unknown>[]).every((w) => matchesWhere(row, w))) return false
      continue
    }
    if (key === "OR") {
      if (!(cond as Record<string, unknown>[]).some((w) => matchesWhere(row, w))) return false
      continue
    }
    if (!matchesCondition(row[key], cond)) return false
  }
  return true
}

function applyData(row: Row, data: Record<string, unknown>): Row {
  const next: Row = { ...row }
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value) && "increment" in (value as Row)) {
      next[key] = ((next[key] as number) ?? 0) + ((value as { increment: number }).increment ?? 0)
    } else {
      next[key] = value
    }
  }
  return next
}

function project(row: Row | undefined | null, select?: Record<string, boolean>): Row | null {
  if (!row) return null
  if (!select) return { ...row }
  const out: Row = {}
  for (const [k, on] of Object.entries(select)) if (on) out[k] = row[k]
  return out
}

function sortRows(rows: Row[], orderBy?: Record<string, "asc" | "desc">): Row[] {
  if (!orderBy) return rows
  const [[key, dir]] = Object.entries(orderBy)
  const val = (r: Row) => (r[key] instanceof Date ? (r[key] as Date).getTime() : (r[key] as number))
  return [...rows].sort((a, b) => (dir === "desc" ? val(b) - val(a) : val(a) - val(b)))
}

interface UniqueSpec {
  name: string
  key: (row: Row) => string | null
}

function createTable(prefix: string, uniques: UniqueSpec[], defaults: (data: Row) => Row) {
  const rows = new Map<string, Row>()

  function assertUnique(candidate: Row, ignoreId?: string) {
    for (const u of uniques) {
      const k = u.key(candidate)
      if (k === null) continue
      for (const [id, existing] of rows) {
        if (id === ignoreId) continue
        if (u.key(existing) === k) throw uniqueViolation(u.name)
      }
    }
  }

  const api = {
    create: vi.fn(async ({ data, select }: { data: Row; select?: Record<string, boolean> }) => {
      const row: Row = { id: nextId(prefix), createdAt: createdAtNow(), ...defaults(data), ...data }
      assertUnique(row)
      rows.set(row.id as string, row)
      return project(row, select)
    }),
    findUnique: vi.fn(async ({ where, select }: { where: Row; select?: Record<string, boolean> }) => {
      const found = Array.from(rows.values()).find((r) => matchesWhere(r, where))
      return project(found, select)
    }),
    findFirst: vi.fn(async ({ where, orderBy, select }: { where?: Row; orderBy?: Record<string, "asc" | "desc">; select?: Record<string, boolean> }) => {
      const found = sortRows(Array.from(rows.values()).filter((r) => matchesWhere(r, where)), orderBy)[0]
      return project(found, select)
    }),
    findMany: vi.fn(async ({ where, orderBy, take, select }: { where?: Row; orderBy?: Record<string, "asc" | "desc">; take?: number; select?: Record<string, boolean> } = {}) => {
      const found = sortRows(Array.from(rows.values()).filter((r) => matchesWhere(r, where)), orderBy)
      return found.slice(0, take ?? found.length).map((r) => project(r, select) as Row)
    }),
    // One synchronous check-and-set per row: the in-memory analogue of a
    // single conditional UPDATE ... WHERE statement.
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      let count = 0
      for (const [id, row] of rows) {
        if (!matchesWhere(row, where)) continue
        const next = applyData(row, data)
        assertUnique(next, id)
        rows.set(id, next)
        count += 1
      }
      return { count }
    }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const found = Array.from(rows.values()).find((r) => matchesWhere(r, where))
      if (!found) throw Object.assign(new Error("Record not found"), { code: "P2025" })
      const next = applyData(found, data)
      assertUnique(next, found.id as string)
      rows.set(found.id as string, next)
      return { ...next }
    }),
    count: vi.fn(async ({ where }: { where?: Row } = {}) => Array.from(rows.values()).filter((r) => matchesWhere(r, where)).length),
  }
  return { rows, api }
}

export interface FakeUser {
  id: string
  phone: string | null
  phoneVerified: boolean
  role?: string
}

export function createApprovalFakeDb() {
  const autonomy = createTable(
    "autonomy",
    [{ name: "connectionId_version", key: (r) => `${r.connectionId}:${r.version}` }],
    () => ({ status: "ACTIVE", allowedCapabilityIds: [], approvalRequiredFor: [], environmentScope: [], resourceScopeReference: null, expiresAt: null, note: null })
  )
  const requests = createTable(
    "apreq",
    [
      { name: "publicRef", key: (r) => (r.publicRef as string) ?? null },
      { name: "activeBindingKey", key: (r) => (r.activeBindingKey as string | null) ?? null },
    ],
    () => ({
      status: "PENDING",
      stepUpCodeHash: null,
      stepUpApproverId: null,
      stepUpExpiresAt: null,
      stepUpAttempts: 0,
      approvedAt: null,
      rejectedAt: null,
      consumedAt: null,
      cancelledAt: null,
      expiredAt: null,
      cancelReason: null,
      teamId: null,
      agentId: null,
      resourceType: null,
      resourceId: null,
    })
  )
  const decisions = createTable("apdec", [{ name: "approvalRequestId", key: (r) => (r.approvalRequestId as string) ?? null }], () => ({ reasonCode: null }))
  const connections = new Map<string, Row>()
  const users = new Map<string, FakeUser>()

  const client = {
    agentAutonomyPolicy: autonomy.api,
    agentApprovalRequest: requests.api,
    agentApprovalDecision: decisions.api,
    agentConnection: {
      findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => project(connections.get(where.id), select)),
    },
    user: {
      findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => project(users.get(where.id) as Row | undefined, select)),
    },
    $transaction: undefined as unknown as (arg: unknown) => Promise<unknown>,
  }

  // Serialized, snapshot/rollback transaction (same semantics as authz-fake-db.ts).
  let queue: Promise<unknown> = Promise.resolve()
  let txTarget: unknown = client
  client.$transaction = vi.fn(async (arg: unknown) => {
    const previous = queue
    let release: () => void
    const next = new Promise<void>((resolve) => {
      release = resolve
    })
    queue = previous.then(() => next)
    await previous
    const snap = [autonomy.rows, requests.rows, decisions.rows].map((m) => new Map(m))
    try {
      if (Array.isArray(arg)) {
        const results: unknown[] = []
        for (const p of arg as Promise<unknown>[]) results.push(await p)
        return results
      }
      return await (arg as (tx: unknown) => Promise<unknown>)(txTarget)
    } catch (err) {
      ;[autonomy.rows, requests.rows, decisions.rows].forEach((m, i) => {
        m.clear()
        for (const [k, v] of snap[i]) m.set(k, v)
      })
      throw err
    } finally {
      release!()
    }
  })

  return {
    client,
    /** When merged into a larger fake db, pass the merged object so transactions see every model. */
    setTransactionTarget: (target: unknown) => {
      txTarget = target
    },
    seedConnection: (row: { id: string; name?: string; status?: string }) => connections.set(row.id, { name: null, status: "ACTIVE", ...row }),
    seedUser: (user: FakeUser) => users.set(user.id, user),
    _autonomy: autonomy.rows,
    _requests: requests.rows,
    _decisions: decisions.rows,
  }
}
