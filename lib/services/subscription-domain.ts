/**
 * lib/services/subscription-domain.ts
 *
 * Phase 1 — Subscription Domain Foundation (Option 1: formalize Stack A).
 *
 * Provides the provider-independent foundation contract for the
 * `Subscription` domain WITHOUT rebuilding anything:
 *
 *  - createFoundationSubscription(): validated, server-controlled creation.
 *  - getSubscriptionForOwner(): ownership-checked read (no cross-tenant).
 *  - transitionSubscriptionStatus(): compare-and-set guarded transition,
 *    concurrency-safe and idempotent.
 *
 * Explicitly OUT OF SCOPE in Phase 1 (later phases):
 *  - recurring billing, provider (Razorpay/Stripe) subscription APIs
 *  - entitlement granting (existing checkout/webhook flows keep owning that)
 *  - trials, upgrades/downgrades, renewal processing, customer/admin UI
 *
 * This module NEVER touches Order / Cart / Payment / Invoice. Standalone
 * purchases remain fully independent.
 */

import { z } from "zod"
import { SubStatus, SubscriptionSource } from "@prisma/client"
import { db } from "@/lib/db"
import {
  SubscriptionTransitionError,
  SubscriptionValidationError,
  assertAllowedInitialStatus,
  assertSubscriptionTransition,
  assertValidSubscriptionSource,
  isSubscriptionStatus,
  normalizeSubscriptionEnvironment,
} from "@/lib/services/subscription-state-machine"

// ── Input contract (strict — unknown keys rejected) ───────────────────────────

const NON_EMPTY_STRING = z.string().trim().min(1).max(200)

export const createFoundationSubscriptionSchema = z
  .object({
    /** Existing identity — always a server-resolved User id, never a raw
     *  customer identifier from an untrusted request body. */
    userId: NON_EMPTY_STRING,
    productId: NON_EMPTY_STRING,
    tierId: NON_EMPTY_STRING,
    /** Controlled provenance. Never taken from a request body. */
    source: z.enum([
      "CHECKOUT",
      "STRIPE_WEBHOOK",
      "RAZORPAY_WEBHOOK",
      "ADMIN",
      "SYSTEM",
    ]),
    /** "development" | "test" | "production" */
    environment: z.string().trim().min(1).max(50),
    /** Optional initial status; server default is TRIALING. */
    initialStatus: z.enum(["TRIALING", "ACTIVE"]).optional(),
    currentPeriodStart: z.date().optional(),
    currentPeriodEnd: z.date().optional(),
    /** Optional provider-independent external reference (future phases map
     *  provider IDs onto this). Must NOT be an arbitrary provider blob. */
    externalReference: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

export type CreateFoundationSubscriptionInput = z.infer<
  typeof createFoundationSubscriptionSchema
>

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createFoundationSubscription(
  rawInput: unknown,
): Promise<{ id: string; status: SubStatus; source: SubscriptionSource; environment: string }> {
  const parsed = createFoundationSubscriptionSchema.safeParse(rawInput)
  if (!parsed.success) {
    throw new SubscriptionValidationError(
      `Invalid subscription foundation input: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    )
  }
  const input = parsed.data

  // Normalize / validate controlled fields (defense in depth beyond zod).
  assertValidSubscriptionSource(input.source)
  const environment = normalizeSubscriptionEnvironment(input.environment)
  const initialStatus = input.initialStatus ?? "TRIALING"
  assertAllowedInitialStatus(initialStatus)

  // Referential integrity: owner, product and tier must exist, the tier must
  // belong to the product and be purchasable. Never trust foreign keys.
  const [user, product, tier] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { id: true, isBanned: true } }),
    db.product.findUnique({ where: { id: input.productId }, select: { id: true } }),
    db.productTier.findUnique({
      where: { id: input.tierId },
      select: { id: true, productId: true, isActive: true },
    }),
  ])

  if (!user) throw new SubscriptionValidationError(`Unknown owner: ${input.userId}`)
  if (user.isBanned) throw new SubscriptionValidationError(`Owner is banned: ${input.userId}`)
  if (!product) throw new SubscriptionValidationError(`Unknown product: ${input.productId}`)
  if (!tier) throw new SubscriptionValidationError(`Unknown tier: ${input.tierId}`)
  if (tier.productId !== input.productId) {
    throw new SubscriptionValidationError(
      `Tier ${input.tierId} does not belong to product ${input.productId}`,
    )
  }
  if (!tier.isActive) throw new SubscriptionValidationError(`Tier is inactive: ${input.tierId}`)

  const now = new Date()
  const periodStart = input.currentPeriodStart ?? now
  const periodEnd = input.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (periodEnd <= periodStart) {
    throw new SubscriptionValidationError("currentPeriodEnd must be after currentPeriodStart")
  }

  const created = await db.subscription.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      tierId: input.tierId,
      status: initialStatus,
      source: input.source,
      environment,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      metadata: input.externalReference
        ? { externalReference: input.externalReference }
        : {},
    },
    select: { id: true, status: true, source: true, environment: true },
  })

  return {
    id: created.id,
    status: created.status,
    source: created.source ?? input.source,
    environment: created.environment ?? environment,
  }
}

// ── Ownership-checked read ─────────────────────────────────────────────────────

/**
 * Returns the subscription only when it belongs to `ownerId`.
 * Missing and not-owned are indistinguishable to the caller
 * (anti-enumeration): both return null.
 */
export async function getSubscriptionForOwner(
  subscriptionId: string,
  ownerId: string,
): Promise<{
  id: string
  userId: string
  productId: string
  tierId: string
  status: SubStatus
  source: SubscriptionSource | null
  environment: string | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
} | null> {
  if (typeof subscriptionId !== "string" || subscriptionId.trim() === "") return null
  if (typeof ownerId !== "string" || ownerId.trim() === "") return null

  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      productId: true,
      tierId: true,
      status: true,
      source: true,
      environment: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  })
  if (!sub) return null
  if (sub.userId !== ownerId) return null
  return sub
}

// ── Guarded transition (compare-and-set) ──────────────────────────────────────

/**
 * Performs a controlled status transition with compare-and-set semantics:
 *
 *   UPDATE ... WHERE id = ? AND status = <expectedFrom>
 *
 * Concurrency-safe: two racing transitions from the same expected state
 * cannot both win. Idempotent: if the row is already in `to`, the call
 * succeeds as a no-op (webhook retry safe). Audit-logged inside the same
 * transaction as the status write.
 */
export async function transitionSubscriptionStatus(
  subscriptionId: string,
  expectedFrom: SubStatus,
  to: SubStatus,
  actorId: string,
  reason: string,
): Promise<{ changed: boolean; status: SubStatus }> {
  if (!isSubscriptionStatus(expectedFrom) || !isSubscriptionStatus(to)) {
    throw new SubscriptionValidationError("Invalid status value in transition")
  }
  assertSubscriptionTransition(expectedFrom, to)

  return db.$transaction(async (tx) => {
    const result = await tx.subscription.updateMany({
      where: { id: subscriptionId, status: expectedFrom },
      data: { status: to, updatedAt: new Date() },
    })

    if (result.count === 1) {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "SUBSCRIPTION_STATUS_TRANSITIONED",
          entity: "Subscription",
          entityId: subscriptionId,
          beforeJson: { status: expectedFrom },
          afterJson: { status: to, reason },
        },
      })
      return { changed: true, status: to }
    }

    // CAS lost — inspect current state for idempotent-vs-conflict decision.
    const current = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      select: { status: true },
    })
    if (!current) {
      throw new SubscriptionValidationError(`Unknown subscription: ${subscriptionId}`)
    }
    if (current.status === to) {
      // Already in the desired state — idempotent success.
      return { changed: false, status: current.status }
    }
    // Someone else moved it elsewhere; the requested transition is stale.
    throw new SubscriptionTransitionError(current.status, to)
  })
}
