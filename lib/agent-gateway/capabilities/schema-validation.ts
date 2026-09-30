/**
 * lib/agent-gateway/capabilities/schema-validation.ts
 *
 * Thin zod wrapper for validating capability input/output against a
 * CapabilityDefinition's schemas. Uses the EXISTING validation technology
 * (zod, already a dependency — see lib/agent-gateway/config.ts) rather
 * than introducing a second validation framework.
 *
 * Converts zod's internal error shape into a CapabilityError with
 * field-level detail only — never a raw zod issue dump, never a stack
 * trace, never any value that could itself carry a secret (the message
 * text includes field paths and expected/received TYPES, never the raw
 * input value itself, since that could contain sensitive content the
 * caller supplied).
 */
import { ZodError, type z } from "zod"
import { CapabilityError } from "./errors"

function summarizeZodError(err: ZodError): Record<string, unknown> {
  return {
    issues: err.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  }
}

/**
 * Validates `input` against `schema`. Throws `CapabilityError("INVALID_INPUT", ...)`
 * on failure — never returns a partially-valid value.
 */
export function validateAgainstSchema<T>(schema: z.ZodType<T>, input: unknown, errorCodeContext: string): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new CapabilityError(
      "INVALID_INPUT",
      `${errorCodeContext} failed schema validation.`,
      summarizeZodError(result.error)
    )
  }
  return result.data
}
