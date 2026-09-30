/**
 * lib/agent-gateway/approvals/canonical-json.ts
 *
 * Deterministic JSON serialization used ONLY to compute approval binding
 * digests. The repository has no existing canonical serializer, so this
 * follows the RFC 8785 (JSON Canonicalization Scheme) rules rather than an
 * ad-hoc scheme:
 *
 *   - Object keys sorted by UTF-16 code unit order (JavaScript's default
 *     string comparison), recursively.
 *   - Strings and numbers use ECMAScript JSON.stringify serialization
 *     (the same serialization RFC 8785 specifies).
 *   - Absent vs null are DIFFERENT: a key whose value is `undefined` is
 *     omitted (it is absent); `null` is serialized as `null`.
 *   - Arrays keep their order (order is meaningful in an operation).
 *   - Date values serialize as their ISO-8601 UTC string.
 *   - Non-finite numbers, bigint, functions and symbols are REJECTED —
 *     they have no stable JSON representation, and silently coercing them
 *     would let two different inputs share one digest.
 *   - Unicode is NOT normalized. Two strings that render identically but
 *     differ in code points produce different digests. That is the safe
 *     direction for an approval binding: normalization could make a
 *     visually-identical but different input reuse an approval.
 */

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CanonicalizationError"
  }
}

const MAX_DEPTH = 32

function canonicalize(value: unknown, depth: number): string {
  if (depth > MAX_DEPTH) throw new CanonicalizationError("Value is nested too deeply to canonicalize.")

  if (value === null) return "null"
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new CanonicalizationError("Invalid date.")
    return JSON.stringify(value.toISOString())
  }

  switch (typeof value) {
    case "string":
      return JSON.stringify(value)
    case "boolean":
      return value ? "true" : "false"
    case "number":
      if (!Number.isFinite(value)) throw new CanonicalizationError("Non-finite numbers cannot be canonicalized.")
      // JSON.stringify gives the ECMAScript shortest round-trip form; -0 -> "0".
      return JSON.stringify(value)
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item) => (item === undefined ? "null" : canonicalize(item, depth + 1))).join(",")}]`
      }
      const record = value as Record<string, unknown>
      const keys = Object.keys(record)
        .filter((k) => record[k] !== undefined)
        .sort()
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(record[k], depth + 1)}`).join(",")}}`
    }
    default:
      throw new CanonicalizationError(`Values of type "${typeof value}" cannot be canonicalized.`)
  }
}

/** Canonical JSON text for `value`. Throws CanonicalizationError for unsupported values. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null" // an entirely absent input is treated as JSON null
  return canonicalize(value, 0)
}
