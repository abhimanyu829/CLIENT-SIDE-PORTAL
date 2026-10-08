/**
 * lib/services/plan-catalog-service.ts
 *
 * Phase 2 — Plan Catalog & Bundle Composition Engine.
 *
 * The ONLY mutation path for the plan catalog. Provides:
 *   createPlan / getPlan / listPlans
 *   createDraftVersion / updateDraftVersion
 *   addPlanItem / removePlanItem
 *   validatePlan
 *   publishPlan / pausePlan / resumePlan / archivePlan
 *
 * Domain rules enforced here:
 *   - A plan is a COMMERCIAL COMPOSITION of existing resources. It never
 *     duplicates or mutates Product/Service/AIAgent records.
 *   - Published versions are IMMUTABLE. Editing means creating a new DRAFT.
 *   - Status is server-controlled (lifecycle in plan-lifecycle.ts).
 *   - Plan ≠ entitlement: nothing here grants or checks customer access.
 *   - No provider (Razorpay/Stripe) integration, no recurring billing.
 *
 * Explicitly out of scope in Phase 2: entitlement engine, free-tier/trial
 * activation, subscription checkout, provider plan/subscription APIs,
 * customer/admin UI, reconciliation, analytics.
 */

import { z } from "zod"
import { PlanItemType, PlanStatus, PlanType, PlanVersionStatus } from "@prisma/client"
import { db } from "@/lib/db"
import {
  PLAN_CURRENCIES,
  PlanTransitionError,
  PlanValidationError,
  assertPlanTransition,
  assertValidPlanSlug,
  isPlanCurrency,
  isReferentialItemType,
  isSingletonItemType,
  planRequiresItems,
  planRequiresPaidPricing,
  slugifyPlanName,
} from "@/lib/services/plan-lifecycle"

// ── Shared primitives ──────────────────────────────────────────────────────────

const ID = z.string().trim().min(1).max(64)
const SLUG = z.string().trim().min(3).max(80)
const NON_EMPTY = z.string().trim().min(1).max(200)

function assert(condition: unknown, message: string, issues: string[] = []): asserts condition {
  if (!condition) throw new PlanValidationError(message, issues)
}

// Accepts Prisma.Decimal | number | string | null and returns a plain number.
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(n) ? n : null
  }
  return null
}

// ── Validation helpers (pure) ─────────────────────────────────────────────────

export interface PlanValidationIssue {
  field: string
  message: string
}

interface PlanLike {
  name: string
  slug: string
  status: PlanStatus
  planType: PlanType | null
  currency: string
  price: unknown
  durationMonths: number | null
}

interface VersionLike {
  id: string
  version: number
  status: PlanVersionStatus
  price: unknown
  currency: string | null
  billingIntervalMonths: number | null
  durationMonths: number | null
  items: Array<{ id: string; itemType: PlanItemType; itemRefKey: string; limitValue: unknown }>
}

/** Pure validation of a plan header (no DB). Returns issues, never throws. */
export function validatePlanHeader(plan: PlanLike): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = []
  if (!plan.name || typeof plan.name !== "string" || plan.name.trim().length < 2) {
    issues.push({ field: "name", message: "Plan name must be at least 2 characters" })
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plan.slug ?? "")) {
    issues.push({ field: "slug", message: "Plan slug must be lowercase hyphenated" })
  }
  if (!plan.planType) {
    issues.push({ field: "planType", message: "Plan type is required" })
  }
  if (!isPlanCurrency(plan.currency)) {
    issues.push({
      field: "currency",
      message: `Unsupported currency (allowed: ${PLAN_CURRENCIES.join(", ")})`,
    })
  }
  const price = toNumber(plan.price)
  if (price === null || price < 0) {
    issues.push({ field: "price", message: "Base price must be a non-negative number" })
  }
  if (plan.planType && planRequiresPaidPricing(plan.planType) && (price ?? 0) <= 0 && plan.planType !== "CUSTOM" && plan.planType !== "ENTERPRISE") {
    issues.push({ field: "price", message: "Paid plans require a positive base price" })
  }
  if (plan.planType === "FREE" && (price ?? 0) !== 0) {
    issues.push({ field: "price", message: "FREE plans must have a zero price" })
  }
  if (plan.durationMonths !== null && plan.durationMonths !== undefined && plan.durationMonths < 0) {
    issues.push({ field: "durationMonths", message: "Duration cannot be negative" })
  }
  return issues
}

/** Pure validation of a version's composition (no DB). */
export function validateVersionComposition(
  version: VersionLike,
  planType: PlanType | null,
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = []

  const price = toNumber(version.price)
  if (planType && planRequiresPaidPricing(planType) && planType !== "CUSTOM" && planType !== "ENTERPRISE") {
    if (price === null || price <= 0) {
      issues.push({ field: "price", message: "Paid plan versions require a positive price" })
    }
  }
  if (price !== null && price < 0) {
    issues.push({ field: "price", message: "Version price cannot be negative" })
  }
  if (version.billingIntervalMonths !== null && version.billingIntervalMonths !== undefined && version.billingIntervalMonths < 0) {
    issues.push({ field: "billingIntervalMonths", message: "Billing interval cannot be negative" })
  }
  if (version.durationMonths !== null && version.durationMonths !== undefined && version.durationMonths < 0) {
    issues.push({ field: "durationMonths", message: "Duration cannot be negative" })
  }

  if (planType && planRequiresItems(planType) && version.items.length === 0) {
    issues.push({ field: "items", message: "Paid plans require at least one plan item" })
  }

  // Duplicate detection (defense in depth over the DB unique key).
  const seen = new Set<string>()
  for (const item of version.items) {
    const key = `${item.itemType}:${item.itemRefKey}`
    if (seen.has(key)) {
      issues.push({
        field: "items",
        message: `Duplicate plan item ${key}`,
      })
    }
    seen.add(key)

    if (isSingletonItemType(item.itemType) && item.itemType !== PlanItemType.SUPPORT) {
      const limit = toNumber(item.limitValue)
      if (limit === null || limit < 0) {
        issues.push({
          field: `items.${item.itemType}`,
          message: `${item.itemType} requires a non-negative limit value`,
        })
      }
    }
  }
  return issues
}

// ── Input schemas (strict) ────────────────────────────────────────────────────

export const createPlanSchema = z
  .object({
    name: NON_EMPTY,
    slug: SLUG.optional(),
    description: z.string().max(5000).optional(),
    tagline: z.string().max(300).optional(),
    planType: z.nativeEnum(PlanType),
    currency: z.string().trim().min(3).max(3),
    basePrice: z.number().nonnegative().optional(),
    billingIntervalMonths: z.number().int().nonnegative().optional(),
    durationMonths: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

export const updatePlanHeaderSchema = z
  .object({
    name: NON_EMPTY.optional(),
    tagline: z.string().max(300).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict()

export const createVersionSchema = z
  .object({
    price: z.number().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    billingIntervalMonths: z.number().int().nonnegative().optional(),
    durationMonths: z.number().int().nonnegative().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export const updateVersionSchema = z
  .object({
    price: z.number().nonnegative().optional(),
    billingIntervalMonths: z.number().int().nonnegative().optional(),
    durationMonths: z.number().int().nonnegative().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()

export const addPlanItemSchema = z
  .object({
    itemType: z.nativeEnum(PlanItemType),
    /** Referential types: the referenced resource id. Declared types: omit. */
    itemRefId: ID.optional(),
    /** Durable identity within the version. Defaults derived server-side. */
    itemRefKey: z.string().trim().min(1).max(120).optional(),
    label: z.string().trim().max(200).optional(),
    quantity: z.number().int().positive().max(1000).optional(),
    limitValue: z.number().nonnegative().optional(),
    limitUnit: z.string().trim().max(40).optional(),
    config: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict()

export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type CreateVersionInput = z.infer<typeof createVersionSchema>
export type AddPlanItemInput = z.infer<typeof addPlanItemSchema>

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    throw new PlanValidationError(
      `Invalid ${what}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    )
  }
  return parsed.data
}

// ── Read ──────────────────────────────────────────────────────────────────────

const planDetailInclude = {
  versions: {
    orderBy: { version: "desc" as const },
    include: { items: { orderBy: { sortOrder: "asc" as const } } },
  },
}

export async function getPlan(planIdOrSlug: string) {
  if (typeof planIdOrSlug !== "string" || planIdOrSlug.trim() === "") return null
  const byId = await db.subscriptionPlan.findUnique({
    where: { id: planIdOrSlug },
    include: planDetailInclude,
  })
  if (byId) return byId
  return db.subscriptionPlan.findUnique({
    where: { slug: planIdOrSlug },
    include: planDetailInclude,
  })
}

export async function listPlans(filter?: { status?: PlanStatus; planType?: PlanType }): Promise<unknown[]> {
  const where: Record<string, unknown> = {}
  if (filter?.status) where.status = filter.status
  if (filter?.planType) where.planType = filter.planType
  return db.subscriptionPlan.findMany({
    where,
    include: { versions: { orderBy: { version: "desc" }, include: { items: true } } },
    // Deterministic ordering: display order, then name, then stable id.
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Creates a plan in DRAFT with an initial DRAFT version (V1) holding pricing.
 * The legacy required `price` column is mirrored from the base price.
 */
export async function createPlan(rawInput: unknown, actorId: string) {
  const input = parseOrThrow(createPlanSchema, rawInput, "plan input")

  const slug = input.slug ?? slugifyPlanName(input.name)
  assertValidPlanSlug(slug)

  const currency = input.currency.toUpperCase()
  assert(isPlanCurrency(currency), `Unsupported currency: ${input.currency}`)
  if (input.planType === PlanType.FREE && (input.basePrice ?? 0) !== 0) {
    throw new PlanValidationError("FREE plans must have a zero base price")
  }

  const existing = await db.subscriptionPlan.findUnique({ where: { slug } })
  if (existing) {
    throw new PlanValidationError(`Plan slug already exists: ${slug}`)
  }

  return db.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        tagline: input.tagline ?? null,
        planType: input.planType,
        currency: currency as never,
        price: (input.basePrice ?? 0).toFixed(2) as never,
        billingIntervalMonths: input.billingIntervalMonths ?? null,
        durationMonths: input.durationMonths ?? null,
        status: PlanStatus.DRAFT,
        sortOrder: input.sortOrder ?? 0,
        metadata: (input.metadata ?? {}) as never,
      },
    })

    const version = await tx.planVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        status: PlanVersionStatus.DRAFT,
        price: (input.basePrice ?? 0).toFixed(2) as never,
        currency: currency as never,
        billingIntervalMonths: input.billingIntervalMonths ?? null,
        durationMonths: input.durationMonths ?? null,
        createdBy: actorId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "PLAN_CREATED",
        entity: "SubscriptionPlan",
        entityId: plan.id,
        afterJson: { slug, planType: input.planType, version: 1 },
      },
    })

    return { plan, version }
  })
}

/** Updates DRAFT plan header fields only. Published plans stay untouched here. */
export async function updatePlanHeader(planId: string, rawInput: unknown, actorId: string) {
  const input = parseOrThrow(updatePlanHeaderSchema, rawInput, "plan header input")
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)
  if (plan.status === PlanStatus.ARCHIVED) {
    throw new PlanTransitionError("PLAN", plan.status, "EDIT")
  }

  const updated = await db.subscriptionPlan.update({
    where: { id: planId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      catalogRevision: { increment: 1 },
    },
  })

  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_HEADER_UPDATED",
      entity: "SubscriptionPlan",
      entityId: planId,
      beforeJson: { name: plan.name, tagline: plan.tagline },
      afterJson: { name: updated.name, tagline: updated.tagline },
    },
  })
  return updated
}

// ── Versions ──────────────────────────────────────────────────────────────────

export async function createDraftVersion(planId: string, rawInput: unknown, actorId: string) {
  const input = parseOrThrow(createVersionSchema, rawInput, "version input")
  const plan = await db.subscriptionPlan.findUnique({
    where: { id: planId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)
  if (plan.status === PlanStatus.ARCHIVED) {
    throw new PlanTransitionError("PLAN", plan.status, "NEW_VERSION")
  }

  const nextVersion = (plan.versions[0]?.version ?? 0) + 1
  const currency = (input.currency ?? plan.currency).toUpperCase()
  assert(isPlanCurrency(currency), `Unsupported currency: ${input.currency ?? plan.currency}`)

  // Deterministic: at most one DRAFT version may exist at a time.
  const existingDraft = await db.planVersion.findFirst({
    where: { planId, status: PlanVersionStatus.DRAFT },
  })
  if (existingDraft) {
    throw new PlanValidationError(
      `Plan already has a draft version (v${existingDraft.version}); publish or archive it first`,
    )
  }

  const version = await db.planVersion.create({
    data: {
      planId,
      version: nextVersion,
      status: PlanVersionStatus.DRAFT,
      price: (input.price ?? toNumber(plan.price) ?? 0).toFixed(2) as never,
      currency: currency as never,
      billingIntervalMonths: input.billingIntervalMonths ?? plan.billingIntervalMonths ?? null,
      durationMonths: input.durationMonths ?? plan.durationMonths ?? null,
      notes: input.notes ?? null,
      createdBy: actorId,
    },
  })

  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_VERSION_DRAFT_CREATED",
      entity: "PlanVersion",
      entityId: version.id,
      afterJson: { planId, version: nextVersion },
    },
  })
  return version
}

export async function updateDraftVersion(versionId: string, rawInput: unknown, actorId: string) {
  const input = parseOrThrow(updateVersionSchema, rawInput, "version update input")
  const version = await db.planVersion.findUnique({ where: { id: versionId } })
  if (!version) throw new PlanValidationError(`Unknown plan version: ${versionId}`)
  if (version.status !== PlanVersionStatus.DRAFT) {
    throw new PlanValidationError(
      `Plan version v${version.version} is ${version.status}; only DRAFT versions are editable`,
    )
  }

  const updated = await db.planVersion.update({
    where: { id: versionId },
    data: {
      ...(input.price !== undefined ? { price: input.price.toFixed(2) as never } : {}),
      ...(input.billingIntervalMonths !== undefined
        ? { billingIntervalMonths: input.billingIntervalMonths }
        : {}),
      ...(input.durationMonths !== undefined ? { durationMonths: input.durationMonths } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  })

  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_VERSION_DRAFT_UPDATED",
      entity: "PlanVersion",
      entityId: versionId,
      beforeJson: { price: version.price?.toString() ?? null },
      afterJson: { price: updated.price?.toString() ?? null },
    },
  })
  return updated
}

// ── Items ─────────────────────────────────────────────────────────────────────

/** Verifies a referenced resource exists for referential item types. */
async function resolveItemReference(
  itemType: PlanItemType,
  itemRefId: string,
): Promise<{ ok: true; refKey: string } | { ok: false; reason: string }> {
  if (itemType === PlanItemType.PRODUCT) {
    const product = await db.product.findUnique({ where: { id: itemRefId }, select: { id: true } })
    return product ? { ok: true, refKey: itemRefId } : { ok: false, reason: `Unknown product: ${itemRefId}` }
  }
  if (itemType === PlanItemType.SERVICE) {
    const service = await db.servicePage.findUnique({ where: { id: itemRefId }, select: { id: true } })
    return service ? { ok: true, refKey: itemRefId } : { ok: false, reason: `Unknown service: ${itemRefId}` }
  }
  if (itemType === PlanItemType.AI_CAPABILITY) {
    const agent = await db.aIAgent.findUnique({ where: { id: itemRefId }, select: { id: true } })
    return agent ? { ok: true, refKey: itemRefId } : { ok: false, reason: `Unknown AI capability: ${itemRefId}` }
  }
  // Non-referential types cannot carry a resource id.
  return { ok: false, reason: `${itemType} items must not reference a resource id` }
}

export async function addPlanItem(versionId: string, rawInput: unknown, actorId: string) {
  const input = parseOrThrow(addPlanItemSchema, rawInput, "plan item input")

  const version = await db.planVersion.findUnique({
    where: { id: versionId },
    include: { plan: { select: { planType: true, status: true } } },
  })
  if (!version) throw new PlanValidationError(`Unknown plan version: ${versionId}`)
  if (version.status !== PlanVersionStatus.DRAFT) {
    throw new PlanValidationError(
      `Cannot modify items on a ${version.status} version; create a new draft version`,
    )
  }

  const referential = isReferentialItemType(input.itemType)

  if (referential) {
    if (!input.itemRefId) {
      throw new PlanValidationError(`${input.itemType} items require itemRefId`)
    }
    const resolved = await resolveItemReference(input.itemType, input.itemRefId)
    if (!resolved.ok) throw new PlanValidationError(resolved.reason)
  } else if (input.itemRefId) {
    throw new PlanValidationError(`${input.itemType} items must not carry a resource id`)
  }

  // Durable identity within the version: referenced resource id, or the
  // explicit/derived key for declared types.
  const itemRefKey = referential
    ? (input.itemRefId as string)
    : (input.itemRefKey ?? input.itemType.toLowerCase())

  if (isSingletonItemType(input.itemType)) {
    const duplicate = await db.planItem.findFirst({
      where: { planVersionId: versionId, itemType: input.itemType },
    })
    if (duplicate) {
      throw new PlanValidationError(
        `A ${input.itemType} item already exists on this version`,
      )
    }
  } else {
    const duplicate = await db.planItem.findFirst({
      where: { planVersionId: versionId, itemType: input.itemType, itemRefKey },
    })
    if (duplicate) {
      throw new PlanValidationError(
        `Duplicate plan item ${input.itemType}:${itemRefKey}`,
      )
    }
  }

  if (input.limitValue !== undefined && input.limitValue < 0) {
    throw new PlanValidationError("limitValue cannot be negative")
  }

  const item = await db.planItem.create({
    data: {
      planVersionId: versionId,
      itemType: input.itemType,
      itemRefKey,
      itemRefId: referential ? (input.itemRefId as string) : null,
      label: input.label ?? null,
      quantity: input.quantity ?? 1,
      limitValue: input.limitValue !== undefined ? (input.limitValue.toFixed(4) as never) : null,
      limitUnit: input.limitUnit ?? null,
      config: (input.config ?? {}) as never,
      sortOrder: input.sortOrder ?? 0,
    },
  })

  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_ITEM_ADDED",
      entity: "PlanItem",
      entityId: item.id,
      afterJson: { versionId, itemType: input.itemType, itemRefKey },
    },
  })
  return item
}

export async function removePlanItem(itemId: string, actorId: string) {
  const item = await db.planItem.findUnique({
    where: { id: itemId },
    include: { planVersion: { select: { status: true, version: true } } },
  })
  if (!item) throw new PlanValidationError(`Unknown plan item: ${itemId}`)
  if (item.planVersion.status !== PlanVersionStatus.DRAFT) {
    throw new PlanValidationError(
      `Cannot remove items from a ${item.planVersion.status} version; create a new draft version`,
    )
  }

  await db.planItem.delete({ where: { id: itemId } })
  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_ITEM_REMOVED",
      entity: "PlanItem",
      entityId: itemId,
      beforeJson: { itemType: item.itemType, itemRefKey: item.itemRefKey },
    },
  })
  return { removed: true }
}

// ── Validate ──────────────────────────────────────────────────────────────────

/**
 * Validates the plan's current DRAFT version (or the given version) for
 * publishing. Returns the issue list; empty = publishable.
 */
export async function validatePlan(
  planId: string,
  versionId?: string,
): Promise<{ valid: boolean; issues: PlanValidationIssue[] }> {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)

  const version = versionId
    ? await db.planVersion.findUnique({ where: { id: versionId }, include: { items: true } })
    : await db.planVersion.findFirst({
        where: { planId, status: PlanVersionStatus.DRAFT },
        orderBy: { version: "desc" },
        include: { items: true },
      })

  const issues: PlanValidationIssue[] = [
    ...validatePlanHeader({
      name: plan.name,
      slug: plan.slug,
      status: plan.status,
      planType: plan.planType,
      currency: plan.currency,
      price: plan.price,
      durationMonths: plan.durationMonths,
    }),
  ]

  if (!version) {
    issues.push({ field: "version", message: "Plan has no draft version to publish" })
    return { valid: false, issues }
  }
  if (version.planId !== planId) {
    issues.push({ field: "version", message: "Version does not belong to this plan" })
    return { valid: false, issues }
  }

  issues.push(
    ...validateVersionComposition(
      {
        id: version.id,
        version: version.version,
        status: version.status,
        price: version.price,
        currency: version.currency,
        billingIntervalMonths: version.billingIntervalMonths,
        durationMonths: version.durationMonths,
        items: version.items.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          itemRefKey: i.itemRefKey,
          limitValue: i.limitValue,
        })),
      },
      plan.planType,
    ),
  )

  if (version.status !== PlanVersionStatus.DRAFT) {
    issues.push({ field: "version", message: `Version is ${version.status}, not DRAFT` })
  }

  return { valid: issues.length === 0, issues }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Publishes the plan's DRAFT version:
 *  - validates header + composition (fail closed)
 *  - supersedes the currently published version (→ ARCHIVED, immutable, kept)
 *  - publishes the draft (→ PUBLISHED), plan → PUBLISHED, currentVersionId set
 * Compare-and-set on the version status prevents concurrent double publish.
 */
export async function publishPlan(planId: string, actorId: string, versionId?: string) {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)
  assertPlanTransition(plan.status, PlanStatus.PUBLISHED)

  const version = versionId
    ? await db.planVersion.findUnique({ where: { id: versionId } })
    : await db.planVersion.findFirst({
        where: { planId, status: PlanVersionStatus.DRAFT },
        orderBy: { version: "desc" },
      })
  if (!version) throw new PlanValidationError(`No draft version to publish for plan ${planId}`)
  if (version.planId !== planId) {
    throw new PlanValidationError("Version does not belong to this plan")
  }

  const validation = await validatePlan(planId, version.id)
  if (!validation.valid) {
    throw new PlanValidationError(
      `Plan failed validation: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`,
      validation.issues.map((i) => i.message),
    )
  }

  const now = new Date()
  return db.$transaction(async (tx) => {
    // Compare-and-set: only a DRAFT version can be published.
    const cas = await tx.planVersion.updateMany({
      where: { id: version.id, status: PlanVersionStatus.DRAFT },
      data: { status: PlanVersionStatus.PUBLISHED, publishedAt: now },
    })
    if (cas.count !== 1) {
      throw new PlanTransitionError("VERSION", version.status, PlanVersionStatus.PUBLISHED)
    }

    // Supersede the previously published version (kept, immutable).
    await tx.planVersion.updateMany({
      where: {
        planId,
        status: PlanVersionStatus.PUBLISHED,
        id: { not: version.id },
      },
      data: { status: PlanVersionStatus.ARCHIVED, archivedAt: now },
    })

    const updatedPlan = await tx.subscriptionPlan.update({
      where: { id: planId },
      data: {
        status: PlanStatus.PUBLISHED,
        currentVersionId: version.id,
        catalogRevision: { increment: 1 },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "PLAN_PUBLISHED",
        entity: "SubscriptionPlan",
        entityId: planId,
        beforeJson: { status: plan.status, currentVersionId: plan.currentVersionId },
        afterJson: { status: "PUBLISHED", currentVersionId: version.id, version: version.version },
      },
    })

    // Re-read so the caller receives the authoritative published state
    // (the pre-transaction row still reads DRAFT).
    const publishedVersion = await tx.planVersion.findUnique({ where: { id: version.id } })
    return { plan: updatedPlan, version: publishedVersion ?? version }
  })
}

export async function pausePlan(planId: string, actorId: string) {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)
  assertPlanTransition(plan.status, PlanStatus.PAUSED)

  const updated = await db.subscriptionPlan.updateMany({
    where: { id: planId, status: plan.status },
    data: { status: PlanStatus.PAUSED, catalogRevision: { increment: 1 } },
  })
  if (updated.count !== 1) {
    throw new PlanTransitionError("PLAN", plan.status, PlanStatus.PAUSED)
  }

  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_PAUSED",
      entity: "SubscriptionPlan",
      entityId: planId,
      beforeJson: { status: plan.status },
      afterJson: { status: "PAUSED" },
    },
  })
  return { status: PlanStatus.PAUSED }
}

export async function resumePlan(planId: string, actorId: string) {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)
  assertPlanTransition(plan.status, PlanStatus.PUBLISHED)

  const updated = await db.subscriptionPlan.updateMany({
    where: { id: planId, status: plan.status },
    data: { status: PlanStatus.PUBLISHED, catalogRevision: { increment: 1 } },
  })
  if (updated.count !== 1) {
    throw new PlanTransitionError("PLAN", plan.status, PlanStatus.PUBLISHED)
  }

  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "PLAN_RESUMED",
      entity: "SubscriptionPlan",
      entityId: planId,
      beforeJson: { status: plan.status },
      afterJson: { status: "PUBLISHED" },
    },
  })
  return { status: PlanStatus.PUBLISHED }
}

/**
 * Archives a plan: it is no longer offered for new enrollment. NOTHING is
 * deleted — versions, items, historical subscriptions and standalone
 * purchases remain intact. ARCHIVED is terminal.
 */
export async function archivePlan(planId: string, actorId: string) {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanValidationError(`Unknown plan: ${planId}`)
  assertPlanTransition(plan.status, PlanStatus.ARCHIVED)

  const now = new Date()
  return db.$transaction(async (tx) => {
    const updated = await tx.subscriptionPlan.updateMany({
      where: { id: planId, status: plan.status },
      data: { status: PlanStatus.ARCHIVED, catalogRevision: { increment: 1 } },
    })
    if (updated.count !== 1) {
      throw new PlanTransitionError("PLAN", plan.status, PlanStatus.ARCHIVED)
    }

    // Draft versions are archived too; published versions are kept as-is so
    // historical commercial definitions remain readable.
    await tx.planVersion.updateMany({
      where: { planId, status: PlanVersionStatus.DRAFT },
      data: { status: PlanVersionStatus.ARCHIVED, archivedAt: now },
    })

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "PLAN_ARCHIVED",
        entity: "SubscriptionPlan",
        entityId: planId,
        beforeJson: { status: plan.status },
        afterJson: { status: "ARCHIVED" },
      },
    })

    return { status: PlanStatus.ARCHIVED }
  })
}
