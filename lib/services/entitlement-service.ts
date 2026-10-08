/**
 * lib/services/entitlement-service.ts
 *
 * Phase 3 — Entitlement Engine. The ONLY mutation path for entitlement
 * definitions and grants. Backend/domain only; no HTTP routes.
 *
 * Guarantees:
 *  - subject (user/team) is verified server-side — never trusted from input
 *  - source + sourceReference are validated, not arbitrary
 *  - grants are idempotent (deterministic dedupeKey; duplicates collapse)
 *  - status changes go through the controlled grant machine
 *  - revoke/suspend/restore are audited and invalidate the effective cache
 *  - expired/revoked/suspended grants never resolve to access
 *
 * Out of scope (later phases): Razorpay/billing, auto subscription
 * provisioning, free/trial engines, customer/admin UI, reconciliation.
 */

import { z } from "zod"
import {
  EntitlementScope,
  EntitlementSourceType,
  EntitlementSubjectType,
  EntitlementType,
  GrantStatus,
} from "@prisma/client"
import { db } from "@/lib/db"
import {
  EntitlementError,
  assertGrantStatusTransition,
  assertValidEntitlementKey,
  buildGrantDedupeKey,
  isEntitlementScope,
  isEntitlementSourceType,
  isEntitlementType,
} from "@/lib/services/entitlement-lifecycle"
import {
  EntitlementSubject,
  invalidateEntitlementCache,
} from "@/lib/services/entitlement-resolver"

// ── Schemas (strict) ──────────────────────────────────────────────────────────

const ID = z.string().trim().min(1).max(64)
const KEY = z.string().trim().min(3).max(120)

export const createDefinitionSchema = z
  .object({
    key: KEY,
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    type: z.nativeEnum(EntitlementType),
    resourceType: z.string().trim().max(80).optional(),
    configuration: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

export const grantEntitlementSchema = z
  .object({
    entitlementKey: KEY,
    subjectType: z.nativeEnum(EntitlementSubjectType),
    /** Server-resolved for the trusted caller; validated to exist below. */
    subjectUserId: ID.optional(),
    subjectTeamId: ID.optional(),
    sourceType: z.nativeEnum(EntitlementSourceType),
    sourceReference: z.string().trim().min(1).max(120),
    scope: z.nativeEnum(EntitlementScope).optional(),
    resourceType: z.string().trim().max(80).optional(),
    resourceId: ID.optional(),
    quantity: z.number().int().positive().max(1_000_000).optional(),
    limitValue: z.number().nonnegative().optional(),
    limitUnit: z.string().trim().max(40).optional(),
    startsAt: z.date().optional(),
    expiresAt: z.date().optional(),
    configuration: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

export type CreateDefinitionInput = z.infer<typeof createDefinitionSchema>
export type GrantEntitlementInput = z.infer<typeof grantEntitlementSchema>

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    throw new EntitlementError(
      "INVALID_ENTITLEMENT",
      `Invalid ${what}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    )
  }
  return parsed.data
}

// ── Definitions ───────────────────────────────────────────────────────────────

export async function createDefinition(rawInput: unknown, actorId: string) {
  const input = parseOrThrow(createDefinitionSchema, rawInput, "entitlement definition")
  assertValidEntitlementKey(input.key)
  if (!isEntitlementType(input.type)) {
    throw new EntitlementError("INVALID_ENTITLEMENT", `Invalid entitlement type: ${input.type}`)
  }

  const existing = await db.entitlementDefinition.findUnique({ where: { key: input.key } })
  if (existing) {
    throw new EntitlementError("DUPLICATE_GRANT", `Entitlement definition already exists: ${input.key}`)
  }

  const definition = await db.entitlementDefinition.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      resourceType: input.resourceType ?? null,
      configuration: (input.configuration ?? {}) as never,
      metadata: (input.metadata ?? {}) as never,
    },
  })

  await audit(actorId, "ENTITLEMENT_DEFINITION_CREATED", definition.id, {
    key: input.key,
    type: input.type,
  })
  return definition
}

export async function getDefinition(keyOrId: string) {
  if (typeof keyOrId !== "string" || keyOrId.trim() === "") return null
  const byKey = await db.entitlementDefinition.findUnique({ where: { key: keyOrId } })
  if (byKey) return byKey
  return db.entitlementDefinition.findUnique({ where: { id: keyOrId } })
}

export async function listDefinitions(filter?: {
  type?: EntitlementType
  isActive?: boolean
}): Promise<unknown[]> {
  const where: Record<string, unknown> = {}
  if (filter?.type) where.type = filter.type
  if (typeof filter?.isActive === "boolean") where.isActive = filter.isActive
  return db.entitlementDefinition.findMany({
    where,
    orderBy: [{ key: "asc" }],
  })
}

export async function setDefinitionActive(id: string, isActive: boolean, actorId: string) {
  const definition = await db.entitlementDefinition.findUnique({ where: { id } })
  if (!definition) throw new EntitlementError("ENTITLEMENT_NOT_FOUND", `Unknown definition: ${id}`)
  const updated = await db.entitlementDefinition.update({
    where: { id },
    data: { isActive: Boolean(isActive) },
  })
  await audit(actorId, "ENTITLEMENT_DEFINITION_STATUS_CHANGED", id, { isActive: Boolean(isActive) })
  return updated
}

// ── Grants ────────────────────────────────────────────────────────────────────

function subjectOf(input: GrantEntitlementInput): EntitlementSubject {
  if (input.subjectType === EntitlementSubjectType.USER) {
    if (!input.subjectUserId || input.subjectTeamId) {
      throw new EntitlementError("INVALID_ENTITLEMENT", "USER grants require subjectUserId only")
    }
    return { type: "USER", userId: input.subjectUserId }
  }
  if (!input.subjectTeamId || input.subjectUserId) {
    throw new EntitlementError("INVALID_ENTITLEMENT", "TEAM grants require subjectTeamId only")
  }
  return { type: "TEAM", teamId: input.subjectTeamId }
}

/**
 * Creates a grant idempotently. Same (entitlement, subject, source,
 * sourceReference, scope, resource) → returns the existing grant instead of
 * creating a duplicate (webhook/retry safe).
 */
export async function grantEntitlement(rawInput: unknown, actorId: string) {
  const input = parseOrThrow(grantEntitlementSchema, rawInput, "entitlement grant")
  assertValidEntitlementKey(input.entitlementKey)
  if (!isEntitlementSourceType(input.sourceType)) {
    throw new EntitlementError("INVALID_SOURCE", `Invalid source type: ${input.sourceType}`)
  }
  const scope = input.scope ?? EntitlementScope.OWNER
  if (!isEntitlementScope(scope)) {
    throw new EntitlementError("INVALID_ENTITLEMENT", `Invalid scope: ${scope}`)
  }

  const subject = subjectOf(input)

  // Referential existence — never trust ids from input.
  if (subject.type === "USER") {
    const user = await db.user.findUnique({
      where: { id: subject.userId },
      select: { id: true, isBanned: true },
    })
    if (!user) throw new EntitlementError("INVALID_ENTITLEMENT", `Unknown user: ${subject.userId}`)
    if (user.isBanned) {
      throw new EntitlementError("UNAUTHORIZED_GRANT", `User is banned: ${subject.userId}`)
    }
  } else {
    const team = await db.team.findUnique({ where: { id: subject.teamId }, select: { id: true } })
    if (!team) throw new EntitlementError("INVALID_ENTITLEMENT", `Unknown team: ${subject.teamId}`)
  }

  const definition = await db.entitlementDefinition.findUnique({
    where: { key: input.entitlementKey },
  })
  if (!definition) {
    throw new EntitlementError(
      "ENTITLEMENT_NOT_FOUND",
      `Unknown entitlement definition: ${input.entitlementKey}`,
    )
  }
  if (!definition.isActive) {
    throw new EntitlementError(
      "ENTITLEMENT_INACTIVE",
      `Entitlement definition is inactive: ${input.entitlementKey}`,
    )
  }

  // Scope/resource consistency.
  if (scope === EntitlementScope.RESOURCE && !input.resourceId) {
    throw new EntitlementError("INVALID_ENTITLEMENT", "RESOURCE scope requires resourceId")
  }
  if (scope !== EntitlementScope.RESOURCE && input.resourceId) {
    throw new EntitlementError(
      "INVALID_ENTITLEMENT",
      "resourceId is only valid with RESOURCE scope",
    )
  }

  // Time validity.
  const startsAt = input.startsAt ?? new Date()
  if (input.expiresAt && input.expiresAt.getTime() <= startsAt.getTime()) {
    throw new EntitlementError("INVALID_ENTITLEMENT", "expiresAt must be after startsAt")
  }

  const dedupeKey = buildGrantDedupeKey({
    entitlementKey: input.entitlementKey,
    subjectType: input.subjectType,
    subjectUserId: input.subjectUserId ?? null,
    subjectTeamId: input.subjectTeamId ?? null,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    scope,
    resourceId: input.resourceId ?? null,
  })

  const existing = await db.entitlementGrant.findUnique({ where: { dedupeKey } })
  if (existing) {
    // Idempotent: identical provisioning request already granted.
    return existing
  }

  const grant = await db.entitlementGrant.create({
    data: {
      entitlementDefinitionId: definition.id,
      entitlementKey: input.entitlementKey,
      subjectType: input.subjectType,
      subjectUserId: input.subjectUserId ?? null,
      subjectTeamId: input.subjectTeamId ?? null,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      scope,
      resourceType: input.resourceType ?? definition.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      quantity: input.quantity ?? null,
      limitValue: input.limitValue !== undefined ? (input.limitValue.toFixed(4) as never) : null,
      limitUnit: input.limitUnit ?? null,
      status: GrantStatus.ACTIVE,
      startsAt,
      expiresAt: input.expiresAt ?? null,
      configuration: (input.configuration ?? {}) as never,
      dedupeKey,
      metadata: (input.metadata ?? {}) as never,
    },
  })

  await audit(actorId, "ENTITLEMENT_GRANTED", grant.id, {
    key: input.entitlementKey,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
  })
  await invalidateEntitlementCache(subject)
  return grant
}

export async function getGrant(grantId: string) {
  if (typeof grantId !== "string" || grantId.trim() === "") return null
  return db.entitlementGrant.findUnique({ where: { id: grantId } })
}

async function transitionGrant(
  grantId: string,
  to: GrantStatus,
  actorId: string,
  action: string,
  reason: string,
) {
  const grant = await db.entitlementGrant.findUnique({ where: { id: grantId } })
  if (!grant) throw new EntitlementError("ENTITLEMENT_NOT_FOUND", `Unknown grant: ${grantId}`)
  assertGrantStatusTransition(grant.status as GrantStatus, to)

  const result = await db.entitlementGrant.updateMany({
    where: { id: grantId, status: grant.status },
    data: { status: to },
  })
  if (result.count !== 1) {
    throw new EntitlementError("CONFLICT", `Grant ${grantId} state changed concurrently`)
  }

  const subject: EntitlementSubject =
    grant.subjectType === "TEAM"
      ? { type: "TEAM", teamId: grant.subjectTeamId as string }
      : { type: "USER", userId: grant.subjectUserId as string }

  await audit(actorId, action, grantId, { from: grant.status, to, reason })
  await invalidateEntitlementCache(subject)
  return { status: to }
}

export async function revokeEntitlement(grantId: string, actorId: string, reason: string) {
  return transitionGrant(grantId, GrantStatus.REVOKED, actorId, "ENTITLEMENT_REVOKED", reason)
}

export async function suspendEntitlement(grantId: string, actorId: string, reason: string) {
  return transitionGrant(grantId, GrantStatus.SUSPENDED, actorId, "ENTITLEMENT_SUSPENDED", reason)
}

export async function restoreEntitlement(grantId: string, actorId: string, reason: string) {
  return transitionGrant(grantId, GrantStatus.ACTIVE, actorId, "ENTITLEMENT_RESTORED", reason)
}

/**
 * Worker helper: marks ACTIVE grants whose window has passed as EXPIRED.
 * Access checks do NOT depend on this — it is cleanup only.
 */
export async function expireStaleGrants(now: Date = new Date()): Promise<{ expired: number }> {
  const result = await db.entitlementGrant.updateMany({
    where: { status: GrantStatus.ACTIVE, expiresAt: { not: null, lte: now } },
    data: { status: GrantStatus.EXPIRED },
  })
  return { expired: result.count }
}

async function audit(
  actorId: string,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: actorId,
        action,
        entity: "Entitlement",
        entityId,
        afterJson: after as never,
      },
    })
  } catch {
    // Auditing must never break an entitlement operation.
  }
}
