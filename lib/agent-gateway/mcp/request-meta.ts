/**
 * lib/agent-gateway/mcp/request-meta.ts
 *
 * Phase 13 — the idempotency key of a synchronous MCP `tools/call`.
 *
 * MCP has no argument slot for transport concerns, and putting the key in
 * the tool arguments would change the Phase 3 input schema (and the
 * approval binding digest). The key therefore travels in the request's
 * `params._meta` under a namespaced key, exactly like the content-trust
 * annotation travels back in the result's `_meta`:
 *
 *   { "method": "tools/call", "params": { "name": "tickets.create",
 *     "arguments": { ... },
 *     "_meta": { "abhibhideveloper.online/idempotency-key": "ticket-2026-10-01-a" } } }
 *
 * Same format and reservations as `agent_task_submit`'s idempotencyKey
 * (8-128 chars of [A-Za-z0-9._:-]; the trigger. and recovery. prefixes
 * are reserved). The
 * key is always scoped to the calling connection by the resolver.
 */
import { isReservedIdempotencyKey, isValidIdempotencyKey } from "../tasks/ids"

export const IDEMPOTENCY_META_KEY = "abhibhideveloper.online/idempotency-key"

export type MetaIdempotencyKey = { ok: true; key: string | undefined } | { ok: false; message: string }

export function idempotencyKeyFromMeta(meta: unknown): MetaIdempotencyKey {
  if (meta === undefined || meta === null || typeof meta !== "object") return { ok: true, key: undefined }
  const raw = (meta as Record<string, unknown>)[IDEMPOTENCY_META_KEY]
  if (raw === undefined) return { ok: true, key: undefined }
  if (!isValidIdempotencyKey(raw)) return { ok: false, message: `The ${IDEMPOTENCY_META_KEY} value must be 8-128 characters of [A-Za-z0-9._:-].` }
  if (isReservedIdempotencyKey(raw)) return { ok: false, message: "Idempotency keys starting with a reserved prefix (trigger., recovery.) cannot be used." }
  return { ok: true, key: raw }
}
