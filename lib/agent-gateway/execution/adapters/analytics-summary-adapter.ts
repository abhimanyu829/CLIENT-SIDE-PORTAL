/**
 * lib/agent-gateway/execution/adapters/analytics-summary-adapter.ts
 *
 * Phase 13 — capability "analytics.summary": account-level counts for the
 * connection's OWNER only (their subscriptions, their tickets and, when
 * they are a vendor, their products). The same KPIs the existing admin
 * analytics route computes platform-wide (`app/api/analytics/route.ts`:
 * active subscriptions, open tickets, published products), restricted to
 * the owner. Platform-wide analytics are NOT available to agents (admin
 * only; see docs/agent-gateway/phase-13/06-analytics.md).
 *
 * Counts only: no revenue, no other user's data, no identifiers.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface AnalyticsSummaryOutput {
  subscriptions: { active: number; total: number }
  tickets: { open: number; total: number }
  products: { published: number; total: number } | null
}

export class AnalyticsSummaryAdapter implements AgentCapabilityAdapter<Record<string, never>, AnalyticsSummaryOutput> {
  readonly capabilityId = "analytics.summary"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext): Promise<ExecutionResult<AnalyticsSummaryOutput>> {
    const startedAt = Date.now()
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    const owner = context.ownerId
    const [activeSubs, totalSubs, openTickets, totalTickets, vendors] = await Promise.all([
      db.subscription.count({ where: { userId: owner, status: "ACTIVE" } }),
      db.subscription.count({ where: { userId: owner } }),
      db.ticket.count({ where: { clientId: owner, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.ticket.count({ where: { clientId: owner } }),
      db.vendorProfile.findMany({ where: { userId: owner }, select: { id: true }, take: 10 }),
    ])
    let products: AnalyticsSummaryOutput["products"] = null
    if (vendors.length > 0) {
      const vendorIds = vendors.map((v) => v.id)
      const [published, total] = await Promise.all([
        db.product.count({ where: { vendorId: { in: vendorIds }, status: "AVAILABLE" } }),
        db.product.count({ where: { vendorId: { in: vendorIds } } }),
      ])
      products = { published, total }
    }
    return {
      output: { subscriptions: { active: activeSubs, total: totalSubs }, tickets: { open: openTickets, total: totalTickets }, products },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
