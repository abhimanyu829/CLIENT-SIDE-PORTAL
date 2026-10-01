/**
 * lib/agent-gateway/execution/adapters/subscriptions-list-adapter.ts
 *
 * Phase 13 — capability "subscriptions.list": the connection owner's own
 * subscriptions. Same ownership rule and the same exclusions as
 * subscriptions.get (Phase 4): scoped by `context.ownerId` only; never the
 * payment-gateway subscription ids (`stripeSubId`, `razorpaySubId`) or the
 * unvetted `metadata` bag.
 */
import { db } from "@/lib/db"
import type { SubStatus } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface SubscriptionsListInput {
  status?: string
  limit?: number
}

export interface SubscriptionsListOutput {
  items: Array<{ id: string; status: string; planId: string; productId: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean }>
}

const LIMIT_CAP = 50
const SUB_STATUSES = new Set(["ACTIVE", "CANCELLED", "PAST_DUE", "TRIALING", "PAUSED"])

export class SubscriptionsListAdapter implements AgentCapabilityAdapter<SubscriptionsListInput, SubscriptionsListOutput> {
  readonly capabilityId = "subscriptions.list"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: SubscriptionsListInput): Promise<ExecutionResult<SubscriptionsListOutput>> {
    const startedAt = Date.now()
    if (input.status !== undefined && !SUB_STATUSES.has(input.status)) {
      throw new ExecutionError("INVALID_INPUT", `Unsupported subscription status: "${input.status}".`)
    }
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    const rows = await db.subscription.findMany({
      where: { userId: context.ownerId, ...(input.status ? { status: input.status as SubStatus } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(input.limit ?? 20, LIMIT_CAP),
      select: { id: true, status: true, tierId: true, productId: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    })
    return {
      output: {
        items: rows.map((s) => ({
          id: s.id,
          status: s.status,
          planId: s.tierId,
          productId: s.productId,
          currentPeriodEnd: s.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        })),
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
