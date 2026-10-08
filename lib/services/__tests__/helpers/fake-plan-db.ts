/**
 * In-memory Prisma fake for the Phase-2 plan catalog suite.
 * Implements only the delegates the catalog touches, plus trap methods that
 * throw if the catalog ever reaches into standalone commerce tables.
 */

import { PlanItemType, PlanStatus, PlanVersionStatus } from "@prisma/client"

export interface FakePlanRow {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  planType: string | null
  currency: string
  price: number
  billingIntervalMonths: number | null
  durationMonths: number | null
  status: string
  currentVersionId: string | null
  catalogRevision: number
  sortOrder: number
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface FakeVersionRow {
  id: string
  planId: string
  version: number
  status: string
  price: number | null
  currency: string | null
  billingIntervalMonths: number | null
  durationMonths: number | null
  notes: string | null
  createdBy: string | null
  publishedAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FakeItemRow {
  id: string
  planVersionId: string
  itemType: string
  itemRefKey: string
  itemRefId: string | null
  label: string | null
  quantity: number | null
  limitValue: number | null
  limitUnit: string | null
  config: Record<string, unknown>
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface FakeFailurePlan {
  failPlanCreate?: boolean
  failVersionCreate?: boolean
  failItemCreate?: boolean
  failTransaction?: boolean
  failPlanUpdateManyOnCall?: number
  failVersionUpdateManyOnCall?: number
}

export function createFakePlanDb() {
  let counter = 0
  const nextId = (prefix: string) => `${prefix}_${++counter}`

  const plans = new Map<string, FakePlanRow>()
  const versions = new Map<string, FakeVersionRow>()
  const items = new Map<string, FakeItemRow>()
  const products = new Map<string, { id: string }>()
  const services = new Map<string, { id: string }>()
  const agents = new Map<string, { id: string }>()
  const auditLogs: Record<string, unknown>[] = []

  const failures: FakeFailurePlan = {}
  const callCounts = {
    planUpdateMany: 0,
    versionUpdateMany: 0,
  }

  // ── seeds ──────────────────────────────────────────────────────────────────
  function seedProduct(id: string) {
    products.set(id, { id })
  }
  function seedService(id: string) {
    services.set(id, { id })
  }
  function seedAgent(id: string) {
    agents.set(id, { id })
  }
  function seedPlan(row: Partial<FakePlanRow> & { id: string; slug: string; name: string }) {
    const now = new Date()
    plans.set(row.id, {
      tagline: null,
      description: null,
      planType: "MONTHLY",
      currency: "INR",
      price: 0,
      billingIntervalMonths: 1,
      durationMonths: 1,
      status: PlanStatus.PUBLISHED,
      currentVersionId: null,
      catalogRevision: 0,
      sortOrder: 0,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...row,
    })
  }
  function seedVersion(
    row: Partial<FakeVersionRow> & { id: string; planId: string; version: number },
  ) {
    const now = new Date()
    versions.set(row.id, {
      status: PlanVersionStatus.DRAFT,
      price: 0,
      currency: "INR",
      billingIntervalMonths: null,
      durationMonths: null,
      notes: null,
      createdBy: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      ...row,
    })
  }
  function seedItem(
    row: Partial<FakeItemRow> & { id: string; planVersionId: string; itemType: string },
  ) {
    const now = new Date()
    items.set(row.id, {
      itemRefKey: row.itemType.toLowerCase(),
      itemRefId: null,
      label: null,
      quantity: 1,
      limitValue: null,
      limitUnit: null,
      config: {},
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      ...row,
    })
  }

  // ── delegates ──────────────────────────────────────────────────────────────
  const applySelect = (row: object, select?: Record<string, unknown>) => {
    const record = row as Record<string, unknown>
    if (!select) return { ...record }
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(select)) {
      if (select[key]) out[key] = record[key]
    }
    return out
  }

  const planDelegate = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, unknown> }) {
      if (failures.failPlanCreate) throw new Error("simulated DB failure on subscriptionPlan.create")
      const slug = String(args.data.slug)
      if ([...plans.values()].some((p) => p.slug === slug)) {
        throw new Error(`Unique constraint failed on the fields: (\`slug\`)`)
      }
      const now = new Date()
      const row: FakePlanRow = {
        id: (args.data.id as string) ?? nextId("plan"),
        slug,
        name: String(args.data.name),
        tagline: (args.data.tagline as string) ?? null,
        description: (args.data.description as string) ?? null,
        planType: (args.data.planType as string) ?? null,
        currency: String(args.data.currency ?? "USD"),
        price: Number(args.data.price ?? 0),
        billingIntervalMonths: (args.data.billingIntervalMonths as number) ?? null,
        durationMonths: (args.data.durationMonths as number) ?? null,
        status: (args.data.status as string) ?? PlanStatus.DRAFT,
        currentVersionId: null,
        catalogRevision: 0,
        sortOrder: Number(args.data.sortOrder ?? 0),
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
        createdAt: now,
        updatedAt: now,
      }
      plans.set(row.id, row)
      return applySelect(row, args.select)
    },
    async findUnique(args: { where: { id?: string; slug?: string }; select?: Record<string, unknown> }) {
      let row: FakePlanRow | undefined
      if (args.where.id) row = plans.get(args.where.id)
      else if (args.where.slug) row = [...plans.values()].find((p) => p.slug === args.where.slug)
      if (!row) return null
      const projected = applySelect(row, args.select)
      const include = (args as {
        include?: { versions?: { orderBy?: { version?: "desc" | "asc" }; take?: number; include?: { items?: unknown } } }
      }).include
      if (include?.versions) {
        const opts = include.versions
        let vs = [...versions.values()].filter((v) => v.planId === row.id)
        if (opts.orderBy?.version === "desc") vs.sort((a, b) => b.version - a.version)
        else if (opts.orderBy?.version === "asc") vs.sort((a, b) => a.version - b.version)
        if (typeof opts.take === "number") vs = vs.slice(0, opts.take)
        projected.versions = vs.map((v) =>
          opts.include?.items
            ? {
                ...v,
                items: [...items.values()]
                  .filter((i) => i.planVersionId === v.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder),
              }
            : { ...v },
        )
      }
      return projected
    },
    async findMany(args?: {
      where?: { status?: string; planType?: string }
      orderBy?: Array<Record<string, unknown>> | Record<string, unknown>
      include?: { versions?: { orderBy?: { version?: "desc" | "asc" }; include?: { items?: unknown } } }
    }) {
      let rows = [...plans.values()]
      const where = args?.where ?? {}
      if (where.status) rows = rows.filter((p) => p.status === where.status)
      if (where.planType) rows = rows.filter((p) => p.planType === where.planType)
      rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      return rows.map((r) => {
        const projected: Record<string, unknown> = { ...r }
        const include = args?.include
        if (include?.versions) {
          let vs = [...versions.values()].filter((v) => v.planId === r.id)
          if (include.versions.orderBy?.version === "desc") vs.sort((a, b) => b.version - a.version)
          projected.versions = vs.map((v) =>
            include.versions?.include?.items
              ? { ...v, items: [...items.values()].filter((i) => i.planVersionId === v.id) }
              : { ...v },
          )
        }
        return projected
      })
    },
    async update(args: {
      where: { id: string }
      data: Record<string, unknown>
      select?: Record<string, unknown>
    }) {
      const row = plans.get(args.where.id)
      if (!row) throw new Error(`No SubscriptionPlan found for where: ${JSON.stringify(args.where)}`)
      const data = { ...args.data }
      if (data.catalogRevision && typeof data.catalogRevision === "object") {
        data.catalogRevision = row.catalogRevision + 1
      }
      Object.assign(row, data, { updatedAt: new Date() })
      return applySelect(row, args.select)
    },
    async updateMany(args: { where: { id?: string; status?: string }; data: Record<string, unknown> }) {
      callCounts.planUpdateMany += 1
      if (failures.failPlanUpdateManyOnCall === callCounts.planUpdateMany) {
        throw new Error("simulated DB failure on subscriptionPlan.updateMany")
      }
      let count = 0
      for (const row of plans.values()) {
        if (args.where.id && row.id !== args.where.id) continue
        if (args.where.status && row.status !== args.where.status) continue
        const data = { ...args.data }
        if (data.catalogRevision && typeof data.catalogRevision === "object") {
          data.catalogRevision = row.catalogRevision + 1
        }
        Object.assign(row, data, { updatedAt: new Date() })
        count += 1
      }
      return { count }
    },
    async delete(args: { where: { id: string } }) {
      plans.delete(args.where.id)
      return {}
    },
  }

  const versionDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failVersionCreate) throw new Error("simulated DB failure on planVersion.create")
      const planId = String(args.data.planId)
      const version = Number(args.data.version)
      if ([...versions.values()].some((v) => v.planId === planId && v.version === version)) {
        throw new Error(`Unique constraint failed on the fields: (\`planId\`,\`version\`)`)
      }
      const now = new Date()
      const row: FakeVersionRow = {
        id: (args.data.id as string) ?? nextId("pver"),
        planId,
        version,
        status: (args.data.status as string) ?? PlanVersionStatus.DRAFT,
        price: args.data.price !== undefined ? Number(args.data.price) : null,
        currency: (args.data.currency as string) ?? null,
        billingIntervalMonths: (args.data.billingIntervalMonths as number) ?? null,
        durationMonths: (args.data.durationMonths as number) ?? null,
        notes: (args.data.notes as string) ?? null,
        createdBy: (args.data.createdBy as string) ?? null,
        publishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      versions.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { id?: string }; select?: Record<string, unknown> }) {
      const row = args.where.id ? versions.get(args.where.id) : undefined
      if (!row) return null
      const projected: Record<string, unknown> = { ...row }
      if ((args as { include?: { items?: unknown; plan?: unknown } }).include?.items) {
        projected.items = [...items.values()].filter((i) => i.planVersionId === row.id)
      }
      if ((args as { include?: { plan?: { select?: Record<string, unknown> } } }).include?.plan) {
        const plan = plans.get(row.planId)
        projected.plan = plan
          ? applySelect(plan, (args as any).include.plan.select)
          : null
      }
      return projected
    },
    async findFirst(args: {
      where: { planId?: string; status?: string; id?: { not?: string } }
      orderBy?: { version?: "desc" | "asc" }
      include?: { items?: unknown; plan?: unknown }
    }) {
      let rows = [...versions.values()]
      if (args.where.planId) rows = rows.filter((v) => v.planId === args.where.planId)
      if (args.where.status) rows = rows.filter((v) => v.status === args.where.status)
      if (args.where.id && typeof args.where.id === "object" && args.where.id.not) {
        rows = rows.filter((v) => v.id !== args.where.id!.not)
      }
      if (args.orderBy?.version === "desc") rows.sort((a, b) => b.version - a.version)
      else if (args.orderBy?.version === "asc") rows.sort((a, b) => a.version - b.version)
      const row = rows[0]
      if (!row) return null
      const projected: Record<string, unknown> = { ...row }
      if (args.include?.items) {
        projected.items = [...items.values()].filter((i) => i.planVersionId === row.id)
      }
      if (args.include?.plan) {
        const plan = plans.get(row.planId)
        const planSelect = (args.include.plan as { select?: Record<string, unknown> }).select
        projected.plan = plan ? applySelect(plan, planSelect) : null
      }
      return projected
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const row = versions.get(args.where.id)
      if (!row) throw new Error(`No PlanVersion found for where: ${JSON.stringify(args.where)}`)
      Object.assign(row, args.data, { updatedAt: new Date() })
      return { ...row }
    },
    async updateMany(args: {
      where: { id?: string | { not: string }; planId?: string; status?: string }
      data: Record<string, unknown>
    }) {
      callCounts.versionUpdateMany += 1
      if (failures.failVersionUpdateManyOnCall === callCounts.versionUpdateMany) {
        throw new Error("simulated DB failure on planVersion.updateMany")
      }
      let count = 0
      for (const row of versions.values()) {
        if (args.where.id) {
          if (typeof args.where.id === "string" && row.id !== args.where.id) continue
          if (
            typeof args.where.id === "object" &&
            "not" in (args.where.id as object) &&
            row.id === (args.where.id as { not: string }).not
          ) {
            continue
          }
        }
        if (args.where.planId && row.planId !== args.where.planId) continue
        if (args.where.status && row.status !== args.where.status) continue
        Object.assign(row, args.data, { updatedAt: new Date() })
        count += 1
      }
      return { count }
    },
  }

  const itemDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failItemCreate) throw new Error("simulated DB failure on planItem.create")
      const versionId = String(args.data.planVersionId)
      const itemType = String(args.data.itemType)
      const itemRefKey = String(args.data.itemRefKey)
      if (
        [...items.values()].some(
          (i) => i.planVersionId === versionId && i.itemType === itemType && i.itemRefKey === itemRefKey,
        )
      ) {
        throw new Error(`Unique constraint failed on the fields: (\`planVersionId\`,\`itemType\`,\`itemRefKey\`)`)
      }
      const now = new Date()
      const row: FakeItemRow = {
        id: (args.data.id as string) ?? nextId("pitem"),
        planVersionId: versionId,
        itemType,
        itemRefKey,
        itemRefId: (args.data.itemRefId as string) ?? null,
        label: (args.data.label as string) ?? null,
        quantity: (args.data.quantity as number) ?? 1,
        limitValue: args.data.limitValue !== undefined ? Number(args.data.limitValue) : null,
        limitUnit: (args.data.limitUnit as string) ?? null,
        config: (args.data.config as Record<string, unknown>) ?? {},
        sortOrder: Number(args.data.sortOrder ?? 0),
        createdAt: now,
        updatedAt: now,
      }
      items.set(row.id, row)
      return { ...row }
    },
    async findFirst(args: { where: { planVersionId?: string; itemType?: string; itemRefKey?: string } }) {
      for (const i of items.values()) {
        if (args.where.planVersionId && i.planVersionId !== args.where.planVersionId) continue
        if (args.where.itemType && i.itemType !== args.where.itemType) continue
        if (args.where.itemRefKey && i.itemRefKey !== args.where.itemRefKey) continue
        return { ...i }
      }
      return null
    },
    async findUnique(args: { where: { id: string } }) {
      const row = items.get(args.where.id)
      if (!row) return null
      const projected: Record<string, unknown> = { ...row }
      if ((args as { include?: { planVersion?: unknown } }).include?.planVersion) {
        projected.planVersion = versions.get(row.planVersionId) ?? null
      }
      return projected
    },
    async delete(args: { where: { id: string } }) {
      items.delete(args.where.id)
      return {}
    },
    async findMany() {
      return [...items.values()].map((r) => ({ ...r }))
    },
  }

  const referenceDelegate = (map: Map<string, { id: string }>) => ({
    async findUnique(args: { where: { id: string }; select?: Record<string, unknown> }) {
      const row = map.get(args.where.id)
      return row ? applySelect(row, args.select) : null
    },
  })

  // Commerce traps: catalog code must never touch standalone purchase tables.
  const trap = (name: string) => ({
    async create() {
      throw new Error(`${name}.create must never be called by plan catalog code`)
    },
    async update() {
      throw new Error(`${name}.update must never be called by plan catalog code`)
    },
    async delete() {
      throw new Error(`${name}.delete must never be called by plan catalog code`)
    },
  })

  const db = {
    subscriptionPlan: planDelegate,
    planVersion: versionDelegate,
    planItem: itemDelegate,
    product: referenceDelegate(products),
    servicePage: referenceDelegate(services),
    aIAgent: referenceDelegate(agents),
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        auditLogs.push(args.data)
        return { ...args.data }
      },
    },
    order: trap("order"),
    payment: trap("payment"),
    cart: trap("cart"),
    invoice: trap("invoice"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      if (failures.failTransaction) throw new Error("simulated DB failure on $transaction")
      return fn(db)
    },
  }

  return {
    db,
    store: { plans, versions, items, products, services, agents, auditLogs },
    failures,
    callCounts,
    seedProduct,
    seedService,
    seedAgent,
    seedPlan,
    seedVersion,
    seedItem,
  }
}

export type FakePlanDb = ReturnType<typeof createFakePlanDb>
export { PlanItemType, PlanStatus, PlanVersionStatus }
