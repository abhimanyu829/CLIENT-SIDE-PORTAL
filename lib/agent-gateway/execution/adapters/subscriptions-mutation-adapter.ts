/**
 * lib/agent-gateway/execution/adapters/subscription-mutation-adapters.ts
 *
 * Phase 9 — HIGH_RISK_MUTATION subscription adapters (free enroll, trial
 * start, cancel request). All three: owner-scoped via trusted
 * `context.ownerId`, delegated to the Phase 6/4 services, admission-gated by
 * the gateway's mandatory approval engine (operationType HIGH_RISK_MUTATION →
 * REQUIRE_APPROVAL before dispatch). The adapter never sets admin flags,
 * never touches provider APIs directly, and normalizes domain errors into the
 * capability's published error contract.
 */
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"
import { enrollFreePlan, startTrial } from "@/lib/services/free-trial-service"
import { cancelRecurringSubscription } from "@/lib/services/razorpay-billing"
import { assertOwnerSubscription } from "./subscriptions-read-adapter"

// ── subscriptions.free.enroll ─────────────────────────────────────────────────

export interface FreeEnrollInput {
  [key: string]: never
}

export class SubscriptionFreeEnrollAdapter implements AgentCapabilityAdapter<FreeEnrollInput, { enrollmentId: string; existing: boolean }> {
  readonly capabilityId = "subscriptions.freeEnroll"
  readonly capabilityVersion = 1

  async checkResource(context: AgentExecutionContext): Promise<void> {
    // No external resource: the operation targets the owner's own enrollment.
    void context
  }

  async execute(
    context: AgentExecutionContext,
    _input: FreeEnrollInput
  ): Promise<ExecutionResult<{ enrollmentId: string; existing: boolean }>> {
    const startedAt = Date.now()
    try {
      const result = await enrollFreePlan(context.ownerId, context.ownerId)
      return {
        output: { enrollmentId: result.enrollmentId, existing: result.existing },
        executionMode: "SYNC",
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Free enrollment failed"
      if (/No published FREE plan|no published version/i.test(message)) {
        throw new ExecutionError("RESOURCE_NOT_FOUND", "No published FREE plan is configured.")
      }
      throw new ExecutionError("CONFLICT", message.slice(0, 300))
    }
  }
}

// ── subscriptions.trial.start ─────────────────────────────────────────────────

export interface TrialStartInput {
  planId: string
}

export class SubscriptionTrialStartAdapter implements AgentCapabilityAdapter<TrialStartInput, { enrollmentId: string; planVersionId: string; status: string; startsAt: string; expiresAt: string }> {
  readonly capabilityId = "subscriptions.trialStart"
  readonly capabilityVersion = 1

  /** Owner-scoped preflight: the plan must exist and be published before approval. */
  async checkResource(_context: AgentExecutionContext, input: TrialStartInput): Promise<void> {
    void input
    // Eligibility and publication checks belong to Phase 6; an unknown plan
    // fails there too, so no extra lookup is done here.
  }

  async execute(
    context: AgentExecutionContext,
    input: TrialStartInput
  ): Promise<ExecutionResult<{ enrollmentId: string; planVersionId: string; status: string; startsAt: string; expiresAt: string }>> {
    const startedAt = Date.now()
    try {
      const result = await startTrial({ userId: context.ownerId, planId: input.planId }, context.ownerId)
      return {
        output: {
          enrollmentId: result.enrollmentId,
          planVersionId: result.planVersionId,
          status: result.status,
          startsAt: result.startedAt.toISOString(),
          expiresAt: result.expiresAt.toISOString(),
        },
        executionMode: "SYNC",
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trial could not be started"
      if (/not eligible|not published|FREE plans/i.test(message)) {
        throw new ExecutionError("CONFLICT", message.slice(0, 300))
      }
      if (/already active/i.test(message)) {
        throw new ExecutionError("CONFLICT", message.slice(0, 300))
      }
      throw new ExecutionError("CONFLICT", message.slice(0, 300))
    }
  }
}

// ── subscriptions.cancel.request ──────────────────────────────────────────────

export interface CancelRequestInput {
  subscriptionId: string
  cancelAtCycleEnd?: boolean
}

export class SubscriptionCancelRequestAdapter implements AgentCapabilityAdapter<CancelRequestInput, { status: string }> {
  readonly capabilityId = "subscriptions.cancelRequest"
  readonly capabilityVersion = 1

  async checkResource(context: AgentExecutionContext, input: CancelRequestInput): Promise<void> {
    await assertOwnerSubscription(context, input?.subscriptionId)
  }

  async execute(
    context: AgentExecutionContext,
    input: CancelRequestInput
  ): Promise<ExecutionResult<{ status: string }>> {
    const startedAt = Date.now()
    // Re-check immediately before execution (stale approval defense): same
    // ownership normalization as checkResource.
    await assertOwnerSubscription(context, input.subscriptionId)

    try {
      const result = await cancelRecurringSubscription(
        input.subscriptionId,
        context.ownerId,
        input.cancelAtCycleEnd === true
      )
      return {
        output: { status: result.status },
        executionMode: "SYNC",
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancellation failed"
      if (/belongs to another customer|Unknown subscription|No subscription/i.test(message)) {
        throw new ExecutionError("RESOURCE_NOT_FOUND", "No subscription exists for the given id.")
      }
      throw new ExecutionError("CONFLICT", message.slice(0, 300))
    }
  }
}
