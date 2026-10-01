/**
 * lib/agent-gateway/autonomy/policy-store.ts
 *
 * The ONLY place AgentAutonomyPolicy rows are read or written.
 *
 * NO CACHE, deliberately: the effective policy is read from Postgres on
 * every gated call. An administrator's downgrade (e.g. LIMITED_AUTONOMY ->
 * ASSISTED, or disabling autonomy) therefore takes effect on the very next
 * call — there is no stale-cache window that could permit autonomous
 * execution after a downgrade. The read is a single indexed lookup
 * (connectionId, status).
 *
 * Read failures propagate to the caller, which treats them as
 * POLICY_UNAVAILABLE (fail closed). A missing policy is a normal, valid
 * result (null) that the evaluator maps to the OBSERVE_ONLY default.
 *
 * Write functions are HUMAN-ONLY administrative operations. They are not
 * exposed as agent capabilities, MCP tools, or gateway routes — callers must
 * already have authenticated a human admin (requireSuperAdmin()).
 */
import { db } from "@/lib/db"
import type { RiskTier } from "../capabilities/types"
import { AUTONOMY_LEVELS, RISK_ORDER, type AutonomyLevel, type EffectiveAutonomyPolicy } from "./types"

export async function loadEffectiveAutonomyPolicy(connectionId: string): Promise<EffectiveAutonomyPolicy | null> {
  const row = await db.agentAutonomyPolicy.findFirst({
    where: { connectionId, status: "ACTIVE" },
    orderBy: { version: "desc" },
  })
  if (!row) return null
  return {
    id: row.id,
    connectionId: row.connectionId,
    version: row.version,
    status: row.status,
    autonomyLevel: row.autonomyLevel,
    maxRiskTier: row.maxRiskTier,
    allowedCapabilityIds: row.allowedCapabilityIds,
    approvalRequiredFor: row.approvalRequiredFor,
    environmentScope: row.environmentScope,
    resourceScopeReference: row.resourceScopeReference,
    expiresAt: row.expiresAt,
  }
}

export interface SetAutonomyPolicyInput {
  connectionId: string
  autonomyLevel: AutonomyLevel
  maxRiskTier: RiskTier
  allowedCapabilityIds?: string[]
  approvalRequiredFor?: string[]
  environmentScope?: string[]
  resourceScopeReference?: string | null
  expiresAt?: Date | null
  note?: string
  /** Server-resolved human admin id — never taken from a request body. */
  actorId: string
  /**
   * Phase 10 optimistic concurrency (optional; omitted = previous behaviour):
   * the latest version number the administrator saw (0 when the connection
   * never had a policy). A stale value writes nothing and throws
   * AutonomyConflictError.
   */
  expectedVersion?: number
}

/** Phase 10: an autonomy write based on a stale view (someone else changed it first). */
export class AutonomyConflictError extends Error {
  readonly code = "CONFLICT" as const
  constructor(message = "The autonomy policy was changed by someone else. Reload and try again.") {
    super(message)
    this.name = "AutonomyConflictError"
  }
}

/**
 * Creates version N+1 and supersedes the previous ACTIVE version in one
 * transaction. Historical versions are never edited.
 */
export async function setAutonomyPolicy(input: SetAutonomyPolicyInput): Promise<{ id: string; version: number }> {
  if (!(AUTONOMY_LEVELS as readonly string[]).includes(input.autonomyLevel)) throw new Error("Invalid autonomy level.")
  if (!Object.prototype.hasOwnProperty.call(RISK_ORDER, input.maxRiskTier)) throw new Error("Invalid risk tier.")

  return db.$transaction(async (tx) => {
    const connection = await tx.agentConnection.findUnique({ where: { id: input.connectionId }, select: { id: true } })
    if (!connection) throw new Error("Connection not found.")

    if (input.expectedVersion !== undefined) {
      // Checked before any write: a stale view changes nothing. A concurrent
      // writer that passes the same check loses on the unique (connectionId, version).
      const head = await tx.agentAutonomyPolicy.findFirst({ where: { connectionId: input.connectionId }, orderBy: { version: "desc" }, select: { version: true } })
      if ((head?.version ?? 0) !== input.expectedVersion) throw new AutonomyConflictError()
    }

    await tx.agentAutonomyPolicy.updateMany({
      where: { connectionId: input.connectionId, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    })
    const last = await tx.agentAutonomyPolicy.findFirst({
      where: { connectionId: input.connectionId },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const created = await tx.agentAutonomyPolicy.create({
      data: {
        connectionId: input.connectionId,
        version: (last?.version ?? 0) + 1,
        status: "ACTIVE",
        autonomyLevel: input.autonomyLevel,
        maxRiskTier: input.maxRiskTier,
        allowedCapabilityIds: input.allowedCapabilityIds ?? [],
        approvalRequiredFor: input.approvalRequiredFor ?? [],
        environmentScope: input.environmentScope ?? [],
        resourceScopeReference: input.resourceScopeReference ?? null,
        expiresAt: input.expiresAt ?? null,
        note: input.note,
        createdById: input.actorId,
      },
    }).catch((err: unknown) => {
      if (input.expectedVersion !== undefined && typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        throw new AutonomyConflictError()
      }
      throw err
    })
    return { id: created.id, version: created.version }
  })
}

/**
 * Disables autonomy entirely for a connection (falls back to OBSERVE_ONLY).
 * With `expectedVersion` (Phase 10), only that ACTIVE version is disabled;
 * a different ACTIVE version is a conflict; no ACTIVE version is a no-op.
 */
export async function disableAutonomyPolicy(connectionId: string, expectedVersion?: number): Promise<void> {
  if (expectedVersion === undefined) {
    await db.agentAutonomyPolicy.updateMany({
      where: { connectionId, status: "ACTIVE" },
      data: { status: "DISABLED" },
    })
    return
  }
  const result = await db.agentAutonomyPolicy.updateMany({
    where: { connectionId, status: "ACTIVE", version: expectedVersion },
    data: { status: "DISABLED" },
  })
  if (result.count > 0) return
  const active = await db.agentAutonomyPolicy.findFirst({ where: { connectionId, status: "ACTIVE" }, select: { version: true } })
  if (active) throw new AutonomyConflictError()
}
