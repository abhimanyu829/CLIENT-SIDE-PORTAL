/**
 * lib/agent-gateway/capabilities/dangerous-primitive-guard.ts
 *
 * Defense-in-depth static guard applied to every CapabilityDefinition at
 * registration time. Even though no execution engine exists yet (Phase 4),
 * this guard ensures the registry itself can never accept a definition
 * that describes, references, or implies one of the explicitly forbidden
 * primitive classes from the architecture spec — so a future adapter
 * cannot be wired to a dangerous string that slipped through Phase 3
 * unnoticed.
 *
 * This is a STRING/SHAPE scanner only. It does not (and cannot) prove a
 * capability is safe — it proves the registry rejects the specific
 * dangerous patterns explicitly called out as forbidden. Human review of
 * every registered capability (per the exit checklist) remains required.
 */
import type { CapabilityDefinition } from "./types"

/**
 * Case-insensitive substring/word tokens that must never appear in an
 * `adapterKey`, capability `id`, or `domain` — each corresponds directly
 * to a forbidden primitive class from the architecture spec.
 */
const FORBIDDEN_TOKENS: Array<{ token: string; reason: string }> = [
  { token: "eval", reason: "arbitrary code execution (eval)" },
  { token: "function(", reason: "arbitrary code execution (new Function)" },
  { token: "child_process", reason: "shell/process execution" },
  { token: "childprocess", reason: "shell/process execution" },
  { token: "exec", reason: "shell/process execution" },
  { token: "spawn", reason: "shell/process execution" },
  { token: "shell", reason: "shell execution" },
  { token: "sql", reason: "raw SQL access" },
  { token: "rawquery", reason: "raw database query access" },
  { token: "executeraw", reason: "raw database query access" },
  { token: "queryraw", reason: "raw database query access" },
  { token: "prisma", reason: "generic ORM/database access — capabilities must be business-intent, not implementation detail" },
  { token: "database", reason: "generic database access" },
  { token: "require(", reason: "dynamic module require" },
  { token: "import(", reason: "dynamic module import" },
  { token: "fetch", reason: "arbitrary/generic HTTP forwarding" },
  { token: "httprequest", reason: "arbitrary/generic HTTP forwarding" },
  { token: "proxy", reason: "generic API proxying" },
  { token: "fs.", reason: "arbitrary filesystem access" },
  { token: "filesystem", reason: "arbitrary filesystem access" },
  { token: "readfile", reason: "arbitrary filesystem access" },
  { token: "writefile", reason: "arbitrary filesystem access" },
  { token: "process.env", reason: "environment-variable exposure" },
  { token: "env.", reason: "environment-variable exposure" },
]

export class DangerousPrimitiveError extends Error {
  constructor(
    public readonly capabilityId: string,
    public readonly field: string,
    public readonly reason: string
  ) {
    super(
      `Capability "${capabilityId}" was rejected: field "${field}" matches a forbidden primitive class (${reason}). ` +
        "Capabilities must reference explicit, reviewed business operations only — never generic execution primitives."
    )
    this.name = "DangerousPrimitiveError"
  }
}

function scanString(capabilityId: string, field: string, value: string): void {
  const lowered = value.toLowerCase()
  for (const { token, reason } of FORBIDDEN_TOKENS) {
    if (lowered.includes(token)) {
      throw new DangerousPrimitiveError(capabilityId, field, reason)
    }
  }
}

/**
 * Scans a capability definition for forbidden primitive references.
 * Throws `DangerousPrimitiveError` on any match — the registry's
 * `register()` must never catch-and-continue on this, it must reject the
 * definition outright (fail closed).
 *
 * Deliberately scoped to IDENTIFIER fields only (`id`, `domain`,
 * `executionReference.adapterKey`) — never free-text descriptive metadata
 * like `sideEffects.effects` or `description`. The spec's own metadata
 * examples legitimately use words like "database write" or "webhook" as
 * DESCRIPTIONS of consequences, which must not be confused with an
 * executable reference to a dangerous primitive. Scanning identifiers
 * only avoids that false-positive class entirely while still catching the
 * real risk: a capability that references a dangerous primitive as its
 * (future) execution target.
 */
export function assertNoDangerousPrimitives(def: CapabilityDefinition): void {
  scanString(def.id, "id", def.id)
  scanString(def.id, "domain", def.domain)

  if (def.executionReference) {
    scanString(def.id, "executionReference.adapterKey", def.executionReference.adapterKey)
  }
}
