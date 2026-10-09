/**
 * In-memory Prisma fake for the Phase-4 Razorpay recurring suite.
 * Implements only the delegates the billing engine touches. Traps throw if
 * billing code ever reaches standalone commerce / plan-catalog mutations.
 */

import { PlanMappingStatus, SubscriptionStatus } from "@prisma/client"

export interface FakePlanRow {
  id: string
  status: string
  planType: string | null
  currency: string
  durationMonths: number | null
  billingIntervalMonths: number | null
}

export interface FakePlanVersionRow {
  id: string
  version: number
  status: string
  price: number | null
  durationMonths: number | null
  billingIntervalMonths: number | null
  plan: FakePlanRow
}

export interface FakeMappingRow {
  id: string
  planVersionId: string
  environment: string
  provider: string
  razorpayPlanId: string
  currency: string
  amountSubunits: number
  billingPeriod: string
  billingInterval: number
  totalCount: number | null
  mappingStatus: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface FakeUserSubscriptionRow {
  id: string
  subscriptionNumber: string
  userId: string
  planId: string
  planVersionId: string | null
  environment: string | null
  status: string
  billingCycle: string
  quantity: number
  unitPrice: number
  totalAmount: number
  currency: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  autoRenew: boolean
  razorpaySubscriptionId: string | null
  metadata: Record<string, unknown>
  canceledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FakeWebhookRow {
  id: string
  source: string
  eventType: string
  eventId: string
  payload: Record<string, unknown>
  status: string
  processedAt: Date | null
  errorMessage: string | null
}

export interface FakeChargeRow {
  id: string
  subscriptionId: string
  razorpaySubscriptionId: string
  razorpayPaymentId: string | null
  razorpayInvoiceId: string | null
  amountSubunits: number
  currency: string
  chargeStatus: string
  providerEventId: string | null
  billingPeriodStart: Date | null
  billingPeriodEnd: Date | null
}

export interface FakeRzpFailures {
  noProviderClient?: boolean
  providerThrow?: "timeout" | "4xx" | "5xx"
  failMappingPersistence?: boolean
  failInternalCreate?: boolean
  failReferencePersist?: boolean
  failWebhookPersist?: boolean
  failWebhookUpdate?: boolean
  failChargeCreate?: boolean
}

export function createFakeRzpDb() {
  let counter = 0
  const nextId = (p: string) => `${p}_${++counter}`

  const plans = new Map<string, FakePlanRow>()
  const versions = new Map<string, FakePlanVersionRow>()
  const mappings = new Map<string, FakeMappingRow>()
  const subscriptions = new Map<string, FakeUserSubscriptionRow>()
  const webhooks = new Map<string, FakeWebhookRow>()
  const charges = new Map<string, FakeChargeRow>()
  const auditLogs: Record<string, unknown>[] = []

  const failures: FakeRzpFailures = {}

  function seedPlan(
    row: Partial<FakePlanRow> & { id: string },
    opts: Partial<FakePlanRow> = {},
  ) {
    plans.set(row.id, {
      status: "PUBLISHED",
      planType: "MONTHLY",
      currency: "INR",
      durationMonths: null,
      billingIntervalMonths: 1,
      ...row,
      ...opts,
    })
  }
  function seedVersion(
    row: Partial<FakePlanVersionRow> & { id: string; planId: string },
    overrides: Partial<FakePlanVersionRow> = {},
  ) {
    const planId = row.planId
    const plan = plans.get(planId)
    if (!plan) throw new Error(`seedVersion: plan ${planId} not seeded`)
    versions.set(row.id, {
      version: 1,
      status: "PUBLISHED",
      price: 999,
      durationMonths: null,
      billingIntervalMonths: 1,
      plan,
      ...row,
      ...overrides,
    })
  }
  function seedMapping(
    row: Partial<FakeMappingRow> & { id: string; planVersionId: string },
  ) {
    const now = new Date()
    mappings.set(row.id, {
      environment: "test",
      provider: "RAZORPAY",
      razorpayPlanId: `plan_test_${row.id}`,
      currency: "INR",
      amountSubunits: 99900,
      billingPeriod: "monthly",
      billingInterval: 1,
      totalCount: null,
      mappingStatus: PlanMappingStatus.ACTIVE,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...row,
    })
  }
  function seedSubscription(
    row: Partial<FakeUserSubscriptionRow> & { id: string; userId: string },
  ) {
    const now = new Date()
    const { userId, ...rest } = row
    const base: FakeUserSubscriptionRow = {
      id: row.id,
      subscriptionNumber: `RZP-${row.id}`,
      userId,
      planId: "plan_1",
      planVersionId: "ver_1",
      environment: "test",
      status: SubscriptionStatus.TRIALING,
      billingCycle: "MONTHLY",
      quantity: 1,
      unitPrice: 999,
      totalAmount: 999,
      currency: "INR",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86400_000),
      cancelAtPeriodEnd: false,
      autoRenew: true,
      razorpaySubscriptionId: null,
      metadata: {},
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    }
    subscriptions.set(row.id, { ...base, ...rest })
  }
  function seedWebhook(row: { eventId: string; eventType: string; status: string }) {
    webhooks.set(row.eventId, {
      id: nextId("wh"),
      source: "RAZORPAY",
      eventType: row.eventType,
      eventId: row.eventId,
      payload: {},
      status: row.status,
      processedAt: row.status === "PROCESSED" ? new Date() : null,
      errorMessage: null,
    })
  }

  const planVersionDelegate = {
    async findUnique(args: { where: { id: string } }) {
      const v = versions.get(args.where.id)
      if (!v) return null
      return { ...v, plan: { ...v.plan } }
    },
  }

  const razorpayPlanMappingDelegate = {
    async findUnique(args: { where: Record<string, unknown> }) {
      const w = args.where as { planVersionId_environment?: { planVersionId: string; environment: string }; id?: string; razorpayPlanId?: string }
      if (w.planVersionId_environment) {
        const row = [...mappings.values()].find(
          (m) => m.planVersionId === w.planVersionId_environment!.planVersionId && m.environment === w.planVersionId_environment!.environment,
        )
        return row ? { ...row } : null
      }
      if (w.id) {
        const row = mappings.get(w.id)
        return row ? { ...row } : null
      }
      if (w.razorpayPlanId) {
        const row = [...mappings.values()].find((m) => m.razorpayPlanId === w.razorpayPlanId)
        return row ? { ...row } : null
      }
      return null
    },
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failMappingPersistence) throw new Error("simulated persistence failure on razorpayPlanMapping.create")
      const now = new Date()
      const row: FakeMappingRow = {
        id: nextId("map"),
        planVersionId: String(args.data.planVersionId),
        environment: String(args.data.environment),
        provider: String(args.data.provider),
        razorpayPlanId: String(args.data.razorpayPlanId),
        currency: String(args.data.currency),
        amountSubunits: Number(args.data.amountSubunits),
        billingPeriod: String(args.data.billingPeriod),
        billingInterval: Number(args.data.billingInterval),
        totalCount: (args.data.totalCount as number | null) ?? null,
        mappingStatus: String(args.data.mappingStatus),
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
        createdAt: now,
        updatedAt: now,
      }
      mappings.set(row.id, row)
      return { ...row }
    },
  }

  const userSubscriptionDelegate = {
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failInternalCreate) throw new Error("simulated DB failure on userSubscription.create")
      const now = new Date()
      const row: FakeUserSubscriptionRow = {
        id: nextId("usub"),
        subscriptionNumber: String(args.data.subscriptionNumber),
        userId: String(args.data.userId),
        planId: String(args.data.planId),
        planVersionId: (args.data.planVersionId as string) ?? null,
        environment: (args.data.environment as string) ?? null,
        status: String(args.data.status),
        billingCycle: String(args.data.billingCycle),
        quantity: Number(args.data.quantity ?? 1),
        unitPrice: Number(args.data.unitPrice ?? 0),
        totalAmount: Number(args.data.totalAmount ?? 0),
        currency: String(args.data.currency ?? "INR"),
        currentPeriodStart: (args.data.currentPeriodStart as Date) ?? now,
        currentPeriodEnd: (args.data.currentPeriodEnd as Date) ?? now,
        cancelAtPeriodEnd: Boolean(args.data.cancelAtPeriodEnd ?? false),
        autoRenew: Boolean(args.data.autoRenew ?? true),
        razorpaySubscriptionId: (args.data.razorpaySubscriptionId as string) ?? null,
        metadata: (args.data.metadata as Record<string, unknown>) ?? {},
        canceledAt: null,
        createdAt: now,
        updatedAt: now,
      }
      subscriptions.set(row.id, row)
      return { ...row }
    },
    async findUnique(args: { where: { id?: string; razorpaySubscriptionId?: string } }) {
      let row: FakeUserSubscriptionRow | undefined
      if (args.where.id) row = subscriptions.get(args.where.id)
      else if (args.where.razorpaySubscriptionId) {
        row = [...subscriptions.values()].find((s) => s.razorpaySubscriptionId === args.where.razorpaySubscriptionId)
      } else if (args.where.razorpaySubscriptionId === null) {
        row = [...subscriptions.values()].find((s) => s.razorpaySubscriptionId === null)
      }
      return row ? { ...row } : null
    },
    async findFirst(args: { where: Record<string, unknown> }) {
      const w = args.where as {
        userId?: string
        planVersionId?: string
        razorpaySubscriptionId?: { not: null } | null | string
        status?: { in?: string[] }
      }
      for (const s of subscriptions.values()) {
        if (w.userId && s.userId !== w.userId) continue
        if (w.planVersionId && s.planVersionId !== w.planVersionId) continue
        if (w.razorpaySubscriptionId) {
          if (typeof w.razorpaySubscriptionId === "object" && "not" in w.razorpaySubscriptionId && s.razorpaySubscriptionId === null) continue
          if (typeof w.razorpaySubscriptionId === "string" && s.razorpaySubscriptionId !== w.razorpaySubscriptionId) continue
        }
        if (w.status?.in && !w.status.in.includes(s.status)) continue
        return { ...s }
      }
      return null
    },
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      if (failures.failReferencePersist && args.data.razorpaySubscriptionId) {
        throw new Error("simulated DB failure persisting razorpay subscription reference")
      }
      const row = subscriptions.get(args.where.id)
      if (!row) throw new Error(`No UserSubscription found for where: ${JSON.stringify(args.where)}`)
      const data = { ...args.data }
      if (data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)) {
        data.metadata = { ...row.metadata, ...(data.metadata as Record<string, unknown>) }
      }
      Object.assign(row, data, { updatedAt: new Date() })
      return { ...row }
    },
  }

  const webhookEventDelegate = {
    async findUnique(args: { where: { eventId?: string; id?: string } }) {
      const row = args.where.eventId ? webhooks.get(args.where.eventId) : undefined
      return row ? { ...row } : null
    },
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failWebhookPersist) throw new Error("simulated DB failure on webhookEvent.create")
      const eventId = String(args.data.eventId)
      if (webhooks.has(eventId)) {
        throw new Error("Unique constraint failed on the fields: (`eventId`)")
      }
      const row: FakeWebhookRow = {
        id: nextId("wh"),
        source: String(args.data.source),
        eventType: String(args.data.eventType),
        eventId,
        payload: (args.data.payload as Record<string, unknown>) ?? {},
        status: "PENDING",
        processedAt: null,
        errorMessage: null,
      }
      webhooks.set(eventId, row)
      return { ...row }
    },
    async update(args: { where: { eventId: string }; data: Record<string, unknown> }) {
      if (failures.failWebhookUpdate) throw new Error("simulated DB failure on webhookEvent.update")
      const row = webhooks.get(args.where.eventId)
      if (!row) throw new Error("webhook event not found")
      Object.assign(row, args.data)
      return { ...row }
    },
  }

  const subscriptionChargeDelegate = {
    async findUnique(args: { where: { razorpayPaymentId?: string } }) {
      const row = args.where.razorpayPaymentId
        ? [...charges.values()].find((c) => c.razorpayPaymentId === args.where.razorpayPaymentId)
        : undefined
      return row ? { ...row } : null
    },
    async create(args: { data: Record<string, unknown> }) {
      if (failures.failChargeCreate) throw new Error("simulated DB failure on subscriptionCharge.create")
      const row: FakeChargeRow = {
        id: nextId("chg"),
        subscriptionId: String(args.data.subscriptionId),
        razorpaySubscriptionId: String(args.data.razorpaySubscriptionId),
        razorpayPaymentId: (args.data.razorpayPaymentId as string) ?? null,
        razorpayInvoiceId: (args.data.razorpayInvoiceId as string) ?? null,
        amountSubunits: Number(args.data.amountSubunits),
        currency: String(args.data.currency),
        chargeStatus: String(args.data.chargeStatus),
        providerEventId: (args.data.providerEventId as string) ?? null,
        billingPeriodStart: (args.data.billingPeriodStart as Date) ?? null,
        billingPeriodEnd: (args.data.billingPeriodEnd as Date) ?? null,
      }
      charges.set(row.id, row)
      return { ...row }
    },
  }

  const trap = (name: string) => ({
    async create() {
      throw new Error(`${name}.create must never be called by billing code`)
    },
    async update() {
      throw new Error(`${name}.update must never be called by billing code`)
    },
    async delete() {
      throw new Error(`${name}.delete must never be called by billing code`)
    },
  })

  const db = {
    planVersion: planVersionDelegate,
    razorpayPlanMapping: razorpayPlanMappingDelegate,
    userSubscription: userSubscriptionDelegate,
    webhookEvent: webhookEventDelegate,
    subscriptionCharge: subscriptionChargeDelegate,
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        auditLogs.push(args.data)
        return { ...args.data }
      },
    },
    // Standalone commerce + Phase 1-3 tables billing must never touch.
    order: trap("order"),
    payment: trap("payment"),
    cart: trap("cart"),
    invoice: trap("invoice"),
    product: trap("product"),
    subscriptionPlan: trap("subscriptionPlan"),
    planItem: trap("planItem"),
    entitlementGrant: trap("entitlementGrant"),
    customerEntitlement: trap("customerEntitlement"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(db)
    },
  }

  return {
    db,
    store: { plans, versions, mappings, subscriptions, webhooks, charges, auditLogs },
    failures,
    seedPlan,
    seedVersion,
    seedMapping,
    seedSubscription,
    seedWebhook,
  }
}

export type FakeRzpDb = ReturnType<typeof createFakeRzpDb>
export { SubscriptionStatus, PlanMappingStatus }
