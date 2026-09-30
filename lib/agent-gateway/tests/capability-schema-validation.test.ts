import { describe, expect, it } from "vitest"
import { z } from "zod"
import { validateAgainstSchema } from "../capabilities/schema-validation"
import { CapabilityError } from "../capabilities/errors"

describe("validateAgainstSchema", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() }).strict()

  it("returns the parsed value on success", () => {
    const result = validateAgainstSchema(schema, { name: "a", age: 5 }, "test")
    expect(result).toEqual({ name: "a", age: 5 })
  })

  it("throws CapabilityError INVALID_INPUT on a type mismatch", () => {
    expect(() => validateAgainstSchema(schema, { name: "a", age: "not a number" }, "test")).toThrow(CapabilityError)
  })

  it("throws CapabilityError INVALID_INPUT on missing required fields", () => {
    try {
      validateAgainstSchema(schema, { name: "a" }, "test")
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(CapabilityError)
      expect((err as CapabilityError).code).toBe("INVALID_INPUT")
    }
  })

  it("rejects unknown fields on a strict schema (unexpected-parameter defense)", () => {
    expect(() => validateAgainstSchema(schema, { name: "a", age: 5, extraUnexpectedField: "x" }, "test")).toThrow(
      CapabilityError
    )
  })

  it("rejects a JSON payload using a `__proto__` own-property key (prototype-pollution-shaped payload)", () => {
    const polluted = JSON.parse('{"name":"a","age":5,"__proto__":{"polluted":true}}')
    // JSON.parse DOES create a real own-enumerable "__proto__" key (unlike an object literal),
    // which a strict schema must reject as an unknown field.
    expect(() => validateAgainstSchema(schema, polluted, "test")).toThrow(CapabilityError)
  })

  it("never includes the raw input value in the thrown error's details", () => {
    try {
      validateAgainstSchema(schema, { name: "a", age: "SECRET_VALUE_SHOULD_NOT_LEAK" }, "test")
      expect.unreachable()
    } catch (err) {
      const capErr = err as CapabilityError
      expect(JSON.stringify(capErr.details)).not.toContain("SECRET_VALUE_SHOULD_NOT_LEAK")
    }
  })
})
