/**
 * lib/agent-gateway/capabilities/id.ts
 *
 * Capability ID parsing/validation. IDs represent BUSINESS INTENT, never
 * implementation/table terminology (spec: "products.update", never
 * "prisma.Product.update"). Deliberately strict — this is also the
 * charset used for `ExecutionReference.adapterKey`, since both are
 * internal, code-authored identifiers that must never accept arbitrary
 * client-influenced content.
 *
 * Format: `domain.action` — lowercase ASCII letters/digits, camelCase
 * within a segment allowed, exactly one `.` separator, no leading/trailing
 * dot, no path-traversal characters, no whitespace, bounded length.
 */

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/
const MAX_ID_LENGTH = 80

export interface ParsedCapabilityRef {
  id: string
  domain: string
  action: string
  /** Present only when the caller supplied an explicit `@vN` suffix. */
  version?: number
}

/** Validates a bare capability id (no version suffix). Throws a descriptive Error on any violation — callers convert to the appropriate registry error. */
export function assertValidCapabilityId(id: string): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Capability id must be a non-empty string.")
  }
  if (id.length > MAX_ID_LENGTH) {
    throw new Error(`Capability id exceeds maximum length of ${MAX_ID_LENGTH}.`)
  }
  if (id.includes("..") || id.includes("/") || id.includes("\\") || id.includes("$") || id.includes(" ")) {
    throw new Error(`Capability id "${id}" contains forbidden characters.`)
  }
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `Capability id "${id}" is invalid. Expected the form "domain.action" (business intent, not implementation detail).`
    )
  }
}

/** Parses `id` or `id@vN` into its parts. Throws on malformed input — never silently defaults a version. */
export function parseCapabilityRef(ref: string): ParsedCapabilityRef {
  if (typeof ref !== "string" || ref.length === 0) {
    throw new Error("Capability reference must be a non-empty string.")
  }
  const atIndex = ref.indexOf("@")
  const idPart = atIndex === -1 ? ref : ref.slice(0, atIndex)
  assertValidCapabilityId(idPart)
  const [domain, action] = idPart.split(".")

  if (atIndex === -1) {
    return { id: idPart, domain, action }
  }

  const versionPart = ref.slice(atIndex + 1)
  const match = /^v([1-9][0-9]{0,4})$/.exec(versionPart)
  if (!match) {
    throw new Error(`Capability version suffix "${versionPart}" is invalid. Expected the form "v1", "v2", etc.`)
  }
  return { id: idPart, domain, action, version: Number(match[1]) }
}

/** Deterministic storage key for one (id, version) pair. */
export function storageKey(id: string, version: number): string {
  return `${id}@v${version}`
}
