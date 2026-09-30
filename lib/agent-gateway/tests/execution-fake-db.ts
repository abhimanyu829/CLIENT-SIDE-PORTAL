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
}

export interface FakeSubscriptionRow {
  id: string
  userId: string
  status: string
  tierId: string
}

export interface FakeTicketRow {
  id: string
  clientId: string
  title: string
  status: string
  assignedTo: string | null
}

export function createExecutionFakeDb() {
  const products = new Map<string, FakeProductRow>()
  const subscriptions = new Map<string, FakeSubscriptionRow>()
  const tickets = new Map<string, FakeTicketRow>()

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
        if (args?.take) rows = rows.slice(0, args.take)
        return rows
      }),
      findUnique: vi.fn(async (args: { where: { id?: string; slug?: string } }) => {
        record("product.findUnique", args)
        if (args.where.id) return products.get(args.where.id) ?? null
        if (args.where.slug) return Array.from(products.values()).find((p) => p.slug === args.where.slug) ?? null
        return null
      }),
    },
    subscription: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        record("subscription.findUnique", args)
        return subscriptions.get(args.where.id) ?? null
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
    },
  }

  return {
    client,
    seedProduct: (row: FakeProductRow) => products.set(row.id, row),
    seedSubscription: (row: FakeSubscriptionRow) => subscriptions.set(row.id, row),
    seedTicket: (row: FakeTicketRow) => tickets.set(row.id, row),
    lastCallArgs: (name: string) => lastCalls[name]?.[lastCalls[name].length - 1],
    _products: products,
    _subscriptions: subscriptions,
    _tickets: tickets,
  }
}
