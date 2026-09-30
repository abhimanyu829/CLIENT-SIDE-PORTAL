import { describe, expect, it, beforeEach } from "vitest"
import { z } from "zod"
import { CapabilityRegistry } from "../capabilities/registry"
import { CapabilityError } from "../capabilities/errors"
import type { CapabilityDefinition } from "../capabilities/types"

function makeDef(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: "products.list",
    version: 1,
    domain: "products",
    name: "List products",
    description: "d",
    status: "ACTIVE",
    operationType: "READ",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({ limit: z.number().optional() }).strict(),
    outputSchema: z.object({ items: z.array(z.string()) }).strict(),
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

describe("CapabilityRegistry.register", () => {
  let registry: CapabilityRegistry
  beforeEach(() => {
    registry = new CapabilityRegistry()
  })

  it("1. registers a valid capability", () => {
    expect(() => registry.register(makeDef())).not.toThrow()
    expect(registry.has("products.list")).toBe(true)
  })

  it("2. rejects a duplicate (id, version) registration", () => {
    registry.register(makeDef())
    expect(() => registry.register(makeDef())).toThrow(CapabilityError)
    try {
      registry.register(makeDef())
    } catch (err) {
      expect((err as CapabilityError).code).toBe("CONFLICT")
    }
  })

  it("3. allows a duplicate id with a DIFFERENT version", () => {
    registry.register(makeDef({ version: 1 }))
    expect(() => registry.register(makeDef({ version: 2 }))).not.toThrow()
  })

  it("4. rejects an invalid capability id shape", () => {
    expect(() => registry.register(makeDef({ id: "prisma.Product.update" }))).toThrow(CapabilityError)
  })

  it("5. rejects an invalid risk tier", () => {
    expect(() =>
      registry.register(makeDef({ operationType: "SUPER_DANGEROUS" as unknown as CapabilityDefinition["operationType"] }))
    ).toThrow(CapabilityError)
  })

  it("5b. rejects an invalid exposure level", () => {
    expect(() => registry.register(makeDef({ exposure: "ANYONE" as unknown as CapabilityDefinition["exposure"] }))).toThrow(
      CapabilityError
    )
  })

  it("6. rejects a missing input schema for an executable (non-FORBIDDEN, non-DISABLED) operation", () => {
    expect(() => registry.register(makeDef({ inputSchema: null }))).toThrow(CapabilityError)
  })

  it("7. rejects a malformed/dangerous execution reference", () => {
    expect(() => registry.register(makeDef({ executionReference: { adapterKey: "database.rawQuery" } }))).toThrow()
  })

  it("8. accepts a valid schema (input + output both present)", () => {
    expect(() => registry.register(makeDef())).not.toThrow()
  })

  it("21. rejects a dangerous execution reference even when everything else is well-formed", () => {
    expect(() => registry.register(makeDef({ id: "products.shellRunner", executionReference: { adapterKey: "products.execCommand" } }))).toThrow()
  })

  it("22. rejects a definition whose executionReference.adapterKey is not itself a valid capability-id-shaped string", () => {
    expect(() => registry.register(makeDef({ executionReference: { adapterKey: "not a valid key!!" } }))).toThrow(CapabilityError)
  })

  it("FORBIDDEN capability with a non-null executionReference is rejected", () => {
    expect(() =>
      registry.register(makeDef({ exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: { adapterKey: "refunds.processAdapter" } }))
    ).toThrow(CapabilityError)
  })

  it("FORBIDDEN capability with executionReference null and no input schema is accepted", () => {
    expect(() =>
      registry.register(makeDef({ id: "refunds.process", exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null }))
    ).not.toThrow()
  })

  it("rejects a non-integer or zero/negative version", () => {
    expect(() => registry.register(makeDef({ version: 0 }))).toThrow(CapabilityError)
    expect(() => registry.register(makeDef({ version: 1.5 }))).toThrow(CapabilityError)
    expect(() => registry.register(makeDef({ version: -1 }))).toThrow(CapabilityError)
  })
})

describe("CapabilityRegistry.resolve / get / getVersion", () => {
  let registry: CapabilityRegistry
  beforeEach(() => {
    registry = new CapabilityRegistry()
    registry.register(makeDef({ version: 1 }))
    registry.register(makeDef({ version: 2 }))
  })

  it("9. input validation success via validateInput", () => {
    expect(registry.validateInput("products.list@v1", { limit: 5 })).toEqual({ limit: 5 })
  })

  it("10. input validation failure via validateInput", () => {
    expect(() => registry.validateInput("products.list@v1", { limit: "not a number" })).toThrow(CapabilityError)
  })

  it("11. unknown-field handling — strict schema rejects extra fields", () => {
    expect(() => registry.validateInput("products.list@v1", { limit: 5, extra: "x" })).toThrow(CapabilityError)
  })

  it("12. output schema is present and can be validated against a shaped result", () => {
    const def = registry.resolve("products.list@v1")
    expect(def.outputSchema!.safeParse({ items: ["a", "b"] }).success).toBe(true)
    expect(def.outputSchema!.safeParse({ items: "not an array" }).success).toBe(false)
  })

  it("13. capability lookup by exact version", () => {
    const def = registry.getVersion("products.list", 1)
    expect(def?.version).toBe(1)
  })

  it("14. missing capability lookup returns null (getVersion) / throws (resolve)", () => {
    expect(registry.getVersion("products.list", 99)).toBeNull()
    expect(() => registry.resolve("products.list@v99")).toThrow(CapabilityError)
    expect(registry.get("products.doesNotExist")).toBeNull()
  })

  it("15. version resolution without an explicit version returns the highest registered version", () => {
    const def = registry.resolve("products.list")
    expect(def.version).toBe(2)
  })

  it("16. deprecated capability handling — deprecated version excluded from 'latest' selection", () => {
    registry.deprecate("products.list", 2)
    const def = registry.resolve("products.list")
    expect(def.version).toBe(1)
  })

  it("16b. an explicitly-versioned deprecated capability is still resolvable directly", () => {
    registry.deprecate("products.list", 2)
    const def = registry.resolve("products.list@v2")
    expect(def.status).toBe("DEPRECATED")
  })

  it("17. disabled capability handling — resolve() fails closed with CAPABILITY_DISABLED", () => {
    registry.disable("products.list", 2)
    expect(() => registry.resolve("products.list@v2")).toThrow(CapabilityError)
    try {
      registry.resolve("products.list@v2")
    } catch (err) {
      expect((err as CapabilityError).code).toBe("CAPABILITY_DISABLED")
    }
  })

  it("17b. disabling the only/highest version still fails closed rather than silently falling back", () => {
    registry.disable("products.list", 1)
    registry.disable("products.list", 2)
    expect(() => registry.resolve("products.list")).toThrow(CapabilityError)
  })

  it("18. forbidden capability rejection — validateInput on a FORBIDDEN capability throws FORBIDDEN", () => {
    registry.register(makeDef({ id: "refunds.process", exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null }))
    expect(() => registry.validateInput("refunds.process", {})).toThrow(CapabilityError)
    try {
      registry.validateInput("refunds.process", {})
    } catch (err) {
      expect((err as CapabilityError).code).toBe("FORBIDDEN")
    }
  })

  it("19. deterministic registry ordering — list() always returns insertion order", () => {
    const ids1 = registry.list().map((d) => `${d.id}@v${d.version}`)
    const ids2 = registry.list().map((d) => `${d.id}@v${d.version}`)
    expect(ids1).toEqual(ids2)
    expect(ids1).toEqual(["products.list@v1", "products.list@v2"])
  })

  it("20. immutable registry behavior — mutating a returned definition does not affect the stored one", () => {
    const def = registry.resolve("products.list@v1")
    expect(Object.isFrozen(def)).toBe(true)
    expect(() => {
      ;(def as { name: string }).name = "mutated"
    }).toThrow()
    const reFetched = registry.resolve("products.list@v1")
    expect(reFetched.name).toBe("List products")
  })

  it("20b. mutating the object passed into register() after the call does not affect the stored definition", () => {
    const mutableDef = makeDef({ id: "products.mutTest", version: 1 })
    registry.register(mutableDef)
    ;(mutableDef as { name: string }).name = "mutated after register"
    const stored = registry.resolve("products.mutTest@v1")
    expect(stored.name).toBe("List products")
  })

  it("23. missing execution mapping is representable (executionReference null) without breaking resolve()", () => {
    registry.register(makeDef({ id: "products.noAdapterYet", executionReference: null, exposure: "INTERNAL_ONLY" }))
    const def = registry.resolve("products.noAdapterYet")
    expect(def.executionReference).toBeNull()
  })

  it("24. incorrect permission metadata (non-string, non-null) is rejected at TS boundary — runtime accepts documented null with a note", () => {
    registry.register(makeDef({ id: "products.noPermYet", permission: { permission: null, note: "gap" } }))
    const def = registry.resolve("products.noPermYet")
    expect(def.permission.permission).toBeNull()
    expect(def.permission.note).toBe("gap")
  })

  it("25. side-effect metadata integrity — stored verbatim, never mutated by the registry", () => {
    registry.register(
      makeDef({ id: "products.withEffects", sideEffects: { effects: ["database write (Product)"], emitsEvents: ["PRODUCT_CREATED"] } })
    )
    const def = registry.resolve("products.withEffects")
    expect(def.sideEffects.effects).toEqual(["database write (Product)"])
    expect(def.sideEffects.emitsEvents).toEqual(["PRODUCT_CREATED"])
  })

  it("26. idempotency metadata integrity — stored verbatim", () => {
    registry.register(
      makeDef({
        id: "products.idemTest",
        idempotency: { requiresIdempotencyKey: true, idempotencyScope: "slug", retrySafe: false, duplicateBehavior: "conflict", class: "NON_IDEMPOTENT" },
      })
    )
    const def = registry.resolve("products.idemTest")
    expect(def.idempotency.requiresIdempotencyKey).toBe(true)
    expect(def.idempotency.class).toBe("NON_IDEMPOTENT")
  })

  it("27. async metadata integrity — stored verbatim", () => {
    registry.register(makeDef({ id: "products.asyncTest", async: { executionMode: "ASYNC", queue: "deployments", pollingSupported: true } }))
    const def = registry.resolve("products.asyncTest")
    expect(def.async.executionMode).toBe("ASYNC")
    expect(def.async.queue).toBe("deployments")
  })

  it("resource metadata integrity — stored verbatim", () => {
    registry.register(makeDef({ id: "products.resourceTest", resource: { resourceType: "Product", resourceLocator: "productId" } }))
    const def = registry.resolve("products.resourceTest")
    expect(def.resource.resourceType).toBe("Product")
    expect(def.resource.resourceLocator).toBe("productId")
  })

  it("28. error contract integrity — stored verbatim, never invented by the registry", () => {
    registry.register(
      makeDef({ id: "products.errContractTest", errorContract: [{ code: "RESOURCE_NOT_FOUND", description: "no such product" }] })
    )
    const def = registry.resolve("products.errContractTest")
    expect(def.errorContract).toEqual([{ code: "RESOURCE_NOT_FOUND", description: "no such product" }])
  })
})

describe("CapabilityRegistry.list", () => {
  let registry: CapabilityRegistry
  beforeEach(() => {
    registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    registry.register(makeDef({ id: "products.readOnly", version: 1, exposure: "DISABLED" }))
    registry.register(makeDef({ id: "refunds.process", version: 1, exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null }))
  })

  it("excludes DISABLED and FORBIDDEN by default", () => {
    const ids = registry.list().map((d) => d.id)
    expect(ids).toEqual(["products.list"])
  })

  it("includes DISABLED when explicitly requested", () => {
    const ids = registry.list({ includeDisabled: true }).map((d) => d.id)
    expect(ids).toContain("products.readOnly")
  })

  it("includes FORBIDDEN when explicitly requested", () => {
    const ids = registry.list({ includeForbidden: true }).map((d) => d.id)
    expect(ids).toContain("refunds.process")
  })
})

describe("CapabilityRegistry.has", () => {
  it("returns false for a malformed id string rather than throwing", () => {
    const registry = new CapabilityRegistry()
    expect(registry.has("not a valid id!!")).toBe(false)
  })

  it("returns false for an id with no registered versions", () => {
    const registry = new CapabilityRegistry()
    expect(registry.has("products.doesNotExist")).toBe(false)
  })
})
