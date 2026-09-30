import { describe, expect, it, vi, beforeEach } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"

async function setup() {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  const { ProductsListAdapter } = await import("../execution/adapters/products-list-adapter")
  return { adapter: new ProductsListAdapter(), fake }
}

function ctx(overrides: Partial<{ aborted: boolean }> = {}) {
  const controller = new AbortController()
  if (overrides.aborted) controller.abort()
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_1",
    connectionStatus: "ACTIVE" as const,
    capabilityId: "products.list",
    capabilityVersion: 1,
    environment: "development",
    timestamp: new Date(),
    signal: controller.signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "products.list", capabilityVersion: 1 },
  }
}

describe("ProductsListAdapter", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("1. valid execution returns items from the existing service", async () => {
    const { adapter, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    fake.seedProduct({ id: "p2", name: "B", slug: "b", status: "DRAFT", type: "SAAS" })
    const result = await adapter.execute(ctx(), {})
    expect(result.output.items).toEqual([{ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" }])
  })

  it("2. invalid input — non-AVAILABLE status is rejected, not silently ignored", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx(), { status: "DRAFT" })).rejects.toMatchObject({ code: "INVALID_INPUT" })
  })

  it("3. missing/unsupported field — category filter is rejected (real service has no such filter)", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx(), { category: "tools" })).rejects.toMatchObject({ code: "INVALID_INPUT" })
  })

  it("honors the existing service's real limit cap of 50, tighter than the manifest's declared 100", async () => {
    const { adapter, fake } = await setup()
    const result = await adapter.execute(ctx(), { limit: 999 })
    const call = fake.lastCallArgs("product.findMany") as { take: number }
    expect(call.take).toBe(50)
    void result
  })

  it("always forces status:AVAILABLE in the underlying query, matching the real public route", async () => {
    const { adapter, fake } = await setup()
    await adapter.execute(ctx(), {})
    const call = fake.lastCallArgs("product.findMany") as { where: { status: string } }
    expect(call.where.status).toBe("AVAILABLE")
  })

  it("19. respects AbortSignal — cancelled before the existing service is invoked", async () => {
    const { adapter, fake } = await setup()
    await expect(adapter.execute(ctx({ aborted: true }), {})).rejects.toMatchObject({ code: "CANCELLED" })
    expect(fake.lastCallArgs("product.findMany")).toBeUndefined()
  })

  it("16. output transformation — only the safe allowlisted fields are ever selected/returned", async () => {
    const { adapter, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await adapter.execute(ctx(), {})
    const call = fake.lastCallArgs("product.findMany") as { select: Record<string, boolean> }
    expect(Object.keys(call.select).sort()).toEqual(["id", "name", "slug", "status", "type"])
  })

  it("binding: declares the exact capabilityId/version it is bound to", async () => {
    const { adapter } = await setup()
    expect(adapter.capabilityId).toBe("products.list")
    expect(adapter.capabilityVersion).toBe(1)
  })
})
