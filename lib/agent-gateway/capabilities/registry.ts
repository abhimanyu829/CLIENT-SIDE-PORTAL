/**
 * lib/agent-gateway/capabilities/registry.ts
 *
 * The Capability Registry — the authoritative, immutable-to-callers,
 * fail-closed store of `CapabilityDefinition`s.
 *
 * This is a REGISTRY, not an executor. `register()` is called only at
 * trusted, in-repo manifest-load time (see manifest.ts / index.ts) — it is
 * never reachable from a request handler, an external caller, or Phase 4+
 * business logic. There is deliberately no public "update" or "mutate"
 * operation: to change a capability's contract you register a NEW
 * version, per the phase's versioning rule ("no silent breaking changes").
 */
import type { CapabilityDefinition } from "./types"
import { CapabilityError } from "./errors"
import { assertValidCapabilityId, parseCapabilityRef, storageKey } from "./id"
import { assertNoDangerousPrimitives } from "./dangerous-primitive-guard"
import { validateAgainstSchema } from "./schema-validation"
import { assertValidRecoverySpec } from "../recovery/spec"
import { inspectAgentInput } from "../security/input-hygiene"

/**
 * Structural validation applied to every definition before it is ever
 * stored. Throws `CapabilityError` (never a raw Error) on any violation —
 * a malformed manifest entry must never be silently skipped or partially
 * registered (fail closed).
 */
/** Wraps id.ts's plain-Error-throwing validators so every failure surfaces as the registry's own CapabilityError contract, never a raw Error. */
function assertValidCapabilityIdOrThrow(id: string, code: "INVALID_INPUT" | "CAPABILITY_NOT_FOUND" = "INVALID_INPUT"): void {
  try {
    assertValidCapabilityId(id)
  } catch (err) {
    throw new CapabilityError(code, err instanceof Error ? err.message : "Invalid capability id.")
  }
}

/** Same wrapping for parseCapabilityRef. */
function parseCapabilityRefOrThrow(ref: string): ReturnType<typeof parseCapabilityRef> {
  try {
    return parseCapabilityRef(ref)
  } catch (err) {
    throw new CapabilityError("INVALID_INPUT", err instanceof Error ? err.message : "Invalid capability reference.")
  }
}

/**
 * Deep-freezes a definition's plain-object/array metadata fields so no
 * caller can mutate stored state after registration — `Object.freeze`
 * alone is shallow and would leave nested objects (permission, resource,
 * sideEffects, etc.) mutable. Deliberately does NOT recurse into
 * `inputSchema`/`outputSchema` (zod `ZodType` instances) — those are
 * library objects with their own internal state/methods and must not be
 * frozen, only referenced immutably from the registry's point of view.
 */
function freezeDefinition(def: CapabilityDefinition): CapabilityDefinition {
  const copy: CapabilityDefinition = { ...def }
  for (const key of Object.keys(copy) as Array<keyof CapabilityDefinition>) {
    if (key === "inputSchema" || key === "outputSchema") continue
    const value = copy[key]
    if (value && typeof value === "object") {
      deepFreezePlainValue(value)
    }
  }
  return Object.freeze(copy)
}

function deepFreezePlainValue(value: unknown): void {
  if (value === null || typeof value !== "object") return
  if (Object.isFrozen(value)) return
  Object.freeze(value)
  for (const key of Object.getOwnPropertyNames(value)) {
    const child = (value as Record<string, unknown>)[key]
    if (child && typeof child === "object") {
      deepFreezePlainValue(child)
    }
  }
}

function assertWellFormed(def: CapabilityDefinition): void {
  assertValidCapabilityIdOrThrow(def.id)

  if (!Number.isInteger(def.version) || def.version < 1) {
    throw new CapabilityError("INVALID_VERSION", `Capability "${def.id}" has an invalid version: ${def.version}.`)
  }

  const validRiskTiers = ["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"]
  if (!validRiskTiers.includes(def.operationType)) {
    throw new CapabilityError(
      "UNSUPPORTED_OPERATION",
      `Capability "${def.id}" has an unsupported riskTier/operationType: ${String(def.operationType)}.`
    )
  }

  const validExposures = ["PUBLIC_DISCOVERABLE", "INTERNAL_ONLY", "AGENT_AVAILABLE", "DISABLED", "DEPRECATED", "FORBIDDEN"]
  if (!validExposures.includes(def.exposure)) {
    throw new CapabilityError(
      "UNSUPPORTED_OPERATION",
      `Capability "${def.id}" has an unsupported exposure level: ${String(def.exposure)}.`
    )
  }

  // FORBIDDEN capabilities must never carry an execution reference — this
  // is the registry's structural guarantee that a permanently-excluded
  // operation (Phase 0 AI_BLOCKED / CRITICAL tier) can never accidentally
  // become wireable in a later phase just because a manifest author left
  // a stale adapterKey in place.
  if (def.exposure === "FORBIDDEN" && def.executionReference !== null) {
    throw new CapabilityError(
      "FORBIDDEN",
      `Capability "${def.id}" is exposure=FORBIDDEN but has a non-null executionReference. FORBIDDEN capabilities must never be executable.`
    )
  }

  // Every non-FORBIDDEN, non-DISABLED capability that is meant to
  // eventually be invocable must declare an input schema — "missing input
  // schema for an executable operation" is an explicit rejection per spec.
  const requiresInputSchema = def.exposure !== "FORBIDDEN" && def.exposure !== "DISABLED"
  if (requiresInputSchema && def.inputSchema === null) {
    throw new CapabilityError(
      "INVALID_INPUT",
      `Capability "${def.id}" is exposure=${def.exposure} but has no inputSchema. Every non-forbidden, non-disabled capability must declare one.`
    )
  }

  // Execution reference format check (defense in depth beyond the
  // dangerous-primitive scan — the adapterKey itself must be a valid
  // capability-id-shaped string, never an arbitrary string).
  if (def.executionReference) {
    assertValidCapabilityIdOrThrow(def.executionReference.adapterKey)
  }

  // Phase 8: async support may only be declared on something that can
  // actually execute. A FORBIDDEN/DISABLED/unwired capability declaring it
  // is a manifest error, rejected rather than silently ignored.
  if (def.async.asyncSupported) {
    if (def.exposure === "FORBIDDEN" || def.exposure === "DISABLED" || def.status === "DISABLED" || def.executionReference === null) {
      throw new CapabilityError(
        "INVALID_INPUT",
        `Capability "${def.id}" declares asyncSupported but is not executable (exposure=${def.exposure}, status=${def.status}, executionReference=${def.executionReference ? "set" : "null"}).`
      )
    }
  }

  assertNoDangerousPrimitives(def)

  // Phase 12: a content-trust declaration must be one of the two known classes.
  if (def.contentTrust !== undefined && def.contentTrust !== "SYSTEM_GENERATED" && def.contentTrust !== "THIRD_PARTY_CONTENT") {
    throw new CapabilityError("INVALID_INPUT", `Capability "${def.id}" declares an unknown contentTrust "${String(def.contentTrust)}".`)
  }

  // Phase 11: a declared recovery mapping must be explicit and well formed.
  try {
    assertValidRecoverySpec(def)
  } catch (err) {
    throw new CapabilityError("INVALID_INPUT", err instanceof Error ? err.message : `Capability "${def.id}" has an invalid recovery specification.`)
  }
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>()
  /** Insertion order, preserved for deterministic `list()` ordering — never dependent on Map iteration quirks across engines. */
  private readonly insertionOrder: string[] = []

  /**
   * Registers a new capability definition. Rejects (throws
   * `CapabilityError`, never silently ignores):
   *   - malformed/invalid definitions (id, version, risk tier, exposure)
   *   - duplicate (id, version) pairs
   *   - dangerous execution references
   *   - missing input schema for an executable operation
   */
  register(def: CapabilityDefinition): void {
    assertWellFormed(def)

    const key = storageKey(def.id, def.version)
    if (this.definitions.has(key)) {
      throw new CapabilityError("CONFLICT", `Capability "${key}" is already registered. Duplicate registration is rejected.`)
    }

    // Store a deep-frozen copy so a caller mutating the object they passed
    // in — or a caller mutating any nested metadata object obtained from
    // resolve()/get() later — cannot retroactively change the registry's
    // stored definition. The registry's own state is the sole source of
    // truth (Object.freeze alone is shallow and would leave nested
    // objects like `permission`/`resource`/`sideEffects` mutable).
    this.definitions.set(key, freezeDefinition(def))
    this.insertionOrder.push(key)
  }

  /** True if any version of `id` is registered (and the `id` string itself is well-formed). */
  has(id: string): boolean {
    try {
      assertValidCapabilityId(id)
    } catch {
      return false
    }
    for (const key of this.insertionOrder) {
      if (key.startsWith(`${id}@v`)) return true
    }
    return false
  }

  /**
   * Resolves the definition for `ref`, which may be a bare id
   * ("products.list") or an id@version ("products.list@v2"). When no
   * version is given, resolves the HIGHEST registered version number
   * deterministically — never "most recently registered" (which would be
   * ordering-dependent and non-deterministic across manifest edits).
   *
   * Fails closed: never returns a DISABLED capability, throws
   * CAPABILITY_DISABLED instead. DEPRECATED capabilities ARE returned
   * (callers get an explicit deprecation signal), but are never chosen as
   * the "latest" when a newer, non-deprecated version exists.
   */
  resolve(ref: string): CapabilityDefinition {
    const parsed = parseCapabilityRefOrThrow(ref)

    if (parsed.version !== undefined) {
      const def = this.definitions.get(storageKey(parsed.id, parsed.version))
      if (!def) {
        throw new CapabilityError("CAPABILITY_NOT_FOUND", `Capability "${ref}" was not found.`)
      }
      if (def.status === "DISABLED" || def.exposure === "DISABLED") {
        throw new CapabilityError("CAPABILITY_DISABLED", `Capability "${ref}" is disabled.`)
      }
      return def
    }

    const versions = this.allVersions(parsed.id)
    if (versions.length === 0) {
      throw new CapabilityError("CAPABILITY_NOT_FOUND", `Capability "${parsed.id}" was not found.`)
    }

    // Prefer the highest-numbered, non-deprecated, non-disabled version.
    const preferred = versions
      .filter((d) => d.status !== "DEPRECATED" && d.status !== "DISABLED" && d.exposure !== "DISABLED")
      .sort((a, b) => b.version - a.version)[0]

    if (preferred) return preferred

    // Every version is deprecated/disabled — resolve the highest version
    // anyway so the caller gets a clear, actionable signal instead of a
    // bare not-found, but still fail closed on DISABLED specifically.
    const highest = versions.sort((a, b) => b.version - a.version)[0]
    if (highest.status === "DISABLED" || highest.exposure === "DISABLED") {
      throw new CapabilityError("CAPABILITY_DISABLED", `Capability "${parsed.id}" is disabled.`)
    }
    return highest
  }

  /** Returns the definition for an exact (id, version) pair, or null. Does NOT throw on missing/disabled — callers that want fail-closed behavior should use `resolve()`. */
  getVersion(id: string, version: number): CapabilityDefinition | null {
    return this.definitions.get(storageKey(id, version)) ?? null
  }

  /** Alias of resolve() without a version, returning null instead of throwing on not-found OR disabled — for existence-checking call sites that don't want exceptions and treat "disabled" the same as "absent" for their purposes (e.g. MCP tool projection). */
  get(id: string): CapabilityDefinition | null {
    try {
      return this.resolve(id)
    } catch (err) {
      if (err instanceof CapabilityError && (err.code === "CAPABILITY_NOT_FOUND" || err.code === "CAPABILITY_DISABLED")) return null
      throw err
    }
  }

  private allVersions(id: string): CapabilityDefinition[] {
    const out: CapabilityDefinition[] = []
    for (const key of this.insertionOrder) {
      const def = this.definitions.get(key)
      if (def && def.id === id) out.push(def)
    }
    return out
  }

  /**
   * Lists all registered definitions in deterministic insertion order.
   * `includeDisabled`/`includeForbidden` default to false — most callers
   * (future discovery consumers) should not see disabled/forbidden
   * entries by default; explicit opt-in is required to see them (e.g. an
   * internal audit tool).
   */
  list(options?: { includeDisabled?: boolean; includeForbidden?: boolean }): CapabilityDefinition[] {
    const includeDisabled = options?.includeDisabled ?? false
    const includeForbidden = options?.includeForbidden ?? false
    const out: CapabilityDefinition[] = []
    for (const key of this.insertionOrder) {
      const def = this.definitions.get(key)
      if (!def) continue
      if (!includeDisabled && (def.status === "DISABLED" || def.exposure === "DISABLED")) continue
      if (!includeForbidden && def.exposure === "FORBIDDEN") continue
      out.push(def)
    }
    return out
  }

  /**
   * Validates `input` against the resolved capability's inputSchema.
   * Never executes anything — purely a schema-validation convenience that
   * combines resolve() + validateAgainstSchema() for callers (Phase 4+)
   * that want one call.
   */
  validateInput(ref: string, input: unknown): unknown {
    const def = this.resolve(ref)
    if (def.exposure === "FORBIDDEN") {
      throw new CapabilityError("FORBIDDEN", `Capability "${ref}" is forbidden and cannot accept input.`)
    }
    if (!def.inputSchema) {
      throw new CapabilityError("INVALID_INPUT", `Capability "${ref}" has no inputSchema to validate against.`)
    }
    // Phase 12: structural hygiene first (control / bidi / tag characters,
    // prototype keys, structural bombs) — it only ever rejects more.
    const hygiene = inspectAgentInput(input)
    if (!hygiene.ok) {
      throw new CapabilityError(
        "INVALID_INPUT",
        `Input for capability "${ref}" contains characters or structure that are not accepted (${hygiene.reason}).`,
        { hygiene: hygiene.reason, path: hygiene.path }
      )
    }
    return validateAgainstSchema(def.inputSchema, input, `Input for capability "${ref}"`)
  }

  /**
   * Marks a capability version DEPRECATED in place. This is a controlled,
   * manifest-load-time-only operation (same trust boundary as `register`)
   * — never reachable from a runtime request. Deprecating does not remove
   * the definition; `resolve()` still returns it explicitly but excludes
   * it from "latest" selection once a newer active version exists.
   */
  deprecate(id: string, version: number): void {
    const key = storageKey(id, version)
    const def = this.definitions.get(key)
    if (!def) {
      throw new CapabilityError("CAPABILITY_NOT_FOUND", `Capability "${key}" was not found.`)
    }
    this.definitions.set(key, freezeDefinition({ ...def, status: "DEPRECATED" as const }))
  }

  /**
   * Disables a capability version in place. Same trust boundary as
   * `register`/`deprecate`. A disabled capability's removal is
   * "fail-closed": `resolve()` throws CAPABILITY_DISABLED rather than
   * falling back to a different version silently.
   */
  disable(id: string, version: number): void {
    const key = storageKey(id, version)
    const def = this.definitions.get(key)
    if (!def) {
      throw new CapabilityError("CAPABILITY_NOT_FOUND", `Capability "${key}" was not found.`)
    }
    this.definitions.set(key, freezeDefinition({ ...def, status: "DISABLED" as const }))
  }
}
