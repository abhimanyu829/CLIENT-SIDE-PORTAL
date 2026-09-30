import { describe, expect, it, vi } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"

async function setup() {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  const { ProductsGetAdapter } = await import("../execution/adapters/products-get-adapter")
  return { adapter: new ProductsGetAdapter(), fake }
}

function ctx(overrides: Partial<{ aborted: boolean }> = {}) {
  const controller = new AbortController()
  if (overrides.aborted) controller.abort()
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_1",
    connectionStatus: "ACTIVE" as const,
    capabilityId: "products.get",
    capabilityVersion: 1,
    environment: "development",
    timestamp: new Date(),
    signal: controller.signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "products.get", capabilityVersion: 1 },
  }
}

describe("ProductsGetAdapter", () => {
  it("1. valid execution returns the product by id", async () => {
    const { adapter, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const result = await adapter.execute(ctx(), { id: "p1" })
    expect(result.output).toEqual({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
  })

  it("2. missing resource — RESOURCE_NOT_FOUND, not a bare null/undefined", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx(), { id: "nonexistent" })).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" })
  })

  it("queries by id, not slug, matching the capability's declared input contract", async () => {
    const { adapter, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a-real-slug", status: "AVAILABLE", type: "SAAS" })
    await adapter.execute(ctx(), { id: "p1" })
    const call = fake.lastCallArgs("product.findUnique") as { where: { id?: string; slug?: string } }
    expect(call.where).toEqual({ id: "p1" })
  })

  it("does NOT increment viewCount — the real route's side effect is intentionally not replicated", async () => {
    const { adapter, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await adapter.execute(ctx(), { id: "p1" })
    // The fake db has no `update` mock at all for `product` — if the
    // adapter tried to call db.product.update, this would throw
    // "is not a function", which the test would surface as a failure.
    expect((fake.client.product as Record<string, unknown>).update).toBeUndefined()
  })

  it("19. respects AbortSignal", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx({ aborted: true }), { id: "p1" })).rejects.toMatchObject({ code: "CANCELLED" })
  })

  it("16. output transformation — only safe allowlisted fields selected", async () => {
    const { adapter, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await adapter.execute(ctx(), { id: "p1" })
    const call = fake.lastCallArgs("product.findUnique") as { select: Record<string, boolean> }
    expect(Object.keys(call.select).sort()).toEqual(["id", "name", "slug", "status", "type"])
  })
})
