/**
 * lib/agent-gateway/triggers/secrets.ts
 *
 * Webhook signing. Reuses the gateway's existing HMAC-SHA256 primitives
 * (shared/crypto.ts), the existing `x-abhibhi-*` header family, and the
 * existing secret-at-rest mechanism (lib/encryption.ts AES-256-GCM, exactly
 * how Phase 2 stores signing secrets). The per-trigger secret is shown once
 * at provisioning / rotation and never again.
 *
 * Canonical message (newline-joined, in this order):
 *   abhibhi.webhook.v1
 *   <timestamp>        unix seconds or ISO-8601, within the allowed clock skew
 *   <nonce>            single use (Redis, fails closed)
 *   <eventId>          sender's event identity (dedup key)
 *   <METHOD>
 *   <path>             e.g. /api/agent-webhooks/trg_...
 *   <sha256(body)>
 * Unlike the Phase 1 request signature, the nonce and event id are INSIDE the
 * signed message, so neither can be swapped on a captured request.
 */
import { randomBytes } from "crypto"
import { decrypt, encrypt } from "@/lib/encryption"
import { constantTimeEqual, hmacSha256Hex, sha256Hex } from "../shared/crypto"

export const WEBHOOK_HEADERS = {
  timestamp: "x-abhibhi-timestamp",
  nonce: "x-abhibhi-nonce",
  eventId: "x-abhibhi-event-id",
  signature: "x-abhibhi-signature",
} as const

export interface WebhookSignatureParts {
  timestamp: string
  nonce: string
  eventId: string
  method: string
  path: string
  body: string
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`
}

export function sealWebhookSecret(secret: string): string {
  return encrypt(secret)
}

export function openWebhookSecret(sealed: string): string {
  return decrypt(sealed)
}

export function webhookCanonicalMessage(parts: WebhookSignatureParts): string {
  return ["abhibhi.webhook.v1", parts.timestamp, parts.nonce, parts.eventId, parts.method.toUpperCase(), parts.path, sha256Hex(parts.body)].join("\n")
}

/** What a sender computes (documented for integrators; used by the tests). */
export function signWebhook(secret: string, parts: WebhookSignatureParts): string {
  return hmacSha256Hex(secret, webhookCanonicalMessage(parts))
}

export function verifyWebhookSignature(secret: string, parts: WebhookSignatureParts, signature: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false
  return constantTimeEqual(signWebhook(secret, parts), signature.toLowerCase())
}

/** Accepts unix seconds or ISO-8601. */
export function parseWebhookTimestamp(timestamp: string): number | null {
  if (/^\d{1,12}$/.test(timestamp)) return Number(timestamp)
  const ms = Date.parse(timestamp)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}
