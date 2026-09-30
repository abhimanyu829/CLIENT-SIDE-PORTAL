import { describe, expect, it, vi } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"

async function setup() {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  const { TicketsListAdapter } = await import("../execution/adapters/tickets-list-adapter")
  return { adapter: new TicketsListAdapter(), fake }
}

function ctx(ownerId = "owner_1") {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId,
    connectionStatus: "ACTIVE" as const,
    capabilityId: "tickets.list",
    capabilityVersion: 1,
    environment: "development",
    timestamp: new Date(),
    signal: new AbortController().signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "tickets.list", capabilityVersion: 1 },
  }
}

describe("TicketsListAdapter", () => {
  it("1. valid execution — returns only the caller's own tickets", async () => {
    const { adapter, fake } = await setup()
    fake.seedTicket({ id: "t1", clientId: "owner_1", title: "Help", status: "OPEN", assignedTo: "staff_1" })
    fake.seedTicket({ id: "t2", clientId: "owner_2", title: "Other user's ticket", status: "OPEN", assignedTo: null })
    const result = await adapter.execute(ctx("owner_1"), {})
    expect(result.output.items).toEqual([{ id: "t1", subject: "Help", status: "OPEN" }])
  })

  it("cross-tenant isolation: unconditionally scopes to context.ownerId, never an 'admin sees all' branch", async () => {
    const { adapter, fake } = await setup()
    fake.seedTicket({ id: "t1", clientId: "owner_1", title: "A", status: "OPEN", assignedTo: null })
    fake.seedTicket({ id: "t2", clientId: "owner_2", title: "B", status: "OPEN", assignedTo: null })
    const result = await adapter.execute(ctx("owner_2"), {})
    expect(result.output.items.map((t) => t.id)).toEqual(["t2"])
  })

  it("excludes assignedTo (internal staff id) from the output shape entirely", async () => {
    const { adapter, fake } = await setup()
    fake.seedTicket({ id: "t1", clientId: "owner_1", title: "A", status: "OPEN", assignedTo: "staff_1" })
    const result = await adapter.execute(ctx("owner_1"), {})
    expect(result.output.items[0]).not.toHaveProperty("assignedTo")
  })

  it("2. invalid input — an unsupported status value is rejected rather than silently returning zero rows", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx("owner_1"), { status: "NOT_A_REAL_STATUS" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
  })

  it("honors the existing service's real limit cap of 50", async () => {
    const { adapter, fake } = await setup()
    await adapter.execute(ctx("owner_1"), { limit: 999 })
    const call = fake.lastCallArgs("ticket.findMany") as { take: number }
    expect(call.take).toBe(50)
  })

  it("19. respects AbortSignal", async () => {
    const { adapter } = await setup()
    const controller = new AbortController()
    controller.abort()
    await expect(adapter.execute({ ...ctx("owner_1"), signal: controller.signal }, {})).rejects.toMatchObject({
      code: "CANCELLED",
    })
  })
})
