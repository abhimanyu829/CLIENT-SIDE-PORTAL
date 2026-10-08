/**
 * In-memory Prisma fake for the Phase-3 entitlement suite. Implements only the
 * delegates the entitlement engine touches, plus traps that throw if the
 * entitlement engine ever reaches into standalone commerce / plan tables.
 */

import { EntitlementSourceType, EntitlementType, GrantStatus } from "@prisma/client"

export interface FakeDefinitionRow {
  id: string
  key: string
  name: string
  description: string | null
  type: string
  resourceType: string | null
  configuration: Record<string, unknown>
  isActive: boolean
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
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
  resourceType: string | null
  resourceId: string | null
  quantity: number | null
  limitValue: number | null
  limitUnit: string | null
  status: string
  startsAt: Date
  expiresAt: Date | null
  configuration: Record<string, unknown>
  dedupeKey: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface FakeCustomerEntitlementRow {
  id: string
  userId: string
  productId: string | null
  orderId: string | null
  subscriptionId: string | null
  status: string
  quota: Record<string, unknown>
  startsAt: Date
  expiresAt: Date | null
}

export interface FakeEntitlementFailures {
  failDefinitionCreate?: boolean
  failGrantCreate?: boolean
  failGrantUpdateMany?: boolean
  failTransaction?: boolean
  failCustomerEntitlementRead?: boolean
  grantCreateDelayMs?: number
}

export function createFakeEntitlementDb() {
  let counter = 0
  const nextId = (p: string) => `${p}_${++counter}`

  const definitions = new Map<string, FakeDefinitionRow>()
  const grants = new Map<string, FakeGrantRow>()
  const users = new Map<string, { id: string; isBanned: boolean }>()
  const teams = new Map<string, { id: string }>()
  const customerEntitlements = new Map<string, FakeCustomerEntitlementRow>()
  const auditLogs: Record<string, unknown>[] = []

  const failures: FakeEntitlementFailures = {}
  const callCounts = { grantCreate: 0, grantUpdateMany: 0, customerEntitlementRead: 0 }

  function seedUser(id: string, opts: Partial<{ isBanned: boolean }> = {}) {
    users.set(id, { id, isBanned: false, ...opts })
  }
  function seedTeam(id: string) {
    teams.set(id, { id })
  }
  function seedDefinition(
    row: Partial<FakeDefinitionRow> & { id: string; key: string; type: string },
  ) {
    const now = new Date()
    definitions.set(row.id, {
      name: row.key,
      description: null,
      resourceType: null,
      configuration: {},
      isActive: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...row,
    })
  }
  function seedGrant(row: Partial<FakeGrantRow> & { id: string; scheduleKey: string }) {
    const now = new Date()
    const { scheduleKey, ...rest } = row
    grants.set(row.id, {
      entitlementDefinitionId: `def_${scheduleKey}`,
      entitlementKey: scheduleKey,
      subjectType: "USER",
      subjectUserId: "user_1",
      subjectTeamId: null,
      sourceType: EntitlementSourceType.ADMIN_GRANT,
      sourceReference: "seed",
      scope: "OWNER",
      resourceType: null,
      resourceId: null,
      quantity: null,
      limitValue: null,
      limitUnit: null,
      status: GrantStatus.ACTIVE,
      startsAt: now,
      expiresAt: null,
      configuration: {},
      dedupeKey: `dedupe_${row.id}`,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...rest,
    })
  }
  function seedCustomerEntitlement(
    row: Partial<FakeCustomerEntitlementRow> & { id: string; userId: string },
  ) {
    const now = new Date()
    customerEntitlements.set(row.id, {
      productId: "prod_1",
      orderId: null,
      subscriptionId: null,
      status: "ACTIVE",
      quota: {},
      startsAt: now,
      expiresAt: null,
      ...row,
    })
  }

  const definitionDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failDefinitionCreate) throw new Error("simulated DB failure on entitlementDefinition.create")
      const key = String(args.data.key)
      if ([...definitions.values()].some((d) => d.key === key)) {
        throw new Error("Unique constraint failed on the fields: (`key`)")
      }
      const now = new Date()
      const row: FakeDefinitionRow = {
        id: nextId("def"),
        key,
        name: String(args.data.name),
        description: (args.data.description as string) ?? null,
        type: String(args.data.type),
        resourceType: (args.data.resourceType as string) ?? null,
        configuration: (args.data.configuration as Record<string, unknown>) ?? {},
        isActive: (args.data.isActive as boolean) ?? true,
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
        createdAt: now,
        updatedAt: now,
      }
      definitions.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { id?: string; key?: string } }) {
      let row: FakeDefinitionRow | undefined
      if (args.where.id) row = definitions.get(args.where.id)
      else if (args.where.key) row = [...definitions.values()].find((d) => d.key === args.where.key)
      return row ? { ...row } : null
    },
    async findMany(args?: { where?: { type?: string; isActive?: boolean } }) {
      let rows = [...definitions.values()]
      if (args?.where?.type) rows = rows.filter((d) => d.type === args.where!.type)
      if (typeof args?.where?.isActive === "boolean") {
        rows = rows.filter((d) => d.isActive === args.where!.isActive)
      }
      rows.sort((a, b) => a.key.localeCompare(b.key))
      return rows.map((r) => ({ ...r }))
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const row = definitions.get(args.where.id)
      if (!row) throw new Error("definition not found")
      Object.assign(row, args.data, { updatedAt: new Date() })
      return { ...row }
    },
  }

  const grantDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      callCounts.grantCreate += 1
      if (failures.failGrantCreate) throw new Error("simulated DB failure on entitlementGrant.create")
      if (failures.grantCreateDelayMs) {
        await new Promise((r) => setTimeout(r, failures.grantCreateDelayMs))
      }
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
        resourceType: (args.data.resourceType as string) ?? null,
        resourceId: (args.data.resourceId as string) ?? null,
        quantity: (args.data.quantity as number) ?? null,
        limitValue: args.data.limitValue !== undefined ? Number(args.data.limitValue) : null,
        limitUnit: (args.data.limitUnit as string) ?? null,
        status: String(args.data.status),
        startsAt: (args.data.startsAt as Date) ?? now,
        expiresAt: (args.data.expiresAt as Date) ?? null,
        configuration: (args.data.configuration as Record<string, unknown>) ?? {},
        dedupeKey,
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
        createdAt: now,
        updatedAt: now,
      }
      grants.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { id?: string; dedupeKey?: string } }) {
      let row: FakeGrantRow | undefined
      if (args.where.id) row = grants.get(args.where.id)
      else if (args.where.dedupeKey) {
        row = [...grants.values()].find((g) => g.dedupeKey === args.where.dedupeKey)
      }
      return row ? { ...row } : null
    },
    async findMany(args?: {
      where?: {
        subjectType?: string
        subjectUserId?: string
        subjectTeamId?: string
        status?: string
      }
    }) {
      let rows = [...grants.values()]
      const w = args?.where ?? {}
      if (w.subjectType) rows = rows.filter((g) => g.subjectType === w.subjectType)
      if (w.subjectUserId) rows = rows.filter((g) => g.subjectUserId === w.subjectUserId)
      if (w.subjectTeamId) rows = rows.filter((g) => g.subjectTeamId === w.subjectTeamId)
      if (w.status) rows = rows.filter((g) => g.status === w.status)
      return rows.map((r) => ({
        ...r,
        entitlementDefinition: definitions.get(r.entitlementDefinitionId) ?? null,
      }))
    },
    async updateMany(args: { where: { id?: string; status?: string }; data: Record<string, unknown> }) {
      callCounts.grantUpdateMany += 1
      if (failures.failGrantUpdateMany) throw new Error("simulated DB failure on entitlementGrant.updateMany")
      let count = 0
      for (const row of grants.values()) {
        if (args.where.id && row.id !== args.where.id) continue
        if (args.where.status && row.status !== args.where.status) continue
        Object.assign(row, args.data, { updatedAt: new Date() })
        count += 1
      }
      return { count }
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const row = grants.get(args.where.id)
      if (!row) throw new Error("grant not found")
      Object.assign(row, args.data, { updatedAt: new Date() })
      return { ...row }
    },
  }

  const customerEntitlementDelegate = {
    async findMany(args: { where: { userId?: string; status?: string } }) {
      callCounts.customerEntitlementRead += 1
      if (failures.failCustomerEntitlementRead) {
        throw new Error("simulated DB failure on customerEntitlement.findMany")
      }
      const now = new Date()
      let rows = [...customerEntitlements.values()]
      if (args.where.userId) rows = rows.filter((r) => r.userId === args.where.userId)
      if (args.where.status) rows = rows.filter((r) => r.status === args.where.status)
      rows = rows.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now.getTime())
      return rows.map((r) => ({ ...r }))
    },
  }

  const trap = (name: string) => ({
    async create() {
      throw new Error(`${name}.create must never be called by entitlement code`)
    },
    async update() {
      throw new Error(`${name}.update must never be called by entitlement code`)
    },
    async delete() {
      throw new Error(`${name}.delete must never be called by entitlement code`)
    },
  })

  const db = {
    entitlementDefinition: definitionDelegate,
    entitlementGrant: grantDelegate,
    customerEntitlement: customerEntitlementDelegate,
    user: {
      async findUnique(args: { where: { id: string } }) {
        const u = users.get(args.where.id)
        return u ? { ...u } : null
      },
    },
    team: {
      async findUnique(args: { where: { id: string } }) {
        const t = teams.get(args.where.id)
        return t ? { ...t } : null
      },
    },
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        auditLogs.push(args.data)
        return { ...args.data }
      },
    },
    // Commerce / plan tables the entitlement engine must never touch.
    order: trap("order"),
    payment: trap("payment"),
    cart: trap("cart"),
    invoice: trap("invoice"),
    product: trap("product"),
    subscriptionPlan: trap("subscriptionPlan"),
    planVersion: trap("planVersion"),
    planItem: trap("planItem"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      if (failures.failTransaction) throw new Error("simulated DB failure on $transaction")
      return fn(db)
    },
  }

  return {
    db,
    store: { definitions, grants, users, teams, customerEntitlements, auditLogs },
    failures,
    callCounts,
    seedUser,
    seedTeam,
    seedDefinition,
    seedGrant,
    seedCustomerEntitlement,
  }
}

export type FakeEntitlementDb = ReturnType<typeof createFakeEntitlementDb>
export { EntitlementType, EntitlementSourceType, GrantStatus }
