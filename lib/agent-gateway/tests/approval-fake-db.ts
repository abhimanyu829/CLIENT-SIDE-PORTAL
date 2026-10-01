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
import { Prisma } from "@prisma/client"

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

const num = (v: unknown): number => (v instanceof Date ? v.getTime() : (v as number))

function matchesCondition(actual: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>
    // Like SQL, a range comparison against NULL is never true.
    const comparable = actual !== null && actual !== undefined
    if ("in" in c) return (c.in as unknown[]).includes(actual)
    if ("gt" in c) return comparable && num(actual) > num(c.gt)
    if ("gte" in c) return comparable && num(actual) >= num(c.gte)
    if ("lt" in c) return comparable && num(actual) < num(c.lt)
    if ("lte" in c) return comparable && num(actual) <= num(c.lte)
    if ("not" in c) return actual !== c.not
    if ("equals" in c) return actual === c.equals
    throw new Error(`fake db: unsupported condition ${JSON.stringify(Object.keys(c))}`)
  }
  if (actual instanceof Date && cond instanceof Date) return actual.getTime() === cond.getTime()
  return (actual ?? null) === (cond ?? null)
}

const OPERATOR_KEYS = new Set(["in", "gt", "gte", "lt", "lte", "not", "equals"])

/** Prisma compound-unique selector, e.g. `{ triggerId_deliveryKey: { triggerId, deliveryKey } }`. */
function isCompoundSelector(row: Row, key: string, cond: unknown): cond is Record<string, unknown> {
  if (!key.includes("_") || key in row) return false
  if (cond === null || typeof cond !== "object" || cond instanceof Date || Array.isArray(cond)) return false
  const keys = Object.keys(cond)
  return keys.length > 1 && keys.every((k) => !OPERATOR_KEYS.has(k))
}

export function matchesWhere(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    if (isCompoundSelector(row, key, cond)) {
      if (!matchesWhere(row, cond)) return false
      continue
    }
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

/** Prisma's null sentinels are write-time only: stored and read back as SQL NULL. */
function unwrapNullSentinel(value: unknown): unknown {
  return value === Prisma.DbNull || value === Prisma.JsonNull || value === Prisma.AnyNull ? null : value
}

function applyData(row: Row, data: Record<string, unknown>): Row {
  const next: Row = { ...row }
  for (const [key, rawValue] of Object.entries(data)) {
    // Prisma ignores undefined fields in `data`.
    if (rawValue === undefined) continue
    const value = unwrapNullSentinel(rawValue)
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

export function createTable(prefix: string, uniques: UniqueSpec[], defaults: (data: Row) => Row) {
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
      const row: Row = applyData({ id: nextId(prefix), createdAt: createdAtNow(), updatedAt: new Date(), ...defaults(data) }, data)
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
    findMany: vi.fn(
      async ({ where, orderBy, take, skip, select }: { where?: Row; orderBy?: Record<string, "asc" | "desc">; take?: number; skip?: number; select?: Record<string, boolean> } = {}) => {
        const found = sortRows(Array.from(rows.values()).filter((r) => matchesWhere(r, where)), orderBy)
        const start = skip ?? 0
        return found.slice(start, take === undefined ? found.length : start + take).map((r) => project(r, select) as Row)
      }
    ),
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
    deleteMany: vi.fn(async ({ where }: { where?: Row } = {}) => {
      let count = 0
      for (const [id, row] of rows) {
        if (!matchesWhere(row, where)) continue
        rows.delete(id)
        count += 1
      }
      return { count }
    }),
  }
  return { rows, api }
}

export interface FakeUser {
  id: string
  phone: string | null
  phoneVerified: boolean
  role?: string
  isBanned?: boolean
  name?: string | null
  email?: string | null
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
  // Phase 8 — AgentTask, with the same unique constraints as the migration.
  const tasks = createTable(
    "task",
    [
      { name: "taskRef", key: (r) => (r.taskRef as string) ?? null },
      { name: "idempotencyScope", key: (r) => (r.idempotencyScope as string | null) ?? null },
      { name: "activeOperationKey", key: (r) => (r.activeOperationKey as string | null) ?? null },
      { name: "approvalRequestId", key: (r) => (r.approvalRequestId as string | null) ?? null },
    ],
    () => ({
      agentId: null,
      teamId: null,
      resourceType: null,
      resourceId: null,
      idempotencyKey: null,
      idempotencyScope: null,
      activeOperationKey: null,
      approvalRequestId: null,
      autonomyPolicyVersion: null,
      status: "QUEUED",
      attempts: 0,
      retryScheduled: false,
      cancelRequestedAt: null,
      queuedAt: new Date(),
      attemptStartedAt: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      finishedAt: null,
      result: null,
      resultRemovedAt: null,
      errorCode: null,
      errorDetailCode: null,
      triggerId: null,
    })
  )
  // Phase 9 — AgentTrigger / AgentTriggerRun, with the migration's unique constraints.
  const triggers = createTable("trigger", [{ name: "publicRef", key: (r) => (r.publicRef as string) ?? null }], () => ({
    status: "DRAFT",
    version: 1,
    teamId: null,
    bindResource: false,
    concurrency: "DROP_WHILE_RUNNING",
    eventType: null,
    eventResourceId: null,
    eventActorScope: null,
    webhookSecretRef: null,
    webhookSecretVersion: null,
    scheduleKind: null,
    cronExpression: null,
    timezone: null,
    runAt: null,
    missedRunPolicy: null,
    nextRunAt: null,
    lastScheduledFor: null,
    expiresAt: null,
    lastTriggeredAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    failureCount: 0,
    activatedAt: null,
    pausedAt: null,
    disabledAt: null,
    expiredAt: null,
    revokedAt: null,
    updatedById: null,
  }))
  const triggerRuns = createTable(
    "trun",
    [
      { name: "publicRef", key: (r) => (r.publicRef as string) ?? null },
      { name: "taskId", key: (r) => (r.taskId as string | null) ?? null },
      { name: "activeSlotKey", key: (r) => (r.activeSlotKey as string | null) ?? null },
      { name: "pendingSlotKey", key: (r) => (r.pendingSlotKey as string | null) ?? null },
      { name: "triggerId_deliveryKey", key: (r) => `${r.triggerId}\n${r.deliveryKey}` },
    ],
    () => ({
      taskId: null,
      errorCode: null,
      resourceId: null,
      scheduledFor: null,
      bodyDigest: null,
      activeSlotKey: null,
      pendingSlotKey: null,
      activeSince: null,
      receivedAt: createdAtNow(),
      completedAt: null,
    })
  )
  // Phase 10 — AgentConnection / AgentCredential / AuditLog as full tables, so
  // the real Phase 2 connection service and the governance queries run here.
  const connectionTable = createTable("conn", [], () => ({
    name: null,
    provider: "custom",
    externalAgentId: null,
    description: null,
    ownerId: "owner_1",
    teamId: null,
    status: "PENDING",
    authMethod: "BEARER",
    environment: "development",
    lastAuthenticatedAt: null,
    lastSeenAt: null,
    expiresAt: null,
    revokedAt: null,
    suspendedAt: null,
    updatedById: null,
  }))
  const credentials = createTable(
    "cred",
    [
      { name: "secretHash", key: (r) => (r.secretHash as string | null) ?? null },
      { name: "keyId", key: (r) => (r.keyId as string | null) ?? null },
    ],
    () => ({ status: "ACTIVE", fingerprint: null, keyId: null, signingSecretRef: null, activatedAt: null, expiresAt: null, lastUsedAt: null, revokedAt: null, replacesCredentialId: null })
  )
  const auditLogs = createTable("audit", [], () => ({ userId: null, entity: null, entityId: null, beforeJson: null, afterJson: null, ip: null, userAgent: null }))
  const connections = connectionTable.rows
  // `include: { connection: true }` (Phase 2 credential authentication).
  const credentialFindUnique = credentials.api.findUnique
  credentials.api.findUnique = vi.fn(async (args: { where: Row; select?: Record<string, boolean>; include?: { connection?: boolean } }) => {
    const row = await credentialFindUnique({ where: args.where, select: args.select })
    if (!row || !args.include?.connection) return row
    const connection = connections.get(row.connectionId as string)
    return { ...row, connection: connection ? { ...connection } : null }
  }) as typeof credentials.api.findUnique
  const users = new Map<string, FakeUser>()

  const client = {
    agentAutonomyPolicy: autonomy.api,
    agentApprovalRequest: requests.api,
    agentApprovalDecision: decisions.api,
    agentTask: tasks.api,
    agentTrigger: triggers.api,
    agentTriggerRun: triggerRuns.api,
    agentConnection: connectionTable.api,
    agentCredential: credentials.api,
    auditLog: auditLogs.api,
    user: {
      findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => project(users.get(where.id) as Row | undefined, select)),
    },
    $transaction: undefined as unknown as (arg: unknown) => Promise<unknown>,
  }

  // Serialized, snapshot/rollback transaction (same semantics as authz-fake-db.ts).
  // Extra maps (e.g. the Phase 6 policy tables of a merged fake) can be
  // registered so a rollback restores them too.
  const allTables: Array<Map<string, unknown>> = [
    autonomy.rows,
    requests.rows,
    decisions.rows,
    tasks.rows,
    triggers.rows,
    triggerRuns.rows,
    connectionTable.rows,
    credentials.rows,
    auditLogs.rows,
  ]
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
    const snap = allTables.map((m) => new Map(m))
    try {
      if (Array.isArray(arg)) {
        const results: unknown[] = []
        for (const p of arg as Promise<unknown>[]) results.push(await p)
        return results
      }
      return await (arg as (tx: unknown) => Promise<unknown>)(txTarget)
    } catch (err) {
      allTables.forEach((m, i) => {
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
    /** Registers more maps for transactional rollback (merged fakes). */
    registerTransactionalTables: (...maps: Array<Map<string, unknown>>) => {
      allTables.push(...maps)
    },
    seedConnection: (row: { id: string; name?: string; status?: string; environment?: string; ownerId?: string; expiresAt?: Date | null; teamId?: string | null }) =>
      connections.set(row.id, {
        name: null,
        provider: "custom",
        externalAgentId: null,
        description: null,
        teamId: null,
        status: "ACTIVE",
        authMethod: "BEARER",
        environment: "development",
        ownerId: "owner_1",
        expiresAt: null,
        lastAuthenticatedAt: null,
        lastSeenAt: null,
        revokedAt: null,
        suspendedAt: null,
        createdById: "admin_1",
        updatedById: null,
        createdAt: createdAtNow(),
        updatedAt: new Date(),
        ...row,
      }),
    /** Mutates a seeded connection (e.g. suspend/revoke between submission and execution). */
    updateConnection: (id: string, patch: Row) => {
      const existing = connections.get(id)
      if (existing) connections.set(id, { ...existing, ...patch })
    },
    seedUser: (user: FakeUser) => users.set(user.id, user),
    _autonomy: autonomy.rows,
    _requests: requests.rows,
    _decisions: decisions.rows,
    _tasks: tasks.rows,
    _triggers: triggers.rows,
    _triggerRuns: triggerRuns.rows,
    _connections: connections,
    _credentials: credentials.rows,
    _auditLogs: auditLogs.rows,
    _users: users,
  }
}
