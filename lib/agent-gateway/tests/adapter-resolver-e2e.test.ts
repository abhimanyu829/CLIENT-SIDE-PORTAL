/**
 * End-to-end execution tests: Phase 2 identity -> Phase 3 capability ->
 * Phase 4 adapter -> (fake) existing service -> normalized result.
 *
 * Uses the REAL CapabilityRegistry + REAL core manifest (Phase 3) and the
 * REAL AdapterRegistry + REAL core adapters (Phase 4) — only the Prisma
 * client, Redis, and the Phase 2 connection-service's `getById` lookup are
 * faked (see execution-fake-db.ts's documented test-environment
 * limitation: no live Postgres/Redis is provisioned in this environment).
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

describe("AdapterResolver — end-to-end execution", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("READ capability: products.list — identity -> capability -> adapter -> service -> normalized result", async () => {
    const { resolver, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })

    const result = await resolver.execute("products.list", {}, gatewayCtx())

    expect(result.output).toEqual({ items: [{ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" }] })
    expect(result.executionMode).toBe("SYNC")
  })

  it("READ capability, ownership-scoped: subscriptions.get — the caller's own subscription resolves", async () => {
    const { resolver, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })

    const result = await resolver.execute("subscriptions.get", { subscriptionId: "s1" }, gatewayCtx())

    expect(result.output).toEqual({ id: "s1", status: "ACTIVE", planId: "tier_1" })
  })

  it("READ capability, ownership-scoped: subscriptions.get — a different owner's subscription is not reachable", async () => {
    const { resolver, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_2", status: "ACTIVE", tierId: "tier_1" })

    await expect(resolver.execute("subscriptions.get", { subscriptionId: "s1" }, gatewayCtx())).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    })
  })

  it("LOW_RISK_WRITE-tier capability with no registered adapter (products.createDraft) fails closed with ADAPTER_NOT_FOUND, not a crash", async () => {
    const { resolver } = await setup()
    await expect(resolver.execute("products.createDraft", {}, gatewayCtx())).rejects.toMatchObject({
      code: "ADAPTER_NOT_FOUND",
    })
  })

  it("HIGH_RISK_MUTATION capability (products.updatePricing, exposure=INTERNAL_ONLY) never reaches execution, even with a perfectly valid input", async () => {
    const { resolver } = await setup()
    await expect(
      resolver.execute("products.updatePricing", { tierId: "tier_1", newPrice: 10 }, gatewayCtx())
    ).rejects.toMatchObject({ code: "NOT_EXECUTABLE_YET" })
  })

  it("CRITICAL/FORBIDDEN capability (refunds.process) never reaches execution under any circumstances", async () => {
    const { resolver } = await setup()
    await expect(resolver.execute("refunds.process", {}, gatewayCtx())).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("environment mismatch: a connection provisioned for 'production' cannot execute against a 'development'-configured gateway", async () => {
    const { resolver, fake } = await setup("production")
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    // getGatewayConfig() defaults AGENT_GATEWAY_ENVIRONMENT to "development"
    // when unset — this connection was set up as "production", so the two
    // must mismatch.
    await expect(resolver.execute("products.list", {}, gatewayCtx())).rejects.toMatchObject({
      code: "ENVIRONMENT_MISMATCH",
    })
  })

  it("invalid input at the resolver level is rejected before the adapter is ever invoked", async () => {
    const { resolver, fake } = await setup()
    await resolver.execute("products.get", { id: "p1" }, gatewayCtx()).catch(() => {})
    const before = fake.lastCallArgs("product.findUnique")
    await expect(resolver.execute("products.get", { id: 12345 }, gatewayCtx())).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
    // The adapter's own db call args should be unchanged from before this
    // invalid-input attempt (i.e. the malformed call never reached it).
    expect(fake.lastCallArgs("product.findUnique")).toEqual(before)
  })

  it("output is re-validated by the resolver against the capability's own outputSchema", async () => {
    const { resolver, fake } = await setup()
    fake.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const result = await resolver.execute("products.get", { id: "p1" }, gatewayCtx())
    expect(result.output).toEqual({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
  })

  it("unauthenticated/no-machine-identity requests never reach any adapter", async () => {
    const { resolver } = await setup()
    await expect(
      resolver.execute("products.list", {}, gatewayCtx({ machine: undefined }))
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
