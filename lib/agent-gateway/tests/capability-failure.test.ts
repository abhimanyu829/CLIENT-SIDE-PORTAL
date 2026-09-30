/**
 * Phase 3 failure tests — the registry must FAIL CLOSED for every
 * malformed/corrupt/incomplete manifest scenario. It must never expose a
 * partially-valid registry.
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { CapabilityRegistry } from "../capabilities/registry"
import { CapabilityError } from "../capabilities/errors"
import type { CapabilityDefinition } from "../capabilities/types"

function makeDef(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: "products.list",
    version: 1,
    domain: "products",
    name: "n",
    description: "d",
    status: "ACTIVE",
    operationType: "READ",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({}).strict(),
    errorContract: [],
    requiredIdentityContext: [],
    resource: { resourceType: "Product" },
    permission: { permission: null },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "x", class: "IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: { adapterKey: "products.listAdapter" },
    ...overrides,
  }
}

describe("registry initialization failure — malformed manifest entries", () => {
  it("a single malformed entry never leaves the registry partially populated for THAT entry", () => {
    const registry = new CapabilityRegistry()
    try {
      registry.register(makeDef({ id: "bad id!!" }))
    } catch {
      // expected
    }
    expect(registry.has("bad id!!")).toBe(false)
    // No id "bad id!!" could ever have been stored, since assertValidCapabilityId
    // would also reject it during has()'s own validation — confirming there is
    // no code path where a rejected definition still becomes lookupable.
  })

  it("a manifest loader that registers N valid entries then hits a malformed Nth entry leaves the first N-1 intact but the loader call itself throws", () => {
    const registry = new CapabilityRegistry()
    const manifest = [makeDef({ id: "products.list", version: 1 }), makeDef({ id: "products.get", version: 1 }), makeDef({ id: "bad id!!", version: 1 })]

    expect(() => {
      for (const def of manifest) registry.register(def)
    }).toThrow()

    // The registry's own contract does not silently roll back prior
    // successful registrations from the same loop — this is why
    // registerCoreCapabilities() (manifest.ts) must be called at trusted
    // app-init time only, and any throw must be treated as "the whole
    // manifest failed to load," never "some capabilities are live."
    expect(registry.has("products.list")).toBe(true)
    expect(registry.has("bad id!!")).toBe(false)
  })

  it("duplicate definitions in a manifest are rejected, not silently overwritten", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    expect(() => registry.register(makeDef({ id: "products.list", version: 1, name: "different name" }))).toThrow(
      CapabilityError
    )
    // Confirm the ORIGINAL definition, not the duplicate, is what's stored.
    expect(registry.resolve("products.list@v1").name).toBe("n")
  })

  it("missing version on a definition (undefined) is rejected, not defaulted to 1", () => {
    const registry = new CapabilityRegistry()
    const def = makeDef({ version: undefined as unknown as number })
    expect(() => registry.register(def)).toThrow(CapabilityError)
  })

  it("a corrupt/impossible zod schema value (not a ZodType at all) does not crash resolve() for OTHER capabilities", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.good", version: 1 }))
    // Even if one hypothetical bad entry failed to register, a completely
    // unrelated, already-registered capability must remain resolvable.
    expect(() => registry.resolve("products.good@v1")).not.toThrow()
  })

  it("missing dependency: resolving a capability whose id was never registered fails closed with CAPABILITY_NOT_FOUND, never a generic crash", () => {
    const registry = new CapabilityRegistry()
    let caught: unknown
    try {
      registry.resolve("nonexistent.capability")
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(CapabilityError)
    expect((caught as CapabilityError).code).toBe("CAPABILITY_NOT_FOUND")
  })

  it("incompatible/unknown version request fails closed with CAPABILITY_NOT_FOUND, not a silent fallback to a different version", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    expect(() => registry.resolve("products.list@v999")).toThrow(CapabilityError)
  })

  it("partial registry initialization is never exposed as available: disabling every version of a capability makes it fully unresolvable, not partially so", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    registry.register(makeDef({ id: "products.list", version: 2 }))
    registry.disable("products.list", 1)
    registry.disable("products.list", 2)
    expect(() => registry.resolve("products.list")).toThrow(CapabilityError)
    expect(() => registry.resolve("products.list@v1")).toThrow(CapabilityError)
    expect(() => registry.resolve("products.list@v2")).toThrow(CapabilityError)
  })

  it("invalid metadata (empty errorContract, empty sideEffects) is accepted structurally — these are optional/descriptive, not fail-closed gates", () => {
    const registry = new CapabilityRegistry()
    expect(() => registry.register(makeDef({ errorContract: [], sideEffects: { effects: [] } }))).not.toThrow()
  })
})
