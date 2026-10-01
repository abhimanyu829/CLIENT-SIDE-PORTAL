/**
 * lib/agent-gateway/authorization/policy-store.ts
 *
 * The ONLY place `AgentPolicy`/`AgentPolicyVersion` rows are read.
 * Reuses the EXISTING Prisma client (lib/db.ts) — no new database.
 *
 * CACHE DESIGN (explicit, per the spec's "define cache key, TTL,
 * invalidation strategy, version token, fail-closed behavior" requirement):
 *
 *   - What is cached: the RESOLVED POLICY DATA SET (the list of currently
 *     ACTIVE/enabled policy versions), never an authorization DECISION.
 *     Decisions are always freshly computed by engine.ts from whatever
 *     policy data this store returns — there is no "decision cache"
 *     anywhere in this codebase, so a stale cache entry can only ever
 *     make the ENGINE re-evaluate against slightly-stale POLICY DATA, not
 *     replay a stale ALLOW verdict directly.
 *   - Cache key: `agent-gateway:policy-set:v1` (a single global key — the
 *     full active policy set is small; per-capability sub-keys would add
 *     complexity without a demonstrated need at this data volume).
 *   - TTL: 30 seconds — same fixed, short, non-configurable TTL as Phase 2's
 *     connection-cache.ts, for the same reason (a security-relevant cache
 *     must not be configurable to an accidentally-too-long value).
 *   - Invalidation: `invalidatePolicyCache()` MUST be called by every
 *     policy write path (create/update/disable/version/rollback) —
 *     mirroring connection-cache.ts's "every lifecycle mutation calls
 *     invalidate() before returning" convention exactly.
 *   - Fail-open on cache MISS or Redis unavailable: falls through to a
 *     real DB read — this cache is a performance optimization only, never
 *     the sole source of truth (same posture as connection-cache.ts,
 *     for the same reason: the database is always the authoritative
 *     fallback).
 *   - Fail-CLOSED on DB unavailable: if BOTH the cache miss/unavailable
 *     AND the DB read itself throws, `loadActivePolicySet()` rethrows
 *     rather than returning an empty/partial set silently — engine.ts's
 *     caller (authorizer.ts) treats that thrown error as
 *     POLICY_UNAVAILABLE, which is enforced identically to DENY. There is
 *     NO code path in this module that converts a load failure into an
 *     empty policy set that would look like "no policy exists, but I'm
 *     still allowed to proceed" — an empty set from a genuine "nobody
 *     configured any policy yet" state is a valid signal (correctly
 *     leads to DEFAULT_DENY_NO_POLICY inside engine.ts); an empty set from
 *     "the DB call actually failed" would look identical to the engine
 *     and is NOT distinguished at that layer — so this module never lets
 *     a real failure masquerade as "empty," instead throwing so the
 *     caller can classify it as POLICY_UNAVAILABLE specifically.
 */
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { redis } from "@/lib/redis"
import type { ResolvedPolicyVersion, PolicyEffect, PolicyScope, PolicyVersionStatus } from "./types"
import type { RiskTier } from "../capabilities/types"
import { assertWellFormedCondition } from "./policy-language"
import type { ConditionNode } from "./types"

const CACHE_KEY = "agent-gateway:policy-set:v1"
const TTL_SECONDS = 30

interface CachedPolicySet {
  versions: ResolvedPolicyVersion[]
}

async function getCachedPolicySet(): Promise<ResolvedPolicyVersion[] | null> {
  if (!redis) return null
  try {
    const value = await redis.get<CachedPolicySet>(CACHE_KEY)
    return value?.versions ?? null
  } catch {
    return null // fail-open — fall through to DB
  }
}

async function setCachedPolicySet(versions: ResolvedPolicyVersion[]): Promise<void> {
  if (!redis) return
  try {
    await redis.set(CACHE_KEY, { versions }, { ex: TTL_SECONDS })
  } catch {
    // Best-effort — a cache write failure must never block the caller.
  }
}

/** MUST be called by every policy write path (create/update/disable/new-version/rollback). */
export async function invalidatePolicyCache(): Promise<void> {
  if (!redis) return
  try {
    await redis.del(CACHE_KEY)
  } catch {
    // Best-effort — see module docstring: TTL bounds the staleness window
    // even if this delete fails.
  }
}

function toResolvedPolicyVersion(row: {
  id: string
  version: number
  status: string
  effect: string
  scope: string
  scopeValue: string | null
  capabilityId: string | null
  conditions: unknown
  riskConstraint: string | null
  approvalRequirement: boolean
  policyId: string
  policy: { name: string; enabled: boolean; priority: number }
}): ResolvedPolicyVersion {
  return {
    policyId: row.policyId,
    policyVersionId: row.id,
    version: row.version,
    policyName: row.policy.name,
    policyEnabled: row.policy.enabled,
    policyPriority: row.policy.priority,
    status: row.status as PolicyVersionStatus,
    effect: row.effect as PolicyEffect,
    scope: row.scope as PolicyScope,
    scopeValue: row.scopeValue,
    capabilityId: row.capabilityId,
    conditions: (row.conditions as ConditionNode | null) ?? null,
    riskConstraint: (row.riskConstraint as RiskTier | null) ?? null,
    approvalRequirement: row.approvalRequirement,
  }
}

/**
 * Loads every currently-live policy version (status=ACTIVE, on an
 * enabled AgentPolicy) — the full candidate set engine.ts's `evaluate()`
 * filters/matches against. Fail-open on cache, fail-CLOSED on a genuine
 * DB failure (see module docstring).
 */
export async function loadActivePolicySet(): Promise<ResolvedPolicyVersion[]> {
  const cached = await getCachedPolicySet()
  if (cached) return cached

  // No try/catch here deliberately — a DB failure propagates to the
  // caller (authorizer.ts), which converts it to POLICY_UNAVAILABLE and
  // enforces it as a deny. See module docstring's fail-closed rationale.
  const rows = await db.agentPolicyVersion.findMany({
    where: { status: "ACTIVE", policy: { enabled: true } },
    include: { policy: { select: { name: true, enabled: true, priority: true } } },
  })

  const versions = rows.map(toResolvedPolicyVersion)
  await setCachedPolicySet(versions)
  return versions
}

// ── Write path (policy administration — HUMAN-only, see rbac-bridge.ts / 06-rbac-separation.md) ──

export interface CreatePolicyVersionInput {
  policyId?: string // omit to create a brand-new AgentPolicy
  name?: string // required when policyId is omitted
  description?: string
  enabled?: boolean
  priority?: number
  effect: PolicyEffect
  scope: PolicyScope
  scopeValue?: string | null
  capabilityId?: string | null
  conditions?: ConditionNode | null
  riskConstraint?: RiskTier | null
  approvalRequirement?: boolean
  note?: string
  actorId: string
  /**
   * Phase 10 optimistic concurrency (optional; omitted = previous behaviour).
   * The latest version number the administrator was looking at. When it is
   * no longer the latest, nothing is written and PolicyConflictError is thrown.
   */
  expectedCurrentVersion?: number
}

/** Phase 10: a policy write based on a stale view (someone else published first). */
export class PolicyConflictError extends Error {
  readonly code = "CONFLICT" as const
  constructor(message = "The policy was changed by someone else. Reload and try again.") {
    super(message)
    this.name = "PolicyConflictError"
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

/**
 * Creates a new immutable policy version (and, if `policyId` is omitted,
 * a brand-new `AgentPolicy` parent), then repoints `currentVersionId`.
 * NEVER updates a previously-created `AgentPolicyVersion` row — "changing
 * a policy" always means creating version N+1 and marking version N
 * `SUPERSEDED`, preserving full history per the spec's versioning
 * requirements.
 *
 * This function is NEVER exposed as an agent-callable capability (see
 * docs/agent-gateway/phase-6/06-rbac-separation.md's "Human Admin
 * Override" section) — it is intended to be called only from a trusted,
 * human-authorized administrative code path (a Phase 10 governance UI or
 * an internal script), which must itself have already verified the actor
 * via the EXISTING requireSuperAdmin()/requireAdmin() before calling this,
 * exactly the same convention Phase 2's `AgentConnectionService.create()`
 * already follows.
 */
export async function createPolicyVersion(input: CreatePolicyVersionInput): Promise<{ policyId: string; policyVersionId: string; version: number }> {
  if (input.conditions !== undefined) {
    assertWellFormedCondition(input.conditions) // throws on malformed input — never silently stored
  }

  const result = await db.$transaction(async (tx) => {
    let policyId = input.policyId

    if (policyId && input.expectedCurrentVersion !== undefined) {
      // Checked before any write: a stale view changes nothing.
      const head = await tx.agentPolicyVersion.findFirst({ where: { policyId }, orderBy: { version: "desc" }, select: { version: true } })
      if ((head?.version ?? 0) !== input.expectedCurrentVersion) throw new PolicyConflictError()
    }

    if (!policyId) {
      if (!input.name) throw new Error("name is required when creating a new policy.")
      const policy = await tx.agentPolicy.create({
        data: {
          name: input.name,
          description: input.description,
          enabled: input.enabled ?? true,
          priority: input.priority ?? 0,
          createdById: input.actorId,
        },
      })
      policyId = policy.id
    } else {
      // Supersede the previous ACTIVE version(s) for this policy — a
      // policy has at most one ACTIVE version at a time by convention
      // (currentVersionId always points at it).
      await tx.agentPolicyVersion.updateMany({
        where: { policyId, status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      })
    }

    const lastVersion = await tx.agentPolicyVersion.findFirst({
      where: { policyId },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const nextVersion = (lastVersion?.version ?? 0) + 1

    const created = await tx.agentPolicyVersion
      .create({
        data: {
          policyId,
          version: nextVersion,
          status: "ACTIVE",
          effect: input.effect,
          scope: input.scope,
          scopeValue: input.scopeValue ?? null,
          capabilityId: input.capabilityId ?? null,
          conditions: input.conditions === undefined || input.conditions === null ? Prisma.JsonNull : (input.conditions as object),
          riskConstraint: input.riskConstraint ?? null,
          approvalRequirement: input.approvalRequirement ?? false,
          note: input.note,
          createdById: input.actorId,
        },
      })
      .catch((err: unknown) => {
        // (policyId, version) is unique: a concurrent publisher took this version number.
        if (input.expectedCurrentVersion !== undefined && isUniqueViolation(err)) throw new PolicyConflictError()
        throw err
      })

    await tx.agentPolicy.update({ where: { id: policyId }, data: { currentVersionId: created.id } })

    return { policyId, policyVersionId: created.id, version: created.version }
  })

  await invalidatePolicyCache()
  return result
}

/** Disables a policy (kill switch) — takes effect on the next cache read (bounded by the 30s TTL, or immediately after invalidation). */
export async function disablePolicy(policyId: string): Promise<void> {
  await db.agentPolicy.update({ where: { id: policyId }, data: { enabled: false } })
  await invalidatePolicyCache()
}

/** Re-enables a previously-disabled policy. */
export async function enablePolicy(policyId: string): Promise<void> {
  await db.agentPolicy.update({ where: { id: policyId }, data: { enabled: true } })
  await invalidatePolicyCache()
}

/**
 * Rolls back to a specific previous version by creating a NEW version
 * (never resurrecting the old row) whose fields are copied from the
 * target historical version — preserving the "no silent mutation of
 * historical policy" guarantee even during rollback.
 */
export async function rollbackToVersion(
  policyId: string,
  targetVersion: number,
  actorId: string,
  expectedCurrentVersion?: number
): Promise<{ policyVersionId: string; version: number }> {
  const target = await db.agentPolicyVersion.findUnique({ where: { policyId_version: { policyId, version: targetVersion } } })
  if (!target) throw new Error(`No version ${targetVersion} exists for policy "${policyId}".`)

  const result = await createPolicyVersion({
    policyId,
    effect: target.effect as PolicyEffect,
    scope: target.scope as PolicyScope,
    scopeValue: target.scopeValue,
    capabilityId: target.capabilityId,
    conditions: (target.conditions as ConditionNode | null) ?? null,
    riskConstraint: target.riskConstraint as RiskTier | null,
    approvalRequirement: target.approvalRequirement,
    note: `Rollback to version ${targetVersion}.`,
    actorId,
    expectedCurrentVersion,
  })
  return { policyVersionId: result.policyVersionId, version: result.version }
}
