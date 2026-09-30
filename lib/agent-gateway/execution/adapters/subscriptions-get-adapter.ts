/**
 * lib/agent-gateway/execution/adapters/subscriptions-get-adapter.ts
 *
 * Binds capability "subscriptions.get" to the existing Subscription model
 * access pattern. There is no dedicated `GET /api/subscriptions/[id]`
 * route in this codebase — the ownership-check-then-fetch pattern this
 * adapter uses is the SAME pattern already duplicated across
 * `app/api/subscriptions/[id]/{cancel,pause,resume,upgrade,downgrade}/route.ts`,
 * not a new implementation invented for Phase 4.
 *
 * Ownership is enforced using the TRUSTED Phase 2 machine identity's
 * `ownerId` (`context.ownerId`) — never a client-supplied field. This
 * adapter deliberately does NOT call the existing `auth()`/`requireAdmin()`
 * helpers: those depend on a real Clerk human session, which a machine
 * caller never has (see Phase 4 audit — `auth()` would simply return
 * `null` for every agent request). The trusted machine ownerId IS the
 * "minimum compatible trusted machine principal" the Phase 4 spec
 * requires adapters to construct from Phase 2 identity.
 *
 * Not-found and not-owned are both normalized to the SAME
 * `RESOURCE_NOT_FOUND` error — matching the tighter of the two
 * inconsistent behaviors found in the existing action routes (cancel/
 * resume return 404 for both cases; pause returns a distinguishing 403).
 * An AI-facing read must never leak whether a given subscription id
 * exists but belongs to someone else.
 *
 * Explicitly excluded from the output, per the Phase 4 audit: `stripeSubId`,
 * `razorpaySubId` (raw payment-gateway subscription identifiers), and
 * `metadata` (an unvetted internal Json bag) — none of the existing routes
 * that read this model apply this exclusion themselves, so this adapter's
 * own `select` is the first place in the codebase this filtering is
 * enforced for a Subscription read.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface SubscriptionsGetInput {
  subscriptionId: string
}

export interface SubscriptionSummary {
  id: string
  status: string
  planId: string
}

export class SubscriptionsGetAdapter implements AgentCapabilityAdapter<SubscriptionsGetInput, SubscriptionSummary> {
  readonly capabilityId = "subscriptions.get"
  readonly capabilityVersion = 1

  async execute(
    context: AgentExecutionContext,
    input: SubscriptionsGetInput
  ): Promise<ExecutionResult<SubscriptionSummary>> {
    const startedAt = Date.now()

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    // Same ownership-check-then-fetch shape as the existing action routes,
    // with an explicit select that excludes payment-gateway identifiers
    // and the unvetted metadata bag.
    const subscription = await db.subscription.findUnique({
      where: { id: input.subscriptionId },
      select: { id: true, userId: true, status: true, tierId: true },
    })

    if (!subscription || subscription.userId !== context.ownerId) {
      // Not-found and not-owned deliberately produce the identical error
      // — see file header. context.ownerId is the trusted Phase 2
      // identity, never a client-supplied field.
      throw new ExecutionError("RESOURCE_NOT_FOUND", "No subscription exists for the given id.")
    }

    return {
      output: { id: subscription.id, status: subscription.status, planId: subscription.tierId },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}
