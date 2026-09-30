/**
 * lib/agent-gateway/authorization/authorizer.ts
 *
 * `PolicyEngineAuthorizer` — the REAL Phase 6 implementation of Phase 5's
 * `CapabilityAuthorizer` interface (mcp/authorization-hook.ts, UNMODIFIED
 * by this phase). This is the ONLY new class Phase 6 wires into
 * route-handler.ts, replacing exactly one line:
 *   `new FailClosedAuthorizer()` -> `new PolicyEngineAuthorizer()`
 * per Phase 5's own documented integration seam
 * (docs/agent-gateway/phase-5/07-authorization-boundary.md).
 *
 * FAIL-CLOSED GUARANTEE: every code path in `authorize()` either resolves
 * normally (ALLOW) or throws `AuthorizationDeniedError`. There is NO path
 * that swallows an internal error (policy-store DB/cache failure,
 * malformed stored policy, an unexpected exception from engine.ts) and
 * falls through to an implicit allow. The outer try/catch exists ONLY to
 * convert an unexpected internal error into the SAME denial error type —
 * never to recover into success.
 */
import type { CapabilityAuthorizer, ResourceContext } from "../mcp/authorization-hook"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"
import { buildAuthorizationContext } from "./context-builder"
import { loadActivePolicySet } from "./policy-store"
import { evaluate } from "./engine"
import { toAuthorizationError } from "./errors"
import { recordAuthorizationEvent } from "./observability"
import type { AuthorizationDecision } from "./types"

export class PolicyEngineAuthorizer implements CapabilityAuthorizer {
  async authorize(
    context: AgentExecutionContext,
    capability: CapabilityDefinition,
    input: unknown,
    _resourceContext: ResourceContext
  ): Promise<void> {
    const decision = await this.decide(context, capability, input)
    if (decision.decision === "ALLOW") {
      return
    }
    throw toAuthorizationError(capability.id, decision)
  }

  /**
   * Phase 7 seam: the same fail-closed evaluation as `authorize()`, returned
   * as a value instead of thrown, so the Phase 7 execution gate can route a
   * REQUIRES_APPROVAL decision into the approval engine. Never returns ALLOW
   * on an internal error (POLICY_UNAVAILABLE instead).
   */
  async decide(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<AuthorizationDecision> {
    const authzContext = buildAuthorizationContext(context, capability, input)

    let decision: AuthorizationDecision
    try {
      const policySet = await loadActivePolicySet()
      decision = evaluate(authzContext, { versions: policySet })
    } catch {
      // Policy data could not be loaded (DB down, cache+DB both
      // unavailable, or an unexpected exception) — POLICY_UNAVAILABLE,
      // enforced identically to DENY. Never swallowed into an allow.
      decision = {
        decision: "POLICY_UNAVAILABLE" as const,
        reasonCode: "POLICY_UNAVAILABLE" as const,
        message: "The policy subsystem is unavailable.",
      }
    }

    recordAuthorizationEvent({
      requestId: authzContext.requestId,
      connectionId: authzContext.connectionId,
      capabilityId: authzContext.capabilityId,
      resourceType: authzContext.capabilityResourceType,
      resourceId: authzContext.resourceId,
      decision,
    })

    return decision
  }
}
