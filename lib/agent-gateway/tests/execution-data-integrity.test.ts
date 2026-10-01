/**
 * Phase 4 data-integrity tests. Since this environment has no real
 * Postgres test database (see execution-fake-db.ts's documented
 * limitation), these tests verify data integrity properties AT THE
 * ADAPTER/FAKE-DB BOUNDARY: no unintended writes occur (all four
 * registered adapters are read-only), no cross-owner data ever leaks
 * into a result, and no field outside the declared output contract ever
 * appears in a returned value.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"
import type { AgentGatewayRequestContext } from "../shared/types"

async function setup() {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({ getById: vi.fn(async (id: string) => ({ id, environment: "development" })) }),
  }))

  const { CapabilityRegistry } = await import("../capabilities/registry")
  const { registerCoreCapabilities } = await import("../capabilities/manifest")
  const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
  const { registerCoreAdapters } = await import("../execution/adapters/index")
  const { AdapterResolver } = await import("../execution/resolver/adapter-resolver")

  const capabilityRegistry = new CapabilityRegistry()
  registerCoreCapabilities(capabilityRegistry)
  const adapterRegistry = new AdapterRegistry()
  registerCoreAdapters(adapterRegistry)
  const resolver = new AdapterResolver(capabilityRegistry, adapterRegistry)

  return { resolver, fake }
}

function gatewayCtx(ownerId = "owner_1"): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId, connectionStatus: "ACTIVE", authenticatedAt: new Date() },
    protocol: "HTTP",
    signal: new AbortController().signal,
  }
}

describe("Phase 4 data integrity", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("no unexpected writes: the 4 Phase 4 READ adapters never reach a write method of the models they touch", async () => {
    const { resolver, fake } = await setup()
    // Products and subscriptions have no write path at all in the fake.
    expect((fake.client.product as Record<string, unknown>).update).toBeUndefined()
    expect((fake.client.product as Record<string, unknown>).create).toBeUndefined()
    expect((fake.client.subscription as Record<string, unknown>).update).toBeUndefined()
    // Tickets gained create / updateMany in Phase 13 (tickets.create / tickets.close);
    // the READ adapters must still never call them.
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "t1" })
    fake.seedTicket({ id: "t1", clientId: "owner_1", title: "Mine", status: "OPEN", assignedTo: null })
    await resolver.execute("products.list", {}, gatewayCtx())
    await resolver.execute("products.get", { id: "p1" }, gatewayCtx())
    await resolver.execute("subscriptions.get", { subscriptionId: "s1" }, gatewayCtx())
    await resolver.execute("tickets.list", {}, gatewayCtx())
    expect((fake.client.ticket as Record<string, unknown>).update).toBeUndefined()
    expect(fake.client.ticket.create).not.toHaveBeenCalled()
    expect(fake.client.ticket.updateMany).not.toHaveBeenCalled()
  })

  it("no orphaned records: read-only capabilities never create any record before or after execution", async () => {
    const { resolver, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const before = fake._products.size
    await resolver.execute("products.list", {}, gatewayCtx())
    await resolver.execute("products.get", { id: "p1" }, gatewayCtx())
    expect(fake._products.size).toBe(before)
  })

  it("no incorrect owner assignment: tickets.list never returns a row whose clientId differs from the caller's trusted ownerId", async () => {
    const { resolver, fake } = await setup()
    fake.seedTicket({ id: "t1", clientId: "owner_1", title: "Mine", status: "OPEN", assignedTo: null })
    fake.seedTicket({ id: "t2", clientId: "owner_2", title: "Not mine", status: "OPEN", assignedTo: null })
    const result = await resolver.execute("tickets.list", {}, gatewayCtx("owner_1"))
    expect((result.output as { items: { id: string }[] }).items.map((t) => t.id)).toEqual(["t1"])
  })

  it("no missing status transitions: products.get never mutates the underlying product's status/fields as a side effect of reading it", async () => {
    const { resolver, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await resolver.execute("products.get", { id: "p1" }, gatewayCtx())
    const stored = fake._products.get("p1")
    expect(stored).toEqual({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
  })

  it("output never contains a field outside the capability's own declared outputSchema shape", async () => {
    const { resolver, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    const result = await resolver.execute("subscriptions.get", { subscriptionId: "s1" }, gatewayCtx("owner_1"))
    expect(Object.keys(result.output as Record<string, unknown>).sort()).toEqual(["id", "planId", "status"])
  })

  it("no duplicate records across repeated identical reads (idempotent by nature, not just by idempotency-key mechanism)", async () => {
    const { resolver, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const r1 = await resolver.execute("products.get", { id: "p1" }, gatewayCtx())
    const r2 = await resolver.execute("products.get", { id: "p1" }, gatewayCtx())
    expect(r1.output).toEqual(r2.output)
    expect(fake._products.size).toBe(1)
  })
})
