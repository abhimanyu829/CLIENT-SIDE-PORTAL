/**
 * Shared in-memory Prisma fake for the Phase-1 subscription suite.
 *
 * Implements ONLY the model methods the subscription domain touches.
 * $transaction(fn) runs fn against the same store (mirrors Prisma's
 * interactive-transaction sharing one connection's visibility).
 */

import { SubStatus } from "@prisma/client"

export interface FakeSubscriptionRow {
  id: string
  userId: string
  productId: string
  tierId: string
  status: SubStatus
  source: string | null
  environment: string | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelledAt: Date | null
  cancelAtPeriodEnd: boolean
  stripeSubId: string | null
  razorpaySubId: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface FakeUserRow {
  id: string
  isBanned: boolean
  isVerified: boolean
}

export interface FakeTierRow {
  id: string
  productId: string
  isActive: boolean
}

export interface FakeProductRow {
  id: string
}

export interface FakeEntitlementRow {
  id: string
  userId: string
  productId: string
  subscriptionId: string | null
  orderId: string | null
  status: string
  accessType: string
  quota: Record<string, unknown>
  expiresAt: Date | null
  metadata: Record<string, unknown>
}

export interface FakeAuditRow {
  userId: string
  action: string
  entity: string | null
  entityId: string | null
  beforeJson: unknown
  afterJson: unknown
}

export interface FailurePlan {
  /** Throw on subscription.create Nth call (1-based). */
  failCreateOnCall?: number
  /** Throw on any $transaction invocation. */
  failTransaction?: boolean
  /** Throw on subscription.updateMany Nth call (1-based). */
  failUpdateManyOnCall?: number
}

export function createFakeDb() {
  let idCounter = 0
  const nextId = (prefix: string) => `${prefix}_${++idCounter}`

  const store = {
    users: new Map<string, FakeUserRow>(),
    products: new Map<string, FakeProductRow>(),
    tiers: new Map<string, FakeTierRow>(),
    subscriptions: new Map<string, FakeSubscriptionRow>(),
    entitlements: new Map<string, FakeEntitlementRow>(),
    auditLogs: [] as FakeAuditRow[],
    pricingHistory: [] as Record<string, unknown>[],
  }

  const failures: FailurePlan = {}
  const callCounts = {
    subscriptionCreate: 0,
    subscriptionUpdateMany: 0,
    transaction: 0,
  }

  function seedUser(id: string, opts: Partial<FakeUserRow> = {}) {
    store.users.set(id, { id, isBanned: false, isVerified: true, ...opts })
  }
  function seedProduct(id: string) {
    store.products.set(id, { id })
  }
  function seedTier(id: string, productId: string, isActive = true) {
    store.tiers.set(id, { id, productId, isActive })
  }
  function seedSubscription(id: string, overrides: Partial<FakeSubscriptionRow> = {}) {
    const now = new Date()
    store.subscriptions.set(id, {
      userId: "user_1",
      productId: "prod_1",
      tierId: "tier_1",
      status: SubStatus.ACTIVE,
      source: null,
      environment: null,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86400_000),
      cancelledAt: null,
      cancelAtPeriodEnd: false,
      stripeSubId: null,
      razorpaySubId: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...overrides,
      id,
    })
  }

  function requireRow(id: string): FakeSubscriptionRow {
    const row = store.subscriptions.get(id)
    if (!row) throw new Error(`Record to update not found: Subscription.${id}`)
    return row
  }

  const subscriptionDelegate = {
    async create(args: {
      data: Record<string, unknown>
      select?: Record<string, unknown>
    }) {
      callCounts.subscriptionCreate += 1
      if (failures.failCreateOnCall === callCounts.subscriptionCreate) {
        throw new Error("simulated DB failure on subscription.create")
      }
      const data = args.data
      const id = typeof data.id === "string" ? data.id : nextId("sub")
      if (store.subscriptions.has(id)) {
        throw new Error("Unique constraint failed on Subscription.id")
      }
      const now = new Date()
      const row: FakeSubscriptionRow = {
        id,
        userId: String(data.userId),
        productId: String(data.productId),
        tierId: String(data.tierId),
        status: (data.status as SubStatus) ?? SubStatus.TRIALING,
        source: (data.source as string | null) ?? null,
        environment: (data.environment as string | null) ?? null,
        currentPeriodStart: (data.currentPeriodStart as Date) ?? now,
        currentPeriodEnd: (data.currentPeriodEnd as Date) ?? now,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        stripeSubId: (data.stripeSubId as string | null) ?? null,
        razorpaySubId: (data.razorpaySubId as string | null) ?? null,
        metadata: (data.metadata as Record<string, unknown>) ?? {},
        createdAt: now,
        updatedAt: now,
      }
      store.subscriptions.set(id, row)
      return { ...row }
    },

    async findUnique(args: {
      where: { id?: string; stripeSubId?: string; razorpaySubId?: string }
      select?: Record<string, unknown>
      include?: Record<string, unknown>
    }) {
      let row: FakeSubscriptionRow | undefined
      if (args.where.id) row = store.subscriptions.get(args.where.id)
      else if (args.where.stripeSubId) {
        row = [...store.subscriptions.values()].find((s) => s.stripeSubId === args.where.stripeSubId)
      } else if (args.where.razorpaySubId) {
        row = [...store.subscriptions.values()].find(
          (s) => s.razorpaySubId === args.where.razorpaySubId,
        )
      }
      if (!row) return null
      return this._project(row, args)
    },

    async findUniqueOrThrow(args: {
      where: { id?: string }
      select?: Record<string, unknown>
      include?: Record<string, unknown>
    }) {
      const row = args.where.id ? store.subscriptions.get(args.where.id) : undefined
      if (!row) {
        throw new Error(`No Subscription found for where: ${JSON.stringify(args.where)}`)
      }
      return this._project(row, args)
    },

    async findMany(args: {
      where?: {
        status?: { in?: SubStatus[] }
        currentPeriodEnd?: { lt?: Date }
        userId?: string
      }
      select?: Record<string, unknown>
    }) {
      let rows = [...store.subscriptions.values()]
      const where = args.where ?? {}
      if (where.status?.in) rows = rows.filter((s) => where.status!.in!.includes(s.status))
      if (where.currentPeriodEnd?.lt) {
        rows = rows.filter((s) => s.currentPeriodEnd < where.currentPeriodEnd!.lt!)
      }
      if (where.userId) rows = rows.filter((s) => s.userId === where.userId)
      return rows.map((r) => ({ ...r }))
    },

    async findFirst(args: { where: { userId?: string; tierId?: string; status?: { in?: SubStatus[] } } }) {
      const rows = await this.findMany({ where: args.where })
      return rows[0] ?? null
    },

    async update(args: {
      where: { id: string }
      data: Partial<FakeSubscriptionRow> & Record<string, unknown>
      include?: Record<string, unknown>
    }) {
      const row = requireRow(args.where.id)
      Object.assign(row, args.data, { updatedAt: new Date() })
      return this._project(row, { include: args.include })
    },

    async updateMany(args: {
      where: { id?: string; status?: SubStatus }
      data: Record<string, unknown>
    }) {
      callCounts.subscriptionUpdateMany += 1
      if (failures.failUpdateManyOnCall === callCounts.subscriptionUpdateMany) {
        throw new Error("simulated DB failure on subscription.updateMany")
      }
      let matched = 0
      for (const row of store.subscriptions.values()) {
        if (args.where.id && row.id !== args.where.id) continue
        if (args.where.status && row.status !== args.where.status) continue
        Object.assign(row, args.data, { updatedAt: new Date() })
        matched += 1
      }
      return { count: matched }
    },

    _project(row: FakeSubscriptionRow, args: { select?: unknown; include?: unknown }) {
      const projected: Record<string, unknown> = { ...row }
      if (args.include && typeof args.include === "object" && (args.include as any).tier) {
        projected.tier = { id: row.tierId }
      }
      if (args.include && typeof args.include === "object" && (args.include as any).user) {
        projected.user = { id: row.userId }
      }
      if (args.include && typeof args.include === "object" && (args.include as any).product) {
        projected.product = { id: row.productId }
      }
      return projected
    },
  }

  const customerEntitlementDelegate = {
    async findFirst(args: { where: Record<string, unknown> }) {
      const w = args.where as {
        userId?: string
        productId?: string
        subscriptionId?: string | null
        orderId?: string
        status?: string
      }
      for (const e of store.entitlements.values()) {
        if (w.userId && e.userId !== w.userId) continue
        if (w.productId && e.productId !== w.productId) continue
        if (w.subscriptionId !== undefined && e.subscriptionId !== w.subscriptionId) continue
        if (w.status && e.status !== w.status) continue
        return { ...e }
      }
      return null
    },
    async findMany(args: { where: { orderId?: string; subscriptionId?: unknown } }) {
      const rows = [...store.entitlements.values()]
      const w = args.where
      return rows
        .filter((e) => {
          if (w.orderId && e.orderId !== w.orderId) return false
          if (
            w.subscriptionId &&
            typeof w.subscriptionId === "object" &&
            "not" in (w.subscriptionId as object) &&
            e.subscriptionId === null
          ) {
            return false
          }
          return true
        })
        .map((e) => ({ ...e }))
    },
    async updateMany(args: { where: { orderId?: string; subscriptionId?: string }; data: Record<string, unknown> }) {
      let count = 0
      for (const e of store.entitlements.values()) {
        if (args.where.orderId && e.orderId !== args.where.orderId) continue
        if (args.where.subscriptionId && e.subscriptionId !== args.where.subscriptionId) continue
        Object.assign(e, args.data)
        count += 1
      }
      return { count }
    },
    async create(args: { data: Record<string, unknown> }) {
      const id = nextId("ent")
      const row: FakeEntitlementRow = {
        id,
        userId: String(args.data.userId),
        productId: String(args.data.productId),
        subscriptionId: (args.data.subscriptionId as string | null) ?? null,
        orderId: (args.data.orderId as string | null) ?? null,
        status: String(args.data.status ?? "ACTIVE"),
        accessType: String(args.data.accessType ?? "DOWNLOAD"),
        quota: (args.data.quota as Record<string, unknown>) ?? {},
        expiresAt: (args.data.expiresAt as Date | null) ?? null,
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
      }
      store.entitlements.set(id, row)
      return { ...row }
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const row = store.entitlements.get(args.where.id)
      if (!row) throw new Error("entitlement not found")
      Object.assign(row, args.data)
      return { ...row }
    },
  }

  const auditLogDelegate = {
    async create(args: { data: FakeAuditRow }) {
      store.auditLogs.push(args.data)
      return { ...args.data }
    },
  }

  const pricingHistoryDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      store.pricingHistory.push(args.data)
      return { ...args.data }
    },
  }

  const userDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const u = store.users.get(args.where.id)
      return u ? { ...u } : null
    },
  }

  const productDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const p = store.products.get(args.where.id)
      return p ? { ...p } : null
    },
  }

  const productTierDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const t = store.tiers.get(args.where.id)
      return t ? { ...t } : null
    },
    async findUniqueOrThrow(args: { where: { id: string } }) {
      const t = store.tiers.get(args.where.id)
      if (!t) throw new Error(`No ProductTier found for where: ${JSON.stringify(args.where)}`)
      return { ...t }
    },
  }

  const orderDelegate = {
    async findUnique() {
      return null
    },
    async update() {
      throw new Error("order.update must never be called by subscription domain code")
    },
    async create() {
      throw new Error("order.create must never be called by subscription domain code")
    },
  }

  const paymentDelegate = {
    async create() {
      throw new Error("payment.create must never be called by subscription domain code")
    },
  }

  const db = {
    user: userDelegate,
    product: productDelegate,
    productTier: productTierDelegate,
    subscription: subscriptionDelegate,
    customerEntitlement: customerEntitlementDelegate,
    auditLog: auditLogDelegate,
    pricingHistory: pricingHistoryDelegate,
    order: orderDelegate,
    payment: paymentDelegate,
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      callCounts.transaction += 1
      if (failures.failTransaction) {
        throw new Error("simulated DB failure on $transaction")
      }
      return fn(db)
    },
  }

  return {
    db,
    store,
    failures,
    callCounts,
    seedUser,
    seedProduct,
    seedTier,
    seedSubscription,
    nextId,
  }
}

export type FakeDb = ReturnType<typeof createFakeDb>
