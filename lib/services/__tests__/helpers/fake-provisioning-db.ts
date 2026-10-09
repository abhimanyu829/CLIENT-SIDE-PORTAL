/**
 * In-memory Prisma fake for the Phase-5 provisioning suite.
 * Implements the delegates the provisioning engine touches; traps prove it
 * never reaches commerce, billing or plan-mapping mutation tables.
 */

import { EntitlementSourceType } from "@prisma/client"

export interface FakeUsSubRow {
  id: string
  userId: string
  status: string
  environment: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodStart: Date
  currentPeriodEnd: Date
  planVersionId: string | null
  razorpaySubscriptionId: string | null
}

export interface FakeVersionItemRow {
  id: string
  itemType: string
  itemRefId: string | null
  itemRefKey: string
  limitValue: number | null
  limitUnit: string | null
  sortOrder: number
}

export interface FakeVersionRow {
  id: string
  status: string
  items: FakeVersionItemRow[]
}

export interface FakeDefRow {
  id: string
  key: string
  isActive: boolean
}

export interface FakeGrantRow {
  id: string
  entitlementDefinitionId: string
  entitlementKey: string
  subjectType: string
  subjectUserId: string | null
  subjectTeamId: string | null
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

export interface FakeProvisioningRow {
  id: string
  subscriptionId: string
  operation: string
  status: string
  dedupeKey: string
  planVersionId: string | null
  periodRef: string | null
  periodStart: Date | null
  periodEnd: Date | null
  grantCount: number
  errorCode: string | null
  errorMessage: string | null
  attemptCount: number
  startedAt: Date | null
  finishedAt: Date | null
}

export interface FakeProvisioningFailures {
  failGrantCreate?: boolean
  failProvisioningCreate?: boolean
  failProvisioningUpdate?: boolean
  failEntitlementRead?: boolean
  failPeriod?: boolean
}

export function createFakeProvisioningDb() {
  let counter = 0
  const nextId = (p: string) => `${p}_${++counter}`

  const subs = new Map<string, FakeUsSubRow>()
  const versions = new Map<string, FakeVersionRow>()
  const defs = new Map<string, FakeDefRow>()
  const grants = new Map<string, FakeGrantRow>()
  const provs = new Map<string, FakeProvisioningRow>()
  const users = new Map<string, { id: string; isBanned: boolean }>()
  const auditLogs: Record<string, unknown>[] = []

  const failures: FakeProvisioningFailures = {}

  function seedUser(id: string, opts: Partial<{ isBanned: boolean }> = {}) {
    users.set(id, { id, isBanned: false, ...opts })
  }
  function seedDef(key: string, isActive = true) {
    defs.set(key, { id: `def_${key}`, key, isActive })
  }
  function seedVersion(
    id: string,
    items: Array<Partial<FakeVersionItemRow> & { itemType: string }>,
    status = "PUBLISHED",
  ) {
    versions.set(id, {
      id,
      status,
      items: items.map((it, i) => ({
        id: `item_${id}_${i}`,
        itemRefId: null,
        itemRefKey: it.itemType.toLowerCase(),
        limitValue: null,
        limitUnit: null,
        sortOrder: i,
        ...it,
      })),
    })
  }
  function seedSubscription(row: Partial<FakeUsSubRow> & { id: string; userId: string }) {
    const now = new Date()
    subs.set(row.id, {
      status: "TRIALING",
      environment: "test",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86400_000),
      planVersionId: "ver_1",
      razorpaySubscriptionId: "sub_test_1",
      ...row,
    })
  }
  function seedGrant(
    row: Partial<FakeGrantRow> & { id: string; entitlementKey: string; subjectUserId: string },
    sourceRef = "usub_1",
  ) {
    const now = new Date()
    grants.set(row.id, {
      entitlementDefinitionId: `def_${row.entitlementKey}`,
      subjectType: "USER",
      subjectTeamId: null,
      sourceType: EntitlementSourceType.SUBSCRIPTION,
      sourceReference: sourceRef,
      scope: "GLOBAL",
      resourceId: null,
      limitValue: null,
      limitUnit: null,
      status: "ACTIVE",
      startsAt: now,
      expiresAt: new Date(now.getTime() + 30 * 86400_000),
      dedupeKey: `dedupe_${row.id}`,
      ...row,
    })
  }

  const userSubscriptionDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const row = subs.get(args.where.id)
      return row ? { ...row } : null
    },
  }

  const planVersionDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const row = versions.get(args.where.id)
      if (!row) return null
      return { ...row, items: [...row.items].map((i) => ({ ...i })) }
    },
  }

  const entitlementDefinitionDelegate = {
    async findUnique(args: { where: { id?: string; key?: string } }) {
      let row: FakeDefRow | undefined
      if (args.where.key) row = defs.get(args.where.key)
      else if (args.where.id) row = [...defs.values()].find((d) => d.id === args.where.id)
      return row ? { ...row } : null
    },
  }

  const entitlementGrantDelegate = {
    async findUnique(args: { where: { id?: string; dedupeKey?: string } }) {
      let row: FakeGrantRow | undefined
      if (args.where.id) row = grants.get(args.where.id)
      else if (args.where.dedupeKey) {
        row = [...grants.values()].find((g) => g.dedupeKey === args.where.dedupeKey)
      }
      return row ? { ...row } : null
    },
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failGrantCreate) throw new Error("simulated DB failure on entitlementGrant.create")
      const dedupeKey = String(args.data.dedupeKey)
      if ([...grants.values()].some((g) => g.dedupeKey === dedupeKey)) {
        throw new Error("Unique constraint failed on the fields: (`dedupeKey`)")
      }
      const now = new Date()
      const row: FakeGrantRow = {
        id: nextId("grant"),
        entitlementDefinitionId: String(args.data.entitlementDefinitionId),
        entitlementKey: String(args.data.entitlementKey),
        subjectType: String(args.data.subjectType),
        subjectUserId: (args.data.subjectUserId as string) ?? null,
        subjectTeamId: (args.data.subjectTeamId as string) ?? null,
        sourceType: String(args.data.sourceType),
        sourceReference: String(args.data.sourceReference),
        scope: String(args.data.scope),
        resourceId: (args.data.resourceId as string) ?? null,
        limitValue: args.data.limitValue !== undefined ? Number(args.data.limitValue) : null,
        limitUnit: (args.data.limitUnit as string) ?? null,
        status: "ACTIVE",
        startsAt: (args.data.startsAt as Date) ?? now,
        expiresAt: (args.data.expiresAt as Date) ?? null,
        dedupeKey,
      }
      grants.set(row.id, row)
      return { ...row }
    },
    async findMany(args?: {
      where?: {
        subjectType?: string
        subjectUserId?: string
        sourceType?: string
        sourceReference?: string
        status?: string
      }
      select?: Record<string, unknown>
    }) {
      if (failures.failEntitlementRead) throw new Error("simulated DB failure on entitlementGrant.findMany")
      let rows = [...grants.values()]
      const w = args?.where ?? {}
      if (w.subjectType) rows = rows.filter((g) => g.subjectType === w.subjectType)
      if (w.subjectUserId) rows = rows.filter((g) => g.subjectUserId === w.subjectUserId)
      if (w.sourceType) rows = rows.filter((g) => g.sourceType === w.sourceType)
      if (w.sourceReference) rows = rows.filter((g) => g.sourceReference === w.sourceReference)
      if (w.status) rows = rows.filter((g) => g.status === w.status)
      return rows.map((r) => ({ ...r }))
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      let count = 0
      for (const row of grants.values()) {
        let match = true
        for (const [k, v] of Object.entries(args.where)) {
          if ((row as unknown as Record<string, unknown>)[k] !== v) match = false
        }
        if (!match) continue
        Object.assign(row, args.data)
        count += 1
      }
      return { count }
    },
  }

  const provisioningDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failProvisioningCreate) throw new Error("simulated DB failure on subscriptionProvisioning.create")
      const dedupeKey = String(args.data.dedupeKey)
      if (provs.has(dedupeKey)) {
        throw new Error("Unique constraint failed on the fields: (`dedupeKey`)")
      }
      provs.set(dedupeKey, {
        id: nextId("prov"),
        subscriptionId: String(args.data.subscriptionId),
        operation: String(args.data.operation),
        status: "PROCESSING",
        dedupeKey,
        planVersionId: (args.data.planVersionId as string) ?? null,
        periodRef: (args.data.periodRef as string) ?? null,
        periodStart: (args.data.periodStart as Date) ?? null,
        periodEnd: (args.data.periodEnd as Date) ?? null,
        grantCount: 0,
        errorCode: null,
        errorMessage: null,
        attemptCount: Number(args.data.attemptCount ?? 0),
        startedAt: (args.data.startedAt as Date) ?? new Date(),
        finishedAt: null,
      })
      return { ...provs.get(dedupeKey)! }
    },
    async findUnique(args: { where: { dedupeKey?: string; id?: string } }) {
      const row = args.where.dedupeKey
        ? provs.get(args.where.dedupeKey)
        : args.where.id
          ? [...provs.values()].find((p) => p.id === args.where.id)
          : undefined
      return row ? { ...row } : null
    },
    async update(args: { where: { dedupeKey: string }; data: Record<string, unknown> }) {
      if (failures.failProvisioningUpdate) throw new Error("simulated DB failure on subscriptionProvisioning.update")
      const row = provs.get(args.where.dedupeKey)
      if (!row) throw new Error("provisioning record not found")
      Object.assign(row, args.data)
      return { ...row }
    },
  }

  const userDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const u = users.get(args.where.id)
      return u ? { ...u } : null
    },
  }

  const trap = (name: string) => ({
    async create() {
      throw new Error(`${name}.create must never be called by provisioning code`)
    },
    async update() {
      throw new Error(`${name}.update must never be called by provisioning code`)
    },
    async delete() {
      throw new Error(`${name}.delete must never be called by provisioning code`)
    },
  })

  const db = {
    userSubscription: userSubscriptionDelegate,
    planVersion: planVersionDelegate,
    entitlementDefinition: entitlementDefinitionDelegate,
    entitlementGrant: entitlementGrantDelegate,
    subscriptionProvisioning: provisioningDelegate,
    user: userDelegate,
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        auditLogs.push(args.data)
        return { ...args.data }
      },
    },
    // Tables provisioning must never mutate.
    order: trap("order"),
    payment: trap("payment"),
    invoice: trap("invoice"),
    subscriptionPlan: trap("subscriptionPlan"),
    planItem: trap("planItem"),
    razorpayPlanMapping: trap("razorpayPlanMapping"),
    subscriptionCharge: trap("subscriptionCharge"),
    webhookEvent: trap("webhookEvent"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(db)
    },
  }

  return {
    db,
    store: { subs, versions, defs, grants, provs, users, auditLogs },
    failures,
    seedUser,
    seedDef,
    seedVersion,
    seedSubscription,
    seedGrant,
  }
}

export type FakeProvisioningDb = ReturnType<typeof createFakeProvisioningDb>
export { EntitlementSourceType }