/**
 * lib/agent-gateway/execution/idempotency/idempotency-guard.ts
 *
 * Phase 4 idempotency enforcement, driven entirely by Phase 3's
 * already-declared `idempotency` metadata on each `CapabilityDefinition`
 * — this module does not invent a second, conflicting idempotency
 * mechanism. It reuses the EXISTING platform Redis client (Phase 1's
 * `lib/redis.ts`, same instance the connection-status cache and rate
 * limiter already use) as a short-lived replay cache — the authoritative
 * dedupe for any capability that already has its own DB-level uniqueness
 * (e.g. `Order.cartId`, `Coupon.code`) remains that existing DB
 * constraint; this cache protects against the AI-gateway-specific failure
 * mode of a client retrying the exact same gateway request before the
 * first attempt's result was ever returned.
 *
 * Scope: `idempotencyScope` from the capability definition, combined with
 * the CALLER's connectionId (never a client-supplied scope) — the same
 * idempotency key from two different connections is never treated as the
 * same request.
 *
 * Two modes (known-issue fix after Phase 15):
 *
 *   STRICT (the default; the synchronous MCP tool path). This cache is the
 *     ONLY duplicate protection a synchronous keyed write has, so it fails
 *     CLOSED: a Redis error, or no Redis at all in production, refuses the
 *     write before anything runs (UNAVAILABLE). A key is also RESERVED
 *     atomically (SET NX) before the write runs, so two concurrent
 *     identical calls can never both execute: the second sees IN_FLIGHT.
 *     Without Redis outside production (local development, tests) the
 *     previous best-effort behaviour is kept.
 *
 *   BEST_EFFORT (the task worker and recovery). Those paths already have a
 *     durable dedupe of their own (the unique `AgentTask.idempotencyScope`
 *     plus the worker's never-re-dispatch-a-non-idempotent-write rule; one
 *     `AgentRecovery` row per source event), so a Redis outage must not
 *     stop already-admitted work: the cache is consulted for replay and
 *     otherwise fails open, exactly as before.
 */
import { redis } from "@/lib/redis"
import { isProductionDeployment } from "../../config"
import type { CapabilityDefinition } from "../../capabilities/types"
import type { ExecutionResult } from "../contracts/execution-result"

const TTL_SECONDS = 600 // 10 minutes — long enough to absorb a client retry storm, short enough to never become a permanent record (that's the existing DB constraint's job, not this cache's).

export type IdempotencyMode = "STRICT" | "BEST_EFFORT"

function cacheKey(definition: CapabilityDefinition, connectionId: string, idempotencyKey: string): string {
  return `agent-gateway:idem:${definition.id}:${connectionId}:${idempotencyKey}`
}

/** The in-flight reservation for one key (STRICT mode only). */
function reservationKey(definition: CapabilityDefinition, connectionId: string, idempotencyKey: string): string {
  return `agent-gateway:idem-lock:${definition.id}:${connectionId}:${idempotencyKey}`
}

export type IdempotencyOutcome =
  | { kind: "NOT_REQUIRED" }
  | { kind: "REQUIRED_BUT_MISSING" }
  /** Proceed. `reserved` is true when this call now holds the key's in-flight reservation. */
  | { kind: "NEW_KEY"; reserved: boolean }
  | { kind: "REPLAY"; result: ExecutionResult }
  /** STRICT: another call holds the reservation and no result is recorded yet. Do not execute. */
  | { kind: "IN_FLIGHT" }
  /** STRICT: duplicate protection cannot be guaranteed right now. Do not execute. */
  | { kind: "UNAVAILABLE" }

/**
 * Checks whether execution should proceed, be replayed from a prior
 * result, or be refused (missing key; STRICT: in flight or store
 * unavailable). See the file header for the two modes.
 */
export async function checkIdempotency(
  definition: CapabilityDefinition,
  connectionId: string,
  idempotencyKey: string | undefined,
  mode: IdempotencyMode = "STRICT"
): Promise<IdempotencyOutcome> {
  if (!definition.idempotency.requiresIdempotencyKey) {
    return { kind: "NOT_REQUIRED" }
  }
  if (!idempotencyKey) {
    return { kind: "REQUIRED_BUT_MISSING" }
  }
  const strict = mode === "STRICT"
  if (!redis) {
    // No store, no duplicate protection: never silently so in production.
    return strict && isProductionDeployment() ? { kind: "UNAVAILABLE" } : { kind: "NEW_KEY", reserved: false }
  }

  const resultKey = cacheKey(definition, connectionId, idempotencyKey)
  try {
    const cached = await redis.get<ExecutionResult>(resultKey)
    if (cached) return { kind: "REPLAY", result: cached }
  } catch {
    return strict ? { kind: "UNAVAILABLE" } : { kind: "NEW_KEY", reserved: false }
  }
  if (!strict) return { kind: "NEW_KEY", reserved: false }

  // STRICT: reserve the key atomically before anything runs.
  try {
    const acquired = await redis.set(reservationKey(definition, connectionId, idempotencyKey), "1", { nx: true, ex: TTL_SECONDS })
    if (acquired === "OK") return { kind: "NEW_KEY", reserved: true }
  } catch {
    return { kind: "UNAVAILABLE" }
  }
  // Someone else holds the reservation; it may have finished a moment ago.
  try {
    const cached = await redis.get<ExecutionResult>(resultKey)
    if (cached) return { kind: "REPLAY", result: cached }
  } catch {
    return { kind: "UNAVAILABLE" }
  }
  return { kind: "IN_FLIGHT" }
}

/**
 * Records a successful result for replay, then releases this call's
 * reservation (if it holds one). If the result cannot be recorded the
 * reservation is deliberately KEPT until it expires: a retry of the key is
 * then told the request is in flight instead of running the operation a
 * second time. Never throws — the operation itself already succeeded.
 */
export async function recordIdempotencyResult(
  definition: CapabilityDefinition,
  connectionId: string,
  idempotencyKey: string,
  result: ExecutionResult,
  options: { reserved?: boolean } = {}
): Promise<void> {
  if (!redis) return
  try {
    await redis.set(cacheKey(definition, connectionId, idempotencyKey), result, { ex: TTL_SECONDS })
  } catch {
    return
  }
  if (options.reserved) await releaseIdempotencyReservation(definition, connectionId, idempotencyKey)
}

/**
 * Releases a reservation this call holds, so the same key can be retried.
 * Called only when the operation provably did not take effect (refused
 * before dispatch, or a definitive business error). Never throws: a
 * reservation that cannot be released simply expires.
 */
export async function releaseIdempotencyReservation(definition: CapabilityDefinition, connectionId: string, idempotencyKey: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(reservationKey(definition, connectionId, idempotencyKey))
  } catch {
    // Expires with its TTL.
  }
}
