/**
 * In-memory Prisma fake for the Phase-6 free/trial suite.
 * Traps prove the free/trial engine never mutates commerce, billing or
 * plan-mapping tables.
 */

import { EntitlementSourceType } from "@prisma/client"

export interface FakeUserRow { id: string; isBanned: boolean; isVerified: boolean }
export interface FakePlanRow {
  id: string
  planType: string | null
  status: string
  currentVersionId: string | null
  versions: FakePlanVersionRow[]
}
export interface FakePlanVersionRow {
  id: string
  version: number
  status: string
    items: Array<
      Partial<{
      itemType: string
      itemRefId: string | null
      itemRefKey: string
      limitValue: number | null
      limitUnit: string | null
      }> & { itemType: string }
    >
}
export interface FakeDefRow { id: string; key: string; isActive: boolean }
export interface FakeGrantRow {
  id: string
  entitlementKey: string
  subjectUserId: string | null
  sourceType: string
  sourceReference: string
  scope: string
  resourceId: string | null
  limitValue: number | null
  limitUnit: string | null
  status: string
  startsAt: Date
  expiresAt: Date | null
  dedupeKey: string
}
export interface FakeTrialRow {
  id: string
  userId: string
  planId: string
  planVersionId: string
  trialScopeKey: string
  status: string
  startedAt: Date | null
  expiresAt: Date | null
  convertedAt: Date | null
  cancelledAt: Date | null
  provisioningError: string | null
  environment: string
  metadata: Record<string, unknown>
}
export interface FakeFreeRow {
  id: string
  userId: string
  planId: string
  planVersionId: string
  status: string
  environment: string
  dedupeKey: string
}
export interface FakeFreeTrialFailures {
  failGrantCreate?: boolean
  failTrialCreate?: boolean
  failTrialUpdate?: boolean
  failFreeCreate?: boolean
  failEntitlementRead?: boolean
}

export function createFakeFreeTrialDb() {
  let counter = 0
  const nextId = (p: string) => `${p}_${++counter}`

  const users = new Map<string, FakeUserRow>()
  const plans = new Map<string, FakePlanRow>()
  const defs = new Map<string, FakeDefRow>()
  const grants = new Map<string, FakeGrantRow>()
  const trials = new Map<string, FakeTrialRow>()
  const frees = new Map<string, FakeFreeRow>()
  const usubs: Array<{ id: string; userId: string; planVersionId: string | null; status: string }> = []
  const auditLogs: Record<string, unknown>[] = []

  const failures: FakeFreeTrialFailures = {}

  function seedUser(id: string, opts: Partial<FakeUserRow> = {}) {
    users.set(id, { id, isBanned: false, isVerified: true, ...opts })
  }
  function seedDef(key: string, isActive = true) {
    defs.set(key, { id: `def_${key}`, key, isActive })
  }
  function seedPlan(
    row: Partial<FakePlanRow> & { id: string },
    versions: Array<Partial<FakePlanVersionRow> & { id: string }>,
    opts: Partial<FakePlanRow> = {},
  ) {
    const defaultFreeVersion = { id: `${row.id}_v1`, version: 1, status: "PUBLISHED", items: [] }
    const versionRows = versions.length
      ? versions.map((v, i) => ({
          id: v.id,
          version: v.version ?? i + 1,
          status: v.status ?? "PUBLISHED",
          items: v.items ?? [],
        }))
      : [defaultFreeVersion]
    const currentVersionId = versionRows.find((v) => v.status === "PUBLISHED")?.id ?? null
    plans.set(row.id, {
      planType: "MONTHLY",
      status: "PUBLISHED",
      currentVersionId,
      versions: versionRows,
      ...row,
      ...opts,
    })
  }
  function seedTrial(row: Partial<FakeTrialRow> & { id: string; userId: string; trialScopeKey: string }) {
    const now = new Date()
    trials.set(row.id, {
      planId: "plan_1",
      planVersionId: "plan_1_v1",
      status: "ACTIVE",
      startedAt: now,
      expiresAt: new Date(now.getTime() + 14 * 86400_000),
      convertedAt: null,
      cancelledAt: null,
      provisioningError: null,
      environment: "test",
      metadata: {},
      ...row,
    })
  }
  function seedFree(row: Partial<FakeFreeRow> & { id: string; userId: string; dedupeKey: string }) {
    frees.set(row.id, {
      planId: "plan_free",
      planVersionId: "plan_free_v1",
      status: "ACTIVE",
      environment: "test",
      ...row,
    })
  }
  function seedGrant(
    row: Partial<FakeGrantRow> & { id: string; entitlementKey: string },
    source: { subjectUserId: string; sourceType: string; sourceReference: string },
  ) {
    const now = new Date()
    grants.set(row.id, {
      subjectUserId: source.subjectUserId,
      sourceType: source.sourceType,
      sourceReference: source.sourceReference,
      scope: "GLOBAL",
      resourceId: null,
      limitValue: null,
      limitUnit: null,
      status: "ACTIVE",
      startsAt: now,
      expiresAt: null,
      dedupeKey: `dedupe_${row.id}`,
      ...row,
    })
  }

  const userDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const u = users.get(args.where.id)
      return u ? { ...u } : null
    },
  }

  const subscriptionPlanDelegate = {
    async findUnique(args: { where: { id: string }; include?: unknown }) {
      const row = plans.get(args.where.id)
      if (!row) return null
      return { ...row, versions: row.versions.map((v) => ({ ...v })) }
    },
    async findFirst(args: { where: { planType?: string; status?: string } }) {
      const row = [...plans.values()].find(
        (p) =>
          (!args.where.planType || p.planType === args.where.planType) &&
          (!args.where.status || p.status === args.where.status),
      )
      return row ? { ...row, versions: row.versions.map((v) => ({ ...v })) } : null
    },
  }

  const planVersionDelegate = {
    async findUnique(args: { where: { id: string }; include?: unknown }) {
      for (const p of plans.values()) {
        const v = p.versions.find((x) => x.id === args.where.id)
        if (v) return { ...v, items: v.items.map((i) => ({ ...i })) }
      }
      return null
    },
    async findFirst(args: { where: { planId?: string; status?: string }; orderBy?: unknown }) {
      const plan = plans.get(args.where.planId ?? "")
      if (!plan) return null
      let rows = plan.versions.filter((v) => !args.where.status || v.status === args.where.status)
      rows = [...rows].sort((a, b) => b.version - a.version)
      const v = rows[0]
      return v ? { ...v, items: v.items.map((i) => ({ ...i })) } : null
    },
  }

  const entitlementDefinitionDelegate = {
    async findUnique(args: { where: { key?: string } }) {
      const row = args.where.key ? defs.get(args.where.key) : undefined
      return row ? { ...row } : null
    },
  }

  const entitlementGrantDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failGrantCreate) throw new Error("simulated DB failure on entitlementGrant.create")
      const dedupeKey = String(args.data.dedupeKey)
      if ([...grants.values()].some((g) => g.dedupeKey === dedupeKey)) {
        throw new Error("Unique constraint failed on the fields: (`dedupeKey`)")
      }
      const now = new Date()
      const row: FakeGrantRow = {
        id: nextId("grant"),
        entitlementKey: String(args.data.entitlementKey),
        subjectUserId: (args.data.subjectUserId as string) ?? null,
        sourceType: String(args.data.sourceType),
        sourceReference: String(args.data.sourceReference),
        scope: String(args.data.scope),
        resourceId: (args.data.resourceId as string) ?? null,
        limitValue: args.data.limitValue !== undefined ? Number(args.data.limitValue) : null,
        limitUnit: (args.data.limitUnit as string) ?? null,
        status: "ACTIVE",
        startsAt: (args.data.startsAt as Date) ?? now,
        expiresAt: (args.data.expiresAt as Date | null) ?? null,
        dedupeKey,
      }
      grants.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { id?: string; dedupeKey?: string } }) {
      let row: FakeGrantRow | undefined
      if (args.where.id) row = grants.get(args.where.id)
      else if (args.where.dedupeKey) row = [...grants.values()].find((g) => g.dedupeKey === args.where.dedupeKey)
      return row ? { ...row } : null
    },
    async findFirst(args: { where: Record<string, unknown> }) {
      for (const g of grants.values()) {
        let match = true
        for (const [k, v] of Object.entries(args.where)) {
          if ((g as unknown as Record<string, unknown>)[k] !== v) match = false
        }
        if (match) return { ...g }
      }
      return null
    },
    async findMany(args?: { where?: Record<string, unknown>; select?: unknown }) {
      if (failures.failEntitlementRead) throw new Error("simulated DB failure on entitlementGrant.findMany")
      let rows = [...grants.values()]
      const w = args?.where ?? {}
      for (const [k, v] of Object.entries(w)) {
        rows = rows.filter((g) => (g as unknown as Record<string, unknown>)[k] === v)
      }
      return rows.map((r) => ({ ...r }))
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      let count = 0
      for (const g of grants.values()) {
        let match = true
        for (const [k, v] of Object.entries(args.where)) {
          if ((g as unknown as Record<string, unknown>)[k] !== v) match = false
        }
        if (!match) continue
        Object.assign(g, args.data)
        count += 1
      }
      return { count }
    },
  }

  const trialEnrollmentDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failTrialCreate) throw new Error("simulated DB failure on trialEnrollment.create")
      const scope = String(args.data.trialScopeKey)
      if ([...trials.values()].some((t) => t.trialScopeKey === scope)) {
        throw new Error("Unique constraint failed on the fields: (`trialScopeKey`)")
      }
      const row: FakeTrialRow = {
        id: nextId("trial"),
        userId: String(args.data.userId),
        planId: String(args.data.planId),
        planVersionId: String(args.data.planVersionId),
        trialScopeKey: scope,
        status: String(args.data.status),
        startedAt: (args.data.startedAt as Date) ?? null,
        expiresAt: (args.data.expiresAt as Date) ?? null,
        convertedAt: null,
        cancelledAt: null,
        provisioningError: null,
        environment: String(args.data.environment),
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
      }
      trials.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { id?: string } }) {
      const row = args.where.id ? trials.get(args.where.id) : undefined
      return row ? { ...row } : null
    },
    async findMany(args?: {
      where?: { userId?: string; trialScopeKey?: string; status?: string; expiresAt?: { lte?: Date } }
      orderBy?: unknown
    }) {
      let rows = [...trials.values()]
      const w = args?.where ?? {}
      if (w.userId) rows = rows.filter((t) => t.userId === w.userId)
      if (w.trialScopeKey) rows = rows.filter((t) => t.trialScopeKey === w.trialScopeKey)
      if (w.status) rows = rows.filter((t) => t.status === w.status)
      if (w.expiresAt?.lte) {
        rows = rows.filter((t) => t.expiresAt !== null && t.expiresAt.getTime() <= (w.expiresAt!.lte as Date).getTime())
      }
      return rows.map((r) => ({ ...r }))
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      if (failures.failTrialUpdate) throw new Error("simulated DB failure on trialEnrollment.update")
      const row = trials.get(args.where.id)
      if (!row) throw new Error("trial not found")
      Object.assign(row, args.data)
      return { ...row }
    },
  }

  const freeEnrollmentDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failFreeCreate) throw new Error("simulated DB failure on freeEnrollment.create")
      const dedupeKey = String(args.data.dedupeKey)
      if ([...frees.values()].some((f) => f.dedupeKey === dedupeKey)) {
        throw new Error("Unique constraint failed on the fields: (`dedupeKey`)")
      }
      const row: FakeFreeRow = {
        id: nextId("free"),
        userId: String(args.data.userId),
        planId: String(args.data.planId),
        planVersionId: String(args.data.planVersionId),
        status: "ACTIVE",
        environment: String(args.data.environment),
        dedupeKey,
      }
      frees.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { dedupeKey?: string } }) {
      const row = args.where.dedupeKey
        ? [...frees.values()].find((f) => f.dedupeKey === args.where.dedupeKey)
        : undefined
      return row ? { ...row } : null
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const row = frees.get(args.where.id)
      if (!row) throw new Error("free enrollment not found")
      Object.assign(row, args.data)
      return { ...row }
    },
  }

  const userSubscriptionDelegate = {
    async findFirst(args: { where: Record<string, unknown> }) {
      const w = args.where as { userId?: string; status?: { in?: string[] } | string }
      return (
        usubs.find((s) => {
          if (w.userId && s.userId !== w.userId) return false
          if (typeof w.status === "string" && s.status !== w.status) return false
          if (typeof w.status === "object" && w.status?.in && !w.status.in.includes(s.status)) return false
          return true
        }) ?? null
      )
    },
  }

  const trap = (name: string) => ({
    async create() { throw new Error(`${name}.create must never be called by free/trial code`) },
    async update() { throw new Error(`${name}.update must never be called by free/trial code`) },
    async delete() { throw new Error(`${name}.delete must never be called by free/trial code`) },
  })

  const db = {
    user: userDelegate,
    subscriptionPlan: subscriptionPlanDelegate,
    planVersion: planVersionDelegate,
    entitlementDefinition: entitlementDefinitionDelegate,
    entitlementGrant: entitlementGrantDelegate,
    trialEnrollment: trialEnrollmentDelegate,
    freeEnrollment: freeEnrollmentDelegate,
    userSubscription: userSubscriptionDelegate,
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        auditLogs.push(args.data)
        return { ...args.data }
      },
    },
    order: trap("order"),
    payment: trap("payment"),
    invoice: trap("invoice"),
    razorpayPlanMapping: trap("razorpayPlanMapping"),
    subscriptionCharge: trap("subscriptionCharge"),
    webhookEvent: trap("webhookEvent"),
    subscriptionProvisioning: trap("subscriptionProvisioning"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(db)
    },
  }

  return {
    db,
    store: { users, plans, defs, grants, trials, frees, usubs, auditLogs },
    failures,
    seedUser,
    seedDef,
    seedPlan,
    seedTrial,
    seedFree,
    seedGrant,
  }
}

export type FakeFreeTrialDb = ReturnType<typeof createFakeFreeTrialDb>
export { EntitlementSourceType }
