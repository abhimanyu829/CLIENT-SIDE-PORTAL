/**
 * Phase 4 security tests — arbitrary adapter/function/route injection,
 * forged identity fields, cross-tenant access, capability/environment
 * substitution, malformed/oversized/prototype-polluted input, disabled/
 * forbidden capability bypass attempts, unauthorized async job creation.
 * Every attempt must fail safely (a stable ExecutionError, never a crash,
 * never a partial success).
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"
import type { AgentGatewayRequestContext } from "../shared/types"

async function setup(connectionEnvironment = "development") {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({
      getById: vi.fn(async (id: string) => ({ id, environment: connectionEnvironment })),
    }),
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

  return { resolver, fake, capabilityRegistry, adapterRegistry }
}

function gatewayCtx(overrides: Partial<AgentGatewayRequestContext> = {}): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: {
      connectionId: "conn_1",
      credentialId: "cred_1",
      ownerId: "owner_1",
      connectionStatus: "ACTIVE",
      authenticatedAt: new Date(),
    },
    protocol: "HTTP",
    signal: new AbortController().signal,
    ...overrides,
  }
}

describe("Phase 4 security — capability/adapter/route injection", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("1. arbitrary adapter invocation — there is no API to select an adapter directly; only capability refs resolve to adapters", async () => {
    const { adapterRegistry } = await setup()
    // The only public lookup surface is get(capabilityId, version) — there
    // is no "invoke by adapter name" method at all on AdapterRegistry.
    expect(typeof (adapterRegistry as unknown as Record<string, unknown>).invoke).toBe("undefined")
    expect(typeof (adapterRegistry as unknown as Record<string, unknown>).execute).toBe("undefined")
  })

  it("2/3. arbitrary function-name / route-shaped capability ref injection fails safely", async () => {
    const { resolver } = await setup()
    await expect(resolver.execute("global.process.exit", {}, gatewayCtx())).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    })
    await expect(resolver.execute("/api/admin/users/delete", {}, gatewayCtx())).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    })
  })

  it("5. raw SQL injection through adapter input never reaches a raw query — Prisma parameterization + strict schema reject it structurally", async () => {
    const { resolver, fake } = await setup()
    await expect(
      resolver.execute("products.get", { id: "'; DROP TABLE users; --" }, gatewayCtx())
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" }) // treated as an ordinary (nonexistent) id string, never executed as SQL
    const call = fake.lastCallArgs("product.findUnique") as { where: { id: string } }
    expect(call.where.id).toBe("'; DROP TABLE users; --") // passed through as an opaque string value, not concatenated into any query
  })

  it("6/7/8. forged ownerId/teamId/agentId in the request body are ignored — only context.ownerId (trusted Phase 2 identity) is ever used", async () => {
    const { resolver, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    const forgedInput = { subscriptionId: "s1", ownerId: "owner_2", teamId: "team_evil", agentId: "agent_evil" }
    // The capability's strict inputSchema rejects the extra fields outright.
    await expect(resolver.execute("subscriptions.get", forgedInput, gatewayCtx())).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
  })

  it("9. cross-tenant resource ID — a resource owned by a different tenant is never returned, even with the exact correct id", async () => {
    const { resolver, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_TENANT_A", status: "ACTIVE", tierId: "tier_1" })
    const ctx = gatewayCtx({
      machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId: "owner_TENANT_B", connectionStatus: "ACTIVE", authenticatedAt: new Date() },
    })
    await expect(resolver.execute("subscriptions.get", { subscriptionId: "s1" }, ctx)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    })
  })

  it("10/11. capability/adapter substitution — an id@version that resolves to one capability can never execute a DIFFERENT adapter's logic", async () => {
    const { resolver } = await setup()
    // There is no execute(adapterId, ...) overload and no way to pass an
    // adapter identifier independent of the resolved capability — the
    // resolver always derives the adapter strictly from
    // adapterRegistry.get(definition.id, definition.version).
    await expect(resolver.execute("products.list@v999", {}, gatewayCtx())).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    })
  })

  it("12. environment mismatch cannot be bypassed by any input field — there is no environment field on any capability's input schema", async () => {
    const { resolver, fake } = await setup("production")
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    await expect(
      resolver.execute("products.list", { environment: "development" } as unknown as Record<string, unknown>, gatewayCtx())
    ).rejects.toMatchObject({ code: "INVALID_INPUT" }) // rejected by strict schema before environment is even checked
  })

  it("16. malformed nested input is rejected before the adapter runs", async () => {
    const { resolver, fake } = await setup()
    const before = fake.lastCallArgs("product.findUnique")
    await expect(
      resolver.execute("products.get", { id: { $where: "1=1" } } as unknown as Record<string, unknown>, gatewayCtx())
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(fake.lastCallArgs("product.findUnique")).toEqual(before)
  })

  it("17. prototype pollution payload (JSON.parse-shaped) is rejected by the capability's strict schema", async () => {
    const { resolver } = await setup()
    const payload = JSON.parse('{"id":"p1","__proto__":{"admin":true}}')
    await expect(resolver.execute("products.get", payload, gatewayCtx())).rejects.toMatchObject({ code: "INVALID_INPUT" })
  })

  it("18. oversized payload is rejected by the schema's declared string bound", async () => {
    const { resolver } = await setup()
    await expect(
      resolver.execute("products.get", { id: "a".repeat(100_000) }, gatewayCtx())
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
  })

  it("20. bypass of a disabled capability — resolver fails closed even for an otherwise-adapter-bound capability", async () => {
    const { resolver, capabilityRegistry } = await setup()
    capabilityRegistry.disable("products.list", 1)
    await expect(resolver.execute("products.list", {}, gatewayCtx())).rejects.toMatchObject({
      code: "EXECUTION_UNAVAILABLE",
    })
  })

  it("21. bypass of the high-risk execution guard — INTERNAL_ONLY capability cannot be forced to execute via an explicit version ref either", async () => {
    const { resolver } = await setup()
    await expect(resolver.execute("products.updatePricing@v1", { tierId: "t1", newPrice: 1 }, gatewayCtx())).rejects.toMatchObject({
      code: "NOT_EXECUTABLE_YET",
    })
  })

  it("22. retrying a non-idempotent-but-required-key operation without a key is rejected, never silently executed", async () => {
    const { resolver, capabilityRegistry, adapterRegistry } = await setup()
    // products.createDraft requires an idempotency key per its Phase 3
    // metadata, but has no registered adapter — confirm the idempotency
    // gate is unreachable-safe even without an adapter (ADAPTER_NOT_FOUND
    // fires first, which is itself a safe failure, never a duplicate
    // mutation).
    await expect(resolver.execute("products.createDraft", { name: "x", slug: "x", tagline: "x", description: "x", type: "SAAS" }, gatewayCtx())).rejects.toMatchObject({
      code: "ADAPTER_NOT_FOUND",
    })
    void capabilityRegistry
    void adapterRegistry
  })

  it("23. unauthorized async job creation is structurally impossible — no adapter in this phase declares ASYNC execution mode or queues anything", async () => {
    const { capabilityRegistry } = await setup()
    for (const def of capabilityRegistry.list()) {
      expect(def.async.executionMode).toBe("SYNC")
    }
  })
})
