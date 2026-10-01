/**
 * lib/agent-gateway/security/secret-patterns.ts
 *
 * Phase 12 — the ONE definition of "credential-shaped text" for the agent
 * platform. Used by the audit ledger's metadata redaction (Phase 11) and by
 * the agent output guard (Phase 12), so the two can never drift apart.
 *
 * Every pattern is global and only ever used with String.prototype.replace
 * (stateless). Patterns are anchored on well-known prefixes or shapes; the
 * generic rule (40+ hex characters) catches raw signing secrets (64 hex),
 * API keys and raw digests. No identifier the platform shows to agents
 * (cuid ids, "apr_"/"atk_"/"trg_" refs = 32 hex) reaches that length.
 */

export type SecretKind =
  | "GATEWAY_TOKEN"
  | "JWT"
  | "PRIVATE_KEY"
  | "STRIPE_KEY"
  | "RAZORPAY_KEY"
  | "WEBHOOK_SECRET"
  | "AWS_ACCESS_KEY"
  | "GITHUB_TOKEN"
  | "SLACK_TOKEN"
  | "URL_CREDENTIALS"
  | "LONG_HEX"

const PATTERNS: ReadonlyArray<{ kind: SecretKind; pattern: RegExp }> = [
  { kind: "GATEWAY_TOKEN", pattern: /agw_[0-9a-f]{16,}/gi },
  { kind: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g },
  { kind: "PRIVATE_KEY", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  { kind: "STRIPE_KEY", pattern: /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}/g },
  { kind: "RAZORPAY_KEY", pattern: /\brzp_(live|test)_[A-Za-z0-9]{6,}/g },
  { kind: "WEBHOOK_SECRET", pattern: /\bwhsec_[A-Za-z0-9]{8,}/g },
  { kind: "AWS_ACCESS_KEY", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "GITHUB_TOKEN", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { kind: "SLACK_TOKEN", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: "URL_CREDENTIALS", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@/gi },
  { kind: "LONG_HEX", pattern: /\b[0-9a-f]{40,}\b/gi },
]

export const REDACTED = "[redacted]"

export interface ScrubResult {
  value: string
  redacted: number
  kinds: SecretKind[]
}

/** Replaces every credential-shaped substring. Pure; never throws for a string input. */
export function scrubSecrets(value: string): ScrubResult {
  let redacted = 0
  const kinds = new Set<SecretKind>()
  let out = value
  for (const { kind, pattern } of PATTERNS) {
    out = out.replace(pattern, () => {
      redacted += 1
      kinds.add(kind)
      return REDACTED
    })
  }
  return { value: out, redacted, kinds: Array.from(kinds) }
}

/** True when the string contains anything credential-shaped. */
export function containsSecret(value: string): boolean {
  return scrubSecrets(value).redacted > 0
}

export const SECRET_KINDS: readonly SecretKind[] = PATTERNS.map((p) => p.kind)
