import { describe, expect, it } from "vitest"
import { assertNoDangerousPrimitives, DangerousPrimitiveError } from "../capabilities/dangerous-primitive-guard"
import type { CapabilityDefinition } from "../capabilities/types"

function baseDef(overrides: Partial<CapabilityDefinition>): CapabilityDefinition {
  return {
    id: "products.list",
    version: 1,
    domain: "products",
    name: "n",
    description: "d",
    status: "ACTIVE",
    operationType: "READ",
    exposure: "AGENT_AVAILABLE",
    inputSchema: null,
    outputSchema: null,
    errorContract: [],
    requiredIdentityContext: [],
    resource: { resourceType: "Product" },
    permission: { permission: null },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "x", class: "IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: null,
    ...overrides,
  }
}

describe("assertNoDangerousPrimitives", () => {
  it("allows a clean business-intent definition", () => {
    const def = baseDef({ executionReference: { adapterKey: "products.listAdapter" } })
    expect(() => assertNoDangerousPrimitives(def)).not.toThrow()
  })

  it.each([
    ["products.evalRunner", "eval"],
    ["products.sqlQuery", "sql"],
    ["database.query", "database"],
    ["prisma.rawAccess", "prisma"],
  ])("rejects a dangerous adapterKey containing %s", (adapterKey) => {
    const def = baseDef({ executionReference: { adapterKey } })
    expect(() => assertNoDangerousPrimitives(def)).toThrow(DangerousPrimitiveError)
  })

  it("rejects a dangerous id even without an executionReference", () => {
    const def = baseDef({ id: "products.execShell", executionReference: null })
    expect(() => assertNoDangerousPrimitives(def)).toThrow(DangerousPrimitiveError)
  })

  it("rejects a dangerous domain", () => {
    const def = baseDef({ id: "shell.run", domain: "shell", executionReference: null })
    expect(() => assertNoDangerousPrimitives(def)).toThrow(DangerousPrimitiveError)
  })

  it("does not false-positive on legitimate descriptive side-effect text mentioning 'database write'", () => {
    const def = baseDef({
      executionReference: { adapterKey: "products.createDraftAdapter" },
      sideEffects: { effects: ["database write (Product, ProductVersion, AuditLog)"] },
    })
    expect(() => assertNoDangerousPrimitives(def)).not.toThrow()
  })

  it("rejects a generic-HTTP-forwarding-shaped adapterKey", () => {
    const def = baseDef({ executionReference: { adapterKey: "products.fetchAnyUrl" } })
    expect(() => assertNoDangerousPrimitives(def)).toThrow(DangerousPrimitiveError)
  })
})
