/**
 * lib/agent-gateway/audit-ledger/redaction.ts
 *
 * Phase 11 — what may enter the ledger.
 *
 * The ledger is evidence, so its contents are as constrained as its
 * structure:
 *   - identifier columns must look like identifiers (no free text);
 *   - digest columns must be 64-hex SHA-256 digests;
 *   - metadata keys are an explicit allowlist; anything else is dropped;
 *   - metadata strings are bounded and scrubbed of anything that looks
 *     like a credential (bearer tokens, JWTs, private keys, long hex runs
 *     such as signing secrets, connection strings).
 * Nothing here can turn a value into a secret-bearing one: the functions
 * only drop or replace.
 */
import type { AuditMetadata, AuditMetadataValue } from "./types"

const IDENTIFIER = /^[A-Za-z0-9_.:@/-]{1,200}$/
const DIGEST = /^[0-9a-f]{64}$/
const CODE = /^[A-Za-z0-9_.:-]{1,128}$/

/** Metadata keys the ledger accepts. Everything else is dropped. */
const METADATA_KEYS = new Set([
  "reasonCode",
  "detailCode",
  "durationMs",
  "attempt",
  "approvalState",
  "origin",
  "source",
  "idempotencyReplay",
  "suppressedCount",
  "statusFrom",
  "statusTo",
  "policyId",
  "policyVersion",
  "effect",
  "scope",
  "target",
  "stage",
  "previousStage",
  "cohortSize",
  "percentage",
  "environments",
  "healthy",
  "failedChecks",
  "kind",
  "passed",
  "evidenceRef",
  "recoveryRef",
  "recoveryClass",
  "recoveryCapabilityId",
  "recoveryInput",
  "residualEffects",
  "manualRecoveryRequired",
  "breakerScope",
  "breakerKey",
  "failureCount",
  "signals",
  "fields",
  "classification",
  "redactedCount",
  "verifiedFrom",
  "verifiedTo",
  "brokenAt",
  "registryFingerprint",
  "capabilityCount",
  "reason",
  "levelFrom",
  "levelTo",
  "maxRiskTier",
  "runRef",
  "created",
  "retryable",
  "jobId",
  "decision",
])

/** Keys whose value may be a small flat object of primitives (identifiers only). */
const OBJECT_KEYS = new Set(["recoveryInput"])

const MAX_STRING = 256
const MAX_ARRAY = 20
const MAX_OBJECT_KEYS = 10

const SECRET_PATTERNS: RegExp[] = [
  /agw_[0-9a-f]{16,}/gi, // gateway bearer tokens
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, // JWTs
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}/g,
  /\brzp_(live|test)_[A-Za-z0-9]{6,}/g,
  /\bwhsec_[A-Za-z0-9]{8,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@/gi, // credentials in URLs
  /\b[0-9a-f]{40,}\b/gi, // long hex runs: signing secrets, keys, raw digests
]

/** Replaces anything credential-shaped. Returns the scrubbed string and how many replacements were made. */
export function scrubSecretLikeText(value: string): { value: string; redacted: number } {
  let redacted = 0
  let out = value
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, () => {
      redacted += 1
      return "[redacted]"
    })
  }
  return { value: out, redacted }
}

export function safeIdentifier(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return IDENTIFIER.test(value) && scrubSecretLikeText(value).redacted === 0 ? value : null
}

export function safeCode(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return CODE.test(value) ? value : null
}

export function safeDigest(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return DIGEST.test(value) ? value : null
}

function boundedString(value: string): string {
  // Postgres text/jsonb cannot hold NUL; strip it rather than fail the append.
  const scrubbed = scrubSecretLikeText(value.replace(/\u0000/g, "")).value
  return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…` : scrubbed
}

function sanitizeValue(key: string, value: AuditMetadataValue): AuditMetadataValue | undefined {
  if (value === null) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string") return boundedString(value)
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY)
      .filter((v): v is string => typeof v === "string")
      .map(boundedString)
  }
  if (typeof value === "object" && OBJECT_KEYS.has(key)) {
    const out: Record<string, string | number | boolean | null> = {}
    for (const [k, v] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k)) continue
      if (v === null || typeof v === "boolean") out[k] = v
      else if (typeof v === "number" && Number.isFinite(v)) out[k] = v
      else if (typeof v === "string" && IDENTIFIER.test(v) && scrubSecretLikeText(v).redacted === 0) out[k] = v
    }
    return out
  }
  return undefined
}

/** Allowlisted, bounded, scrubbed metadata — or null when nothing survives. */
export function sanitizeAuditMetadata(metadata: AuditMetadata | undefined): Record<string, AuditMetadataValue> | null {
  if (!metadata) return null
  const out: Record<string, AuditMetadataValue> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || !METADATA_KEYS.has(key)) continue
    const clean = sanitizeValue(key, value)
    if (clean !== undefined) out[key] = clean
  }
  return Object.keys(out).length > 0 ? out : null
}
