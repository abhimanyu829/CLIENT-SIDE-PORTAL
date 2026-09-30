/**
 * Phase 3 security tests — attempts at capability-ID injection, path
 * traversal, arbitrary function/route injection, prototype pollution,
 * oversized/malformed input, forged permission metadata, unauthorized
 * registry mutation, and disabled/forbidden capability discovery. All
 * must fail safely (throw a stable CapabilityError, never crash, never
 * leak internal detail, never silently succeed).
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { CapabilityRegistry } from "../capabilities/registry"
import { CapabilityError } from "../capabilities/errors"
import { getCapabilityRegistry, __resetCapabilityRegistryForTests } from "../capabilities/index"
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
    inputSchema: z.object({ id: z.string() }).strict(),
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

describe("capability id injection", () => {
  const registry = new CapabilityRegistry()
  registry.register(makeDef({ id: "products.list", version: 1 }))

  it("rejects path traversal in capability lookup", () => {
    expect(() => registry.resolve("../../etc/passwd")).toThrow(CapabilityError)
    expect(() => registry.resolve("products.list/../../secrets")).toThrow(CapabilityError)
  })

  it("rejects arbitrary function-name-shaped lookups", () => {
    expect(() => registry.resolve("global.process.exit")).toThrow(CapabilityError)
    expect(() => registry.resolve("__proto__.constructor")).toThrow(CapabilityError)
  })

  it("rejects arbitrary route-shaped injection strings", () => {
    expect(() => registry.resolve("/api/admin/users/delete")).toThrow(CapabilityError)
  })

  it("rejects SQL-like input as a capability reference", () => {
    expect(() => registry.resolve("products.list; DROP TABLE users;--")).toThrow(CapabilityError)
  })

  it("rejects an oversized capability reference string", () => {
    const huge = "products." + "a".repeat(10_000)
    expect(() => registry.resolve(huge)).toThrow(CapabilityError)
  })

  it("rejects a malformed version string", () => {
    expect(() => registry.resolve("products.list@'; DROP TABLE--")).toThrow(CapabilityError)
    expect(() => registry.resolve("products.list@v-1")).toThrow(CapabilityError)
  })
})

describe("malicious nested JSON / prototype pollution against input validation", () => {
  const registry = new CapabilityRegistry()
  registry.register(makeDef({ id: "products.get", version: 1, inputSchema: z.object({ id: z.string().max(64) }).strict() }))

  it("rejects a deeply nested object where a flat schema is expected", () => {
    const nested = { id: { $where: { $where: { $where: "1=1" } } } }
    expect(() => registry.validateInput("products.get@v1", nested)).toThrow(CapabilityError)
  })

  it("rejects an oversized string input beyond the schema's declared bound", () => {
    expect(() => registry.validateInput("products.get@v1", { id: "a".repeat(100_000) })).toThrow(CapabilityError)
  })

  it("rejects a JSON-parsed payload carrying an own-property '__proto__' key as an unexpected field", () => {
    const payload = JSON.parse('{"id":"x","__proto__":{"admin":true}}')
    expect(() => registry.validateInput("products.get@v1", payload)).toThrow(CapabilityError)
  })

  it("rejects array-shaped input where an object is expected", () => {
    expect(() => registry.validateInput("products.get@v1", ["not", "an", "object"])).toThrow(CapabilityError)
  })

  it("rejects null/undefined input against a required-field schema", () => {
    expect(() => registry.validateInput("products.get@v1", null)).toThrow(CapabilityError)
    expect(() => registry.validateInput("products.get@v1", undefined)).toThrow(CapabilityError)
  })
})

describe("forged permission metadata / unauthorized mutation attempts", () => {
  it("a caller cannot mutate a stored definition's permission after registration (frozen object)", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1, permission: { permission: "read:products" } }))
    const def = registry.resolve("products.list@v1")
    expect(() => {
      ;(def.permission as { permission: string | null }).permission = "write:everything"
    }).toThrow()
  })

  it("the registry exposes no public API to overwrite an existing (id, version) definition in place — attempting register() again is rejected as CONFLICT", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1, permission: { permission: "read:products" } }))
    expect(() =>
      registry.register(makeDef({ id: "products.list", version: 1, permission: { permission: "admin:everything" } }))
    ).toThrow(CapabilityError)
    // Confirm the ORIGINAL permission is what survives — a forged
    // "escalated" duplicate never takes effect.
    expect(registry.resolve("products.list@v1").permission.permission).toBe("read:products")
  })

  it("registry.list() results cannot be used to mutate the registry's internal state (returned array is a fresh copy each call)", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    const listA = registry.list()
    listA.push({ ...makeDef({ id: "products.injected", version: 1 }) })
    const listB = registry.list()
    expect(listB.map((d) => d.id)).not.toContain("products.injected")
  })
})

describe("hidden capability enumeration / disabled-capability discovery", () => {
  it("a FORBIDDEN capability is not discoverable via list() by default", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    registry.register(
      makeDef({ id: "refunds.process", version: 1, exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null })
    )
    const ids = registry.list().map((d) => d.id)
    expect(ids).not.toContain("refunds.process")
  })

  it("a DISABLED capability is not discoverable via list() by default", () => {
    const registry = new CapabilityRegistry()
    registry.register(makeDef({ id: "products.list", version: 1 }))
    registry.disable("products.list", 1)
    const ids = registry.list().map((d) => d.id)
    expect(ids).not.toContain("products.list")
  })

  it("knowing a FORBIDDEN capability's exact id still never permits input validation to succeed against it", () => {
    const registry = new CapabilityRegistry()
    registry.register(
      makeDef({ id: "refunds.process", version: 1, exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null })
    )
    expect(() => registry.validateInput("refunds.process", { amount: 100 })).toThrow(CapabilityError)
  })
})

describe("dangerous primitive registration attempts against the singleton", () => {
  it("the pre-populated singleton registry never contains a dangerous adapterKey", () => {
    __resetCapabilityRegistryForTests()
    const registry = getCapabilityRegistry()
    for (const def of registry.list({ includeDisabled: true, includeForbidden: true })) {
      if (def.executionReference) {
        expect(def.executionReference.adapterKey.toLowerCase()).not.toMatch(/eval|sql|prisma|database|shell|exec|fetch|fs\.|env\./)
      }
    }
  })
})
