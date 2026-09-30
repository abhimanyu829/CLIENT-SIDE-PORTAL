import { describe, expect, it, beforeEach } from "vitest"
import { z } from "zod"
import { CapabilityRegistry } from "../capabilities/registry"
import { projectTools, resolveProjectedTool, toolNameFor } from "../mcp/tool-projection"
import type { CapabilityDefinition } from "../capabilities/types"

function makeCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: "products.list",
    version: 1,
    domain: "products",
    name: "List products",
    description: "d",
    status: "ACTIVE",
    operationType: "READ",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({}).strict(),
    errorContract: [],
    requiredIdentityContext: ["connectionId"],
    resource: { resourceType: "Product" },
    permission: { permission: "read:products" },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "x", class: "IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: { adapterKey: "products.listAdapter" },
    ...overrides,
  }
}

describe("projectTools", () => {
  let registry: CapabilityRegistry
  beforeEach(() => {
    registry = new CapabilityRegistry()
  })

  it("9. tools/list — exposes an AGENT_AVAILABLE + ACTIVE capability", () => {
    registry.register(makeCapability())
    const tools = projectTools(registry)
    expect(tools.map((t) => t.name)).toEqual(["products.list"])
  })

  it("16. never reveals a disabled capability", () => {
    registry.register(makeCapability())
    registry.disable("products.list", 1)
    const tools = projectTools(registry)
    expect(tools).toEqual([])
  })

  it("17. never reveals a forbidden capability", () => {
    registry.register(
      makeCapability({ id: "refunds.process", exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null })
    )
    const tools = projectTools(registry)
    expect(tools.map((t) => t.name)).not.toContain("refunds.process")
  })

  it("never reveals an INTERNAL_ONLY capability, even though it is status:ACTIVE", () => {
    registry.register(makeCapability({ id: "products.updatePricing", exposure: "INTERNAL_ONLY", executionReference: null }))
    const tools = projectTools(registry)
    expect(tools.map((t) => t.name)).not.toContain("products.updatePricing")
  })

  it("never reveals a deprecated (non-default) version", () => {
    registry.register(makeCapability({ version: 1 }))
    registry.register(makeCapability({ version: 2 }))
    registry.deprecate("products.list", 1)
    const tools = projectTools(registry)
    // list() returns every registered row (both versions exist as separate
    // entries); the deprecated one should still be excluded from the
    // externally-facing projection per its own status field.
    const deprecatedStillListed = tools.some((t) => t.capability.version === 1 && t.capability.status === "DEPRECATED")
    expect(deprecatedStillListed).toBe(false)
  })

  it("14. deterministic tool ordering — matches the registry's own deterministic insertion order", () => {
    registry.register(makeCapability({ id: "products.list", version: 1 }))
    registry.register(makeCapability({ id: "products.get", version: 1 }))
    const first = projectTools(registry).map((t) => t.name)
    const second = projectTools(registry).map((t) => t.name)
    expect(first).toEqual(second)
    expect(first).toEqual(["products.list", "products.get"])
  })

  it("15. tool naming — deterministic, maps to exactly one capability, never an implementation-detail name", () => {
    const capability = makeCapability()
    expect(toolNameFor(capability)).toBe("products.list")
    expect(toolNameFor(capability)).not.toMatch(/prisma|database|admin\.execute|api\.call/i)
  })

  it("18. capability-version mapping — the projected tool carries the exact resolved version", () => {
    registry.register(makeCapability({ version: 1 }))
    registry.register(makeCapability({ version: 2 }))
    const tools = projectTools(registry)
    expect(tools[0].capability.version).toBe(2) // highest non-deprecated version, per Phase 3's own resolve() default
  })
})

describe("resolveProjectedTool", () => {
  let registry: CapabilityRegistry
  beforeEach(() => {
    registry = new CapabilityRegistry()
  })

  it("8. unknown tool -> null", () => {
    expect(resolveProjectedTool(registry, "nonexistent.tool")).toBeNull()
  })

  it("16. disabled capability omission at call-time too, not just list-time", () => {
    registry.register(makeCapability())
    registry.disable("products.list", 1)
    expect(resolveProjectedTool(registry, "products.list")).toBeNull()
  })

  it("17. forbidden capability omission at call-time too", () => {
    registry.register(
      makeCapability({ id: "refunds.process", exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null })
    )
    expect(resolveProjectedTool(registry, "refunds.process")).toBeNull()
  })

  it("resolves a valid, exposed capability", () => {
    registry.register(makeCapability())
    const resolved = resolveProjectedTool(registry, "products.list")
    expect(resolved?.name).toBe("products.list")
  })
})
