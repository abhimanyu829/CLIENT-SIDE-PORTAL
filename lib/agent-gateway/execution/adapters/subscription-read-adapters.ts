/**
 * lib/agent-gateway/execution/adapters/subscription-read-adapters.ts
 *
 * Phase 9 — READ-tier subscription governance adapters. All owner-scoped via
 * the trusted Phase-2 machine identity (`context.ownerId`), never a model
 * argument. Outputs are trimmed to the capability's published output schema —
 * no raw Prisma records, no provider ids, no secrets.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"
import { getCustomerSubscriptionOverview, listCustomerPlans } from "@/lib/services/customer-subscription-view"
import { getEffectiveEntitlements, getLimit } from "@/lib/services/entitlement-resolver"

// ── subscriptions.plans.list ──────────────────────────────────────────────────

export class SubscriptionPlansListAdapter implements AgentCapabilityAdapter<Record<string, never>, { plans: unknown[] }> {
  readonly capabilityId = "subscriptions.plansList"
  readonly capabilityVersion = 1

  async execute(_context: AgentExecutionContext, _input: Record<string, never>): Promise<ExecutionResult<{ plans: unknown[] }>> {
    const startedAt = Date.now()
    const plans = await listCustomerPlans()
    return {
      output: {
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          planType: p.planType,
          currency: p.currency,
          price: p.price,
          billingIntervalMonths: p.billingIntervalMonths,
          versionId: p.versionId,
          items: p.items.map((i) => ({
            itemType: i.itemType,
            itemRefKey: i.itemRefKey,
            limitValue: i.limitValue,
            limitUnit: i.limitUnit,
          })),
        })),
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

// ── subscriptions.summary ─────────────────────────────────────────────────────

export class SubscriptionSummaryAdapter implements AgentCapabilityAdapter<Record<string, never>, unknown> {
  readonly capabilityId = "subscriptions.summary"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, _input: Record<string, never>): Promise<ExecutionResult<unknown>> {
    const startedAt = Date.now()
    const overview = await getCustomerSubscriptionOverview(context.ownerId)
    return {
      output: {
        paidSubscriptions: overview.paidSubscriptions.slice(0, 10).map((s) => ({
          id: s.id,
          status: s.status,
          planName: s.planName,
          planType: s.planType,
          billingIntervalMonths: s.billingIntervalMonths,
          price: s.price,
          currentPeriodEnd: s.currentPeriodEnd,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        })),
        trials: overview.trials.slice(0, 10).map((t) => ({
          id: t.id,
          planName: t.planName,
          status: t.status,
          expiresAt: t.expiresAt,
        })),
        freeForeverActive: overview.freeEnrollments.some((f) => f.status === "ACTIVE"),
        accessKeys: overview.access.entitlementKeys.slice(0, 50),
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

// ── subscriptions.access.explain ──────────────────────────────────────────────

export class SubscriptionAccessExplainAdapter implements AgentCapabilityAdapter<Record<string, never>, unknown> {
  readonly capabilityId = "subscriptions.accessExplain"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, _input: Record<string, never>): Promise<ExecutionResult<unknown>> {
    const startedAt = Date.now()
    const subject = { type: "USER" as const, userId: context.ownerId }
    const [keys, storage, admins] = await Promise.all([
      getEffectiveEntitlements(subject),
      getLimit(subject, "limit.storage"),
      getLimit(subject, "limit.admin_users"),
    ])
    return {
      output: {
        accessKeys: keys.slice(0, 50).map((k) => k.key),
        storageLimit: storage,
        adminLimit: admins,
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

// ── subscriptions.trial.status ────────────────────────────────────────────────

export class SubscriptionTrialStatusAdapter implements AgentCapabilityAdapter<Record<string, never>, unknown> {
  readonly capabilityId = "subscriptions.trialStatus"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, _input: Record<string, never>): Promise<ExecutionResult<unknown>> {
    const startedAt = Date.now()
    const overview = await getCustomerSubscriptionOverview(context.ownerId)
    return {
      output: {
        trials: overview.trials.slice(0, 10).map((t) => ({
          id: t.id,
          planName: t.planName,
          status: t.status,
          startedAt: t.startedAt,
          expiresAt: t.expiresAt,
        })),
        freeForeverActive: overview.freeEnrollments.some((f) => f.status === "ACTIVE"),
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

// ── subscriptions.billing.list ────────────────────────────────────────────────

export class SubscriptionBillingListAdapter implements AgentCapabilityAdapter<Record<string, never>, unknown> {
  readonly capabilityId = "subscriptions.billingHistory"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, _input: Record<string, never>): Promise<ExecutionResult<unknown>> {
    const startedAt = Date.now()
    const overview = await getCustomerSubscriptionOverview(context.ownerId)
    return {
      output: { billing: overview.billing.slice(0, 20) },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

// Shared ownership preflight for mutation adapters (Phase 9 approval path).
export async function assertOwnerSubscription(context: AgentExecutionContext, subscriptionId: unknown): Promise<void> {
  const sub =
    typeof subscriptionId === "string" && subscriptionId
      ? await db.userSubscription.findUnique({ where: { id: subscriptionId }, select: { id: true, userId: true } })
      : null
  if (!sub || sub.userId !== context.ownerId) {
    throw new ExecutionError("RESOURCE_NOT_FOUND", "No subscription exists for the given id.")
  }
}
