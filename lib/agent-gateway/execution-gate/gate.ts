/**
 * lib/agent-gateway/execution-gate/gate.ts
 *
 * `ExecutionGate` — Phase 7's single decision point immediately before a
 * Phase 4 adapter runs. It implements Phase 5's existing `CapabilityAuthorizer`
 * contract (throw-to-deny), so Phase 5's tool callback and Phase 4's
 * resolver are unchanged: the gate is wired where Phase 6's authorizer was.
 *
 * Every call re-evaluates EVERYTHING from live state — there is no cached
 * decision anywhere in this path:
 *   identity (Phase 1/2, fresh per request)
 *   -> Phase 6 authorization (fresh)
 *   -> autonomy policy (fresh DB read, no cache)
 *   -> autonomy decision
 *   -> if approval is required: live binding digest, lookup, and ATOMIC
 *      single-use consumption of a matching APPROVED approval.
 *
 * An approval is therefore never a standing grant: if authorization is
 * revoked, the policy changes, the input changes, the environment changes,
 * or the approval expires or was already used, execution is refused.
 *
 * Fail closed: any exception anywhere in this class becomes a denial.
 */
import type { CapabilityAuthorizer, ResourceContext } from "../mcp/authorization-hook"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AuthorizationDecision } from "../authorization/types"
import { db } from "@/lib/db"
import { AuthorizationDeniedError } from "../mcp/errors"
import { toAuthorizationError } from "../authorization/errors"
import { buildAuthorizationContext } from "../authorization/context-builder"
import { resolveAutonomyDecision } from "../autonomy/evaluator"
import { loadEffectiveAutonomyPolicy } from "../autonomy/policy-store"
import type { AutonomyDecision, EffectiveAutonomyPolicy } from "../autonomy/types"
import { computeBindingDigest, computeInputDigest, type OperationBinding } from "../approvals/binding"
import { approvalTtlMs, isExpired } from "../approvals/expiration"
import { buildDisplaySummary } from "../approvals/redaction"
import {
  cancelApproval,
  consumeApproval,
  expireApproval,
  findLiveApprovalByBinding,
  findOrCreateApprovalRequest,
  findRecentRejection,
  findSiblingApproval,
} from "../approvals/request-service"
import { APPROVAL_METHOD_STEP_UP, APPROVER_SCOPE_SUPER_ADMIN } from "../approvals/constants"
import { describeApprovalSurface } from "../human-in-the-loop/cua-contract"
import { recordGateEvent } from "./observability"

/** Phase 6 as a value source (implemented by PolicyEngineAuthorizer.decide). */
export interface AuthorizationDecider {
  decide(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<AuthorizationDecision>
}

export interface ExecutionGateDeps {
  authorization: AuthorizationDecider
  loadAutonomyPolicy?: (connectionId: string) => Promise<EffectiveAutonomyPolicy | null>
  clock?: () => Date
}

/** The spec's gate result vocabulary, as stable error codes on the denial. */
export type GateCode =
  | "AUTHORIZATION_DENIED"
  | "AUTONOMY_DENIED"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_EXPIRED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_CANCELLED"
  | "APPROVAL_ALREADY_CONSUMED"
  | "APPROVAL_BINDING_MISMATCH"
  | "APPROVAL_POLICY_CHANGED"
  | "APPROVAL_NOT_FOUND"
  | "IDENTITY_INVALID"
  | "ENVIRONMENT_BLOCKED"
  | "POLICY_UNAVAILABLE"
  | "EXECUTION_GATE_DENIED"

/** Fields common to every gate observability event. */
interface GateEventBase {
  requestId: string
  connectionId: string
  agentId: string | null | undefined
  capabilityId: string
  capabilityVersion: number
  resourceType: string | null
  resourceRef: string | null
  riskTier: string
}

/**
 * The live policy evaluation of one operation (Phase 6 + autonomy), without
 * any approval side effect. Returned by `evaluatePolicy()`; `autonomy.outcome`
 * is only ever ALLOW_AUTONOMOUS or REQUIRE_APPROVAL here — every denial and
 * every failure is thrown as an ExecutionGateDeniedError instead.
 */
export interface GateEvaluation {
  authorization: AuthorizationDecision
  autonomy: AutonomyDecision
  /** "<policyVersionId>@v<n>" of the Phase 6 policy that matched, or "none". */
  authorizationPolicyRef: string
  resourceType: string | null
  resourceId: string | null
  inputDigest: string
}

/** The approval consumed (atomically, single use) for this execution. */
export interface ConsumedApproval {
  id: string
  publicRef: string
  bindingDigest: string
  expiresAt: Date
}

/** Result of `grant()`: the evaluation plus the approval it consumed, if one was required. */
export interface GateGrant extends GateEvaluation {
  approval: ConsumedApproval | null
}

export class ExecutionGateDeniedError extends AuthorizationDeniedError {
  constructor(code: GateCode, message: string) {
    super(message, code)
    this.name = "ExecutionGateDeniedError"
  }
}

function autonomyDenialCode(decision: AutonomyDecision): GateCode {
  switch (decision.reasonCode) {
    case "AUTHORIZATION_DENIED":
      return "AUTHORIZATION_DENIED"
    case "ENVIRONMENT_BLOCKED":
      return "ENVIRONMENT_BLOCKED"
    case "POLICY_UNAVAILABLE":
      return "POLICY_UNAVAILABLE"
    default:
      return "AUTONOMY_DENIED"
  }
}

export class ExecutionGate implements CapabilityAuthorizer {
  private readonly loadPolicy: (connectionId: string) => Promise<EffectiveAutonomyPolicy | null>
  private readonly clock: () => Date

  constructor(private readonly deps: ExecutionGateDeps) {
    this.loadPolicy = deps.loadAutonomyPolicy ?? loadEffectiveAutonomyPolicy
    this.clock = deps.clock ?? (() => new Date())
  }

  async authorize(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown, _resourceContext: ResourceContext): Promise<void> {
    await this.grant(context, capability, input)
  }

  /**
   * Phase 8 seam — exactly the `authorize()` decision (including atomic
   * single-use approval consumption), but returning what was decided so the
   * async Task Engine can bind the consumed approval to the task it creates.
   */
  async grant(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<GateGrant> {
    return this.failClosed(context, capability, () => this.evaluate(context, capability, input, true))
  }

  /**
   * Phase 8 seam — the same live identity + Phase 6 + autonomy evaluation,
   * WITHOUT touching approvals. Used by the task worker to re-verify a queued
   * task immediately before execution; when approval is required the worker
   * verifies the approval already bound to the task instead of consuming a
   * new one. Denials and failures are thrown exactly like `authorize()`.
   */
  async evaluatePolicy(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<GateEvaluation> {
    return this.failClosed(context, capability, () => this.evaluate(context, capability, input, false))
  }

  private async failClosed<T>(context: AgentExecutionContext, capability: CapabilityDefinition, run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (err) {
      if (err instanceof AuthorizationDeniedError) throw err
      // Anything unexpected (context building, canonicalization, storage)
      // is a denial — never a fall-through to execution.
      recordGateEvent({
        requestId: context.requestId,
        connectionId: context.connectionId,
        agentId: context.agentId ?? null,
        capabilityId: capability.id,
        capabilityVersion: capability.version,
        riskTier: capability.operationType,
        autonomyLevel: "UNKNOWN",
        outcome: "DENIED",
        reasonCode: "POLICY_UNAVAILABLE",
        durationMs: 0,
      })
      throw new ExecutionGateDeniedError("POLICY_UNAVAILABLE", `Capability "${capability.id}" could not be evaluated. Failing closed.`)
    }
  }

  private async evaluate(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown, consume: boolean): Promise<GateGrant> {
    const startedAt = Date.now()
    const now = this.clock()
    const authzContext = buildAuthorizationContext(context, capability, input)
    const base: GateEventBase = {
      requestId: context.requestId,
      connectionId: context.connectionId,
      agentId: context.agentId,
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      resourceType: authzContext.capabilityResourceType ?? null,
      resourceRef: authzContext.resourceId ?? null,
      riskTier: capability.operationType,
    }
    const deny = (code: GateCode, message: string, autonomyLevel: string, approvalRef?: string, approvalState?: string): never => {
      recordGateEvent({ ...base, autonomyLevel, outcome: "DENIED", reasonCode: code, approvalRef, approvalState, durationMs: Date.now() - startedAt })
      throw new ExecutionGateDeniedError(code, message)
    }

    // 1. Identity. Phase 1/2 already refused non-ACTIVE connections at
    //    authentication time; this is defense in depth.
    if (!context.connectionId || !context.ownerId || context.connectionStatus !== "ACTIVE") {
      deny("IDENTITY_INVALID", "The agent identity is not valid for execution.", "OBSERVE_ONLY")
    }

    // 2. Phase 6 authorization, freshly evaluated.
    const authorization = await this.deps.authorization.decide(context, capability, input)

    // 3. Autonomy policy, freshly loaded. A load failure is POLICY_UNAVAILABLE, never "no policy".
    let policy: EffectiveAutonomyPolicy | null = null
    let policyUnavailable = false
    try {
      policy = await this.loadPolicy(context.connectionId)
    } catch {
      policyUnavailable = true
    }

    const autonomy = resolveAutonomyDecision({
      capability,
      authorization,
      policy,
      policyUnavailable,
      environment: context.environment,
      now,
      resourceType: authzContext.capabilityResourceType ?? null,
      resourceId: authzContext.resourceId ?? null,
    })

    if (autonomy.outcome === "POLICY_UNAVAILABLE") {
      deny("POLICY_UNAVAILABLE", `Capability "${capability.id}" could not be evaluated because a policy subsystem is unavailable. Failing closed.`, autonomy.effectiveLevel)
    }
    if (autonomy.outcome === "DENY") {
      if (autonomy.reasonCode === "AUTHORIZATION_DENIED") {
        // Reuse Phase 6's generic external message — never leak policy internals.
        deny("AUTHORIZATION_DENIED", toAuthorizationError(capability.id, authorization).message, autonomy.effectiveLevel)
      }
      deny(autonomyDenialCode(autonomy), `Capability "${capability.id}" is outside this connection's permitted autonomy.`, autonomy.effectiveLevel)
    }
    const evaluation: GateEvaluation = {
      authorization,
      autonomy,
      authorizationPolicyRef: authorization.matchedPolicyVersionId
        ? `${authorization.matchedPolicyVersionId}@v${authorization.matchedPolicyVersion ?? 0}`
        : "none",
      resourceType: authzContext.capabilityResourceType ?? null,
      resourceId: authzContext.resourceId ?? null,
      inputDigest: computeInputDigest(input),
    }

    if (autonomy.outcome === "ALLOW_AUTONOMOUS") {
      recordGateEvent({ ...base, autonomyLevel: autonomy.effectiveLevel, outcome: "ALLOWED", reasonCode: autonomy.reasonCode, durationMs: Date.now() - startedAt })
      return { ...evaluation, approval: null }
    }

    if (!consume) {
      // Evaluation only (Phase 8 worker re-check): the caller must verify the
      // approval it already holds. Nothing is created or consumed here.
      recordGateEvent({ ...base, autonomyLevel: autonomy.effectiveLevel, outcome: "APPROVAL_REQUIRED", reasonCode: autonomy.reasonCode, durationMs: Date.now() - startedAt })
      return { ...evaluation, approval: null }
    }

    // 4. Human approval required. Any storage error fails closed.
    try {
      const approval = await this.requireApproval(context, capability, input, evaluation, now, startedAt, base)
      return { ...evaluation, approval }
    } catch (err) {
      if (err instanceof AuthorizationDeniedError) throw err
      return deny("POLICY_UNAVAILABLE", `Capability "${capability.id}" could not be evaluated because the approval subsystem is unavailable. Failing closed.`, autonomy.effectiveLevel)
    }
  }

  private async requireApproval(
    context: AgentExecutionContext,
    capability: CapabilityDefinition,
    input: unknown,
    evaluation: GateEvaluation,
    now: Date,
    startedAt: number,
    base: GateEventBase
  ): Promise<ConsumedApproval> {
    const { autonomy, resourceId, resourceType } = evaluation
    const level = autonomy.effectiveLevel
    const binding: OperationBinding = {
      connectionId: context.connectionId,
      agentId: context.agentId ?? null,
      ownerId: context.ownerId,
      teamId: context.teamId ?? null,
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      resourceType,
      resourceId,
      environment: context.environment,
      inputDigest: evaluation.inputDigest,
      authorizationPolicyRef: evaluation.authorizationPolicyRef,
      autonomyPolicyVersion: autonomy.policyVersion,
    }
    const bindingDigest = computeBindingDigest(binding)

    const fail = (code: GateCode, message: string, approvalRef?: string, approvalState?: string): never => {
      recordGateEvent({ ...base, autonomyLevel: level, outcome: "DENIED", reasonCode: code, approvalRef, approvalState, durationMs: Date.now() - startedAt })
      throw new ExecutionGateDeniedError(code, message)
    }

    const live = await findLiveApprovalByBinding(context.connectionId, bindingDigest)

    if (live && live.status === "APPROVED") {
      if (isExpired(live.expiresAt, now)) {
        await expireApproval(live.id, now)
        fail("APPROVAL_EXPIRED", `The approval ${live.publicRef} expired before execution. Request a new approval.`, live.publicRef, "EXPIRED")
      }
      const consumed = await consumeApproval(live.id, bindingDigest, now)
      if (consumed.ok) {
        recordGateEvent({ ...base, autonomyLevel: level, outcome: "ALLOWED", reasonCode: "APPROVAL_CONSUMED", approvalRef: live.publicRef, approvalState: "CONSUMED", durationMs: Date.now() - startedAt })
        return { id: live.id, publicRef: live.publicRef, bindingDigest, expiresAt: live.expiresAt }
      }
      fail(consumed.code, `The approval ${live.publicRef} cannot be used for this execution.`, live.publicRef)
    }

    // A human explicitly rejected this exact operation recently: do not let
    // the agent re-open it by simply retrying (rejection is terminal for the
    // rejected request's lifetime window).
    if (!live) {
      const rejected = await findRecentRejection(context.connectionId, bindingDigest, now)
      if (rejected) {
        fail("APPROVAL_REJECTED", `A human rejected this exact operation (approval ${rejected.publicRef}). Do not retry it unchanged.`, rejected.publicRef, "REJECTED")
      }
    }

    // No usable approval for THIS exact operation. Detect an approval that
    // exists for a DIFFERENT binding of the same capability+resource, so the
    // agent learns precisely why it is not usable.
    const sibling = live ? null : await findSiblingApproval(context.connectionId, capability.id, resourceId, bindingDigest)
    let mismatchCode: GateCode | null = null
    if (sibling && sibling.inputDigest === binding.inputDigest) {
      // Same operation, but the authorization/autonomy/identity context
      // changed since the request was created — the old request can never
      // become valid again, so retire it (whether PENDING or APPROVED) and
      // never let a human approve a stale binding.
      await cancelApproval(sibling.id, "POLICY_CHANGED", now)
      if (sibling.status === "APPROVED") mismatchCode = "APPROVAL_POLICY_CHANGED"
    } else if (sibling && sibling.status === "APPROVED") {
      mismatchCode = "APPROVAL_BINDING_MISMATCH"
    }

    let connectionName: string | null = null
    try {
      const row = await db.agentConnection.findUnique({ where: { id: context.connectionId }, select: { name: true } })
      connectionName = row?.name ?? null
    } catch {
      connectionName = null
    }

    const { request, created } = await findOrCreateApprovalRequest(
      {
        requestId: context.requestId,
        connectionId: context.connectionId,
        agentId: context.agentId ?? null,
        ownerId: context.ownerId,
        teamId: context.teamId ?? null,
        capabilityId: capability.id,
        capabilityVersion: capability.version,
        resourceType,
        resourceId,
        environment: context.environment,
        riskTier: capability.operationType,
        autonomyLevel: level,
        autonomyPolicyVersion: autonomy.policyVersion,
        authorizationPolicyRef: binding.authorizationPolicyRef,
        inputDigest: binding.inputDigest,
        bindingDigest,
        requiredApproverScope: APPROVER_SCOPE_SUPER_ADMIN,
        approvalMethod: APPROVAL_METHOD_STEP_UP,
        displaySummary: buildDisplaySummary({
          capability,
          connectionName,
          agentId: context.agentId ?? null,
          ownerId: context.ownerId,
          teamId: context.teamId ?? null,
          environment: context.environment,
          resourceType,
          resourceId,
          autonomyLevel: level,
          input,
        }),
        expiresAt: new Date(now.getTime() + approvalTtlMs(capability, context.environment)),
      },
      now
    )

    const surface = describeApprovalSurface(request.publicRef)
    const guidance =
      `A SUPER_ADMIN must approve it at ${surface.path} (approval requires an SMS code sent to the approver's verified phone), ` +
      `then retry the identical call before ${request.expiresAt.toISOString()}.`

    if (mismatchCode === "APPROVAL_BINDING_MISMATCH") {
      fail("APPROVAL_BINDING_MISMATCH", `The existing approval does not cover this exact operation. New approval reference: ${request.publicRef}. ${guidance}`, request.publicRef, "PENDING")
    }
    if (mismatchCode === "APPROVAL_POLICY_CHANGED") {
      fail("APPROVAL_POLICY_CHANGED", `The previous approval was invalidated because the policy context changed. New approval reference: ${request.publicRef}. ${guidance}`, request.publicRef, "PENDING")
    }
    return fail(
      "APPROVAL_REQUIRED",
      `Capability "${capability.id}" requires human approval. Approval reference: ${request.publicRef}${created ? "" : " (already pending)"}. ${guidance}`,
      request.publicRef,
      "PENDING"
    )
  }
}
