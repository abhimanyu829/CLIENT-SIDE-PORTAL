import { describe, expect, it } from "vitest"
import { assertValidCapabilityId, parseCapabilityRef, storageKey } from "../capabilities/id"

describe("assertValidCapabilityId", () => {
  it("accepts a well-formed domain.action id", () => {
    expect(() => assertValidCapabilityId("products.list")).not.toThrow()
    expect(() => assertValidCapabilityId("products.updatePricing")).not.toThrow()
  })

  it("rejects an empty string", () => {
    expect(() => assertValidCapabilityId("")).toThrow()
  })

  it("rejects a table/implementation-shaped id", () => {
    expect(() => assertValidCapabilityId("prisma.Product.update")).toThrow()
  })

  it("rejects ids with path traversal characters", () => {
    expect(() => assertValidCapabilityId("products.../etc/passwd")).toThrow()
    expect(() => assertValidCapabilityId("products.list/../secrets")).toThrow()
  })

  it("rejects ids with no domain separator", () => {
    expect(() => assertValidCapabilityId("productslist")).toThrow()
  })

  it("rejects ids with more than one dot", () => {
    expect(() => assertValidCapabilityId("products.list.extra")).toThrow()
  })

  it("rejects ids exceeding the max length", () => {
    const long = "a".repeat(40) + "." + "b".repeat(40)
    expect(() => assertValidCapabilityId(long)).toThrow()
  })

  it("rejects ids with whitespace or $ characters (prototype-pollution-shaped)", () => {
    expect(() => assertValidCapabilityId("products.$where")).toThrow()
    expect(() => assertValidCapabilityId("products. list")).toThrow()
  })
})

describe("parseCapabilityRef", () => {
  it("parses a bare id with no version", () => {
    const parsed = parseCapabilityRef("products.list")
    expect(parsed).toEqual({ id: "products.list", domain: "products", action: "list" })
  })

  it("parses an id with an explicit version suffix", () => {
    const parsed = parseCapabilityRef("products.update@v2")
    expect(parsed).toEqual({ id: "products.update", domain: "products", action: "update", version: 2 })
  })

  it("rejects a malformed version suffix", () => {
    expect(() => parseCapabilityRef("products.update@latest")).toThrow()
    expect(() => parseCapabilityRef("products.update@v0")).toThrow()
    expect(() => parseCapabilityRef("products.update@v")).toThrow()
  })

  it("rejects an empty reference", () => {
    expect(() => parseCapabilityRef("")).toThrow()
  })
})

describe("storageKey", () => {
  it("is deterministic for the same (id, version) pair", () => {
    expect(storageKey("products.list", 1)).toBe("products.list@v1")
    expect(storageKey("products.list", 1)).toBe(storageKey("products.list", 1))
  })
})
