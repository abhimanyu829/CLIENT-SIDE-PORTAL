/**
 * lib/agent-gateway/execution/idempotency/idempotency-guard.ts
 *
 * Phase 4 idempotency enforcement, driven entirely by Phase 3's
 * already-declared `idempotency` metadata on each `CapabilityDefinition`
 * — this module does not invent a second, conflicting idempotency
 * mechanism. It reuses the EXISTING platform Redis client (Phase 1's
 * `lib/redis.ts`, same instance the connection-status cache and rate
 * limiter already use) purely as a short-lived replay cache — the
 * authoritative dedupe for any capability that already has its own
 * DB-level uniqueness (e.g. `Order.cartId`, `Coupon.code`) remains that
 * existing DB constraint; this cache only protects against the AI-gateway
 * -specific failure mode of a client retrying the exact same gateway
 * request before the first attempt's result was ever returned.
 *
 * Scope: `idempotencyScope` from the capability definition, combined with
 * the CALLER's connectionId (never a client-supplied scope) — this is
 * what "derive a safe execution scope" means here: the same idempotency
 * key from two different connections is never treated as the same
 * request.
 */
import { redis } from "@/lib/redis"
import type { CapabilityDefinition } from "../../capabilities/types"
import type { ExecutionResult } from "../contracts/execution-result"

const TTL_SECONDS = 600 // 10 minutes — long enough to absorb a client retry storm, short enough to never become a permanent record (that's the existing DB constraint's job, not this cache's).

function cacheKey(definition: CapabilityDefinition, connectionId: string, idempotencyKey: string): string {
  return `agent-gateway:idem:${definition.id}:${connectionId}:${idempotencyKey}`
}

export type IdempotencyOutcome =
  | { kind: "NOT_REQUIRED" }
  | { kind: "REQUIRED_BUT_MISSING" }
  | { kind: "NEW_KEY" }
  | { kind: "REPLAY"; result: ExecutionResult }

/**
 * Checks whether execution should proceed, be replayed from a prior
 * result, or be rejected for a missing required key.
 *
 * Fails OPEN (treats as `NOT_REQUIRED`/`NEW_KEY`, i.e. lets execution
 * proceed) when Redis is unavailable — deliberately different from
 * Phase 1's rate-limiter/replay-protection (which fail closed, since
 * those are security controls). This cache is a best-effort dedupe
 * convenience; the underlying existing service's own DB-level uniqueness
 * (where it exists) remains the real safety net for non-idempotent
 * mutations, matching Phase 2's connection-status-cache precedent for
 * "performance/convenience cache, DB/service is still authoritative."
 */
export async function checkIdempotency(
  definition: CapabilityDefinition,
  connectionId: string,
  idempotencyKey: string | undefined
): Promise<IdempotencyOutcome> {
  if (!definition.idempotency.requiresIdempotencyKey) {
    return { kind: "NOT_REQUIRED" }
  }
  if (!idempotencyKey) {
    return { kind: "REQUIRED_BUT_MISSING" }
  }
  if (!redis) {
    return { kind: "NEW_KEY" }
  }

  try {
    const cached = await redis.get<ExecutionResult>(cacheKey(definition, connectionId, idempotencyKey))
    if (cached) {
      return { kind: "REPLAY", result: cached }
    }
  } catch {
    // Fail open — see doc comment above.
  }
  return { kind: "NEW_KEY" }
}

export async function recordIdempotencyResult(
  definition: CapabilityDefinition,
  connectionId: string,
  idempotencyKey: string,
  result: ExecutionResult
): Promise<void> {
  if (!redis) return
  try {
    await redis.set(cacheKey(definition, connectionId, idempotencyKey), result, { ex: TTL_SECONDS })
  } catch {
    // Best-effort only — see doc comment above. A failed cache write never
    // fails the request that already succeeded against the real service.
  }
}
