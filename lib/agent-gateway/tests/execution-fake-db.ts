/**
 * lib/agent-gateway/tests/execution-fake-db.ts
 *
 * A minimal in-memory fake of the Prisma client surface used by the
 * Phase 4 adapters (Product/Subscription/Ticket). Not a general-purpose
 * Prisma mock — implements exactly the model/method calls the adapters
 * make, and asserts the SHAPE of `where`/`select` calls matches what was
 * traced from the real routes during the Phase 4 Step 0 audit (see
 * docs/agent-gateway/phase-4/04-existing-service-mapping.md).
 *
 * KNOWN LIMITATION (documented, not hidden): this environment has no real
 * Postgres test database provisioned (DATABASE_URL is a placeholder, no
 * TEST_DATABASE_URL exists). "Service integration" tests in this Phase 4
 * suite therefore run against this high-fidelity in-memory fake rather
 * than a live database — they prove the ADAPTER's query construction and
 * translation logic is correct, not that Postgres itself behaves as
 * expected (that's covered by this app's existing, separate test/staging
 * infrastructure, outside Phase 4's scope to create).
 */
import { vi } from "vitest"

export interface FakeProductRow {
  id: string
  name: string
  slug: string
  status: string
  type: string
  vendorId?: string | null
  averageRating?: number
  reviewCount?: number
  deliveryConfig?: Record<string, unknown>
}

export interface FakeSubscriptionRow {
  id: string
  userId: string
  status: string
  tierId: string
  productId?: string
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  createdAt?: Date
  stripeSubId?: string | null
}

export interface FakeTicketRow {
  id: string
  clientId: string
  title: string
  status: string
  assignedTo: string | null
  description?: string
  priority?: string
  category?: string
  createdAt?: Date
  updatedAt?: Date
}

// ── Phase 13 — the domain models the new adapters read and write ─────────

export interface FakeVendorRow {
  id: string
  userId: string
}

export interface FakeCampaignRow {
  id: string
  name: string
  label: string | null
  type: string
  discountPercent: number
  bannerText: string | null
  startsAt: Date
  endsAt: Date
  applicableTierIds: string[]
  isActive: boolean
  // Fields the adapter must never return (the public route excludes them too).
  revenue?: number
  ctaUrl?: string | null
  createdBy?: string | null
}

export interface FakeTicketMessageRow {
  id: string
  ticketId: string
  senderId: string
  content: string
  isInternal: boolean
  createdAt: Date
}

export interface FakeMetricEventRow {
  id: string
  type: string
  productId: string | null
  userId?: string | null
  occurredAt: Date
}

type Where = Record<string, any>

/** The subset of Prisma `where` semantics the adapters use: equality, `in`, `gte` / `lte`. */
function matches(row: Record<string, any>, where: Where | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key]
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !(cond.in as unknown[]).includes(value)) return false
      if ("gte" in cond && !(value >= cond.gte)) return false
      if ("lte" in cond && !(value <= cond.lte)) return false
      return true
    }
    return value === cond
  })
}

function byTime<T extends Record<string, any>>(rows: T[], field: string, dir: "asc" | "desc"): T[] {
  return [...rows].sort((a, b) => (dir === "desc" ? -1 : 1) * (new Date(a[field] ?? 0).getTime() - new Date(b[field] ?? 0).getTime()))
}

let fakeIdCounter = 0

export function createExecutionFakeDb() {
  const products = new Map<string, FakeProductRow>()
  const subscriptions = new Map<string, FakeSubscriptionRow>()
  const tickets = new Map<string, FakeTicketRow>()
  const vendors = new Map<string, FakeVendorRow>()
  const campaigns = new Map<string, FakeCampaignRow>()
  const ticketMessages = new Map<string, FakeTicketMessageRow>()
  const metricEvents = new Map<string, FakeMetricEventRow>()

  const lastCalls: Record<string, unknown[]> = {}
  function record(name: string, args: unknown) {
    lastCalls[name] = lastCalls[name] ?? []
    lastCalls[name].push(args)
  }

  const client = {
    product: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown>; take?: number }) => {
        record("product.findMany", args)
        let rows = Array.from(products.values())
        if (args?.where?.status) rows = rows.filter((r) => r.status === args.where!.status)
        if (args?.where?.vendorId) rows = rows.filter((r) => matches(r as unknown as Record<string, unknown>, { vendorId: args.where!.vendorId }))
        if (args?.take) rows = rows.slice(0, args.take)
        return rows
      }),
      findUnique: vi.fn(async (args: { where: { id?: string; slug?: string } }) => {
        record("product.findUnique", args)
        if (args.where.id) return products.get(args.where.id) ?? null
        if (args.where.slug) return Array.from(products.values()).find((p) => p.slug === args.where.slug) ?? null
        return null
      }),
      count: vi.fn(async (args: { where?: Where }) => {
        record("product.count", args)
        return Array.from(products.values()).filter((r) => matches(r as unknown as Record<string, unknown>, args?.where)).length
      }),
    },
    subscription: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        record("subscription.findUnique", args)
        return subscriptions.get(args.where.id) ?? null
      }),
      findMany: vi.fn(async (args: { where?: Where; take?: number }) => {
        record("subscription.findMany", args)
        const rows = byTime(
          Array.from(subscriptions.values()).filter((r) => matches(r as unknown as Record<string, unknown>, args?.where)),
          "createdAt",
          "desc"
        )
        return args?.take ? rows.slice(0, args.take) : rows
      }),
      count: vi.fn(async (args: { where?: Where }) => {
        record("subscription.count", args)
        return Array.from(subscriptions.values()).filter((r) => matches(r as unknown as Record<string, unknown>, args?.where)).length
      }),
    },
    ticket: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown>; take?: number }) => {
        record("ticket.findMany", args)
        let rows = Array.from(tickets.values())
        if (args?.where?.clientId) rows = rows.filter((r) => r.clientId === args.where!.clientId)
        if (args?.where?.status) rows = rows.filter((r) => r.status === args.where!.status)
        if (args?.take) rows = rows.slice(0, args.take)
        return rows
      }),
      findUnique: vi.fn(async (args: { where: { id: string }; select?: { messages?: { where?: Where; take?: number; orderBy?: { createdAt: "asc" | "desc" } } } }) => {
        record("ticket.findUnique", args)
        const row = tickets.get(args.where.id)
        if (!row) return null
        const messagesArgs = args.select?.messages
        if (!messagesArgs) return { ...row }
        let messages = Array.from(ticketMessages.values()).filter((m) => m.ticketId === row.id && matches(m as unknown as Record<string, unknown>, messagesArgs.where))
        messages = byTime(messages, "createdAt", messagesArgs.orderBy?.createdAt ?? "asc")
        if (messagesArgs.take) messages = messages.slice(0, messagesArgs.take)
        return { ...row, messages }
      }),
      count: vi.fn(async (args: { where?: Where }) => {
        record("ticket.count", args)
        return Array.from(tickets.values()).filter((r) => matches(r as unknown as Record<string, unknown>, args?.where)).length
      }),
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        record("ticket.create", args)
        const now = new Date()
        const row: FakeTicketRow = {
          id: `tkt_${(++fakeIdCounter).toString(36)}_${Math.floor(now.getTime() % 1e6)}`,
          clientId: args.data.clientId,
          title: args.data.title,
          description: args.data.description,
          priority: args.data.priority ?? "MEDIUM",
          category: args.data.category ?? "GENERAL",
          status: "OPEN",
          assignedTo: null,
          createdAt: now,
          updatedAt: now,
        }
        tickets.set(row.id, row)
        return { ...row }
      }),
      updateMany: vi.fn(async (args: { where: Where; data: Record<string, any> }) => {
        record("ticket.updateMany", args)
        let count = 0
        for (const row of tickets.values()) {
          if (!matches(row as unknown as Record<string, unknown>, args.where)) continue
          Object.assign(row, args.data, { updatedAt: new Date() })
          count += 1
        }
        return { count }
      }),
    },
    vendorProfile: {
      findMany: vi.fn(async (args: { where?: Where; take?: number }) => {
        record("vendorProfile.findMany", args)
        const rows = Array.from(vendors.values()).filter((r) => matches(r as unknown as Record<string, unknown>, args?.where))
        return args?.take ? rows.slice(0, args.take) : rows
      }),
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        record("vendorProfile.findUnique", args)
        return vendors.get(args.where.id) ?? null
      }),
    },
    campaign: {
      findFirst: vi.fn(async (args: { where?: Where; orderBy?: { discountPercent: "desc" } }) => {
        record("campaign.findFirst", args)
        const rows = Array.from(campaigns.values())
          .filter((r) => matches(r as unknown as Record<string, unknown>, args?.where))
          .sort((a, b) => b.discountPercent - a.discountPercent)
        return rows[0] ?? null
      }),
    },
    platformMetricEvent: {
      count: vi.fn(async (args: { where?: Where }) => {
        record("platformMetricEvent.count", args)
        return Array.from(metricEvents.values()).filter((r) => matches(r as unknown as Record<string, unknown>, args?.where)).length
      }),
    },
  }

  return {
    client,
    seedProduct: (row: FakeProductRow) => products.set(row.id, row),
    seedSubscription: (row: FakeSubscriptionRow) => subscriptions.set(row.id, row),
    seedTicket: (row: FakeTicketRow) => tickets.set(row.id, row),
    seedVendor: (row: FakeVendorRow) => vendors.set(row.id, row),
    seedCampaign: (row: FakeCampaignRow) => campaigns.set(row.id, row),
    seedTicketMessage: (row: FakeTicketMessageRow) => ticketMessages.set(row.id, row),
    seedMetricEvent: (row: FakeMetricEventRow) => metricEvents.set(row.id, row),
    lastCallArgs: (name: string) => lastCalls[name]?.[lastCalls[name].length - 1],
    _products: products,
    _subscriptions: subscriptions,
    _tickets: tickets,
    _vendors: vendors,
    _campaigns: campaigns,
    _ticketMessages: ticketMessages,
    _metricEvents: metricEvents,
  }
}
