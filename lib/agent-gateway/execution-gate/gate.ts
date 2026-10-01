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
  countPendingApprovals,
  expireApproval,
  findLiveApprovalByBinding,
  findOrCreateApprovalRequest,
  findRecentRejection,
  findSiblingApproval,
} from "../approvals/request-service"
import { APPROVAL_METHOD_STEP_UP, APPROVER_SCOPE_SUPER_ADMIN, MAX_PENDING_APPROVALS_PER_CONNECTION } from "../approvals/constants"
import { describeApprovalSurface } from "../human-in-the-loop/cua-contract"
import { recordGateEvent, type GateEventFields } from "./observability"
import { withAgentSpan } from "../observability/tracing"
import { checkRuntimeControls, recordRuntimeControlRefusal, type RuntimeControlDeps } from "../rollout/controls"
import { getAdapterRegistry } from "../execution"
import { ExecutionError } from "../execution/contracts/execution-error"

/** Phase 6 as a value source (implemented by PolicyEngineAuthorizer.decide). */
export interface AuthorizationDecider {
  decide(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<AuthorizationDecision>
}

/**
 * P14-F2 — read-only check that the operation's resource is reachable by the
 * connection's owner. Resolves when it is; throws the adapter's own
 * RESOURCE_NOT_FOUND `ExecutionError` when it is missing or not owned.
 */
export type ResourcePreflight = (context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown) => Promise<void>

/** Default preflight: the registered adapter's own `checkResource` (execution/contracts/adapter.ts). Capabilities without one have nothing to check. */
export const adapterResourcePreflight: ResourcePreflight = async (context, capability, input) => {
  const adapter = getAdapterRegistry().get(capability.id, capability.version)
  if (adapter?.checkResource) await adapter.checkResource(context, input)
}

export interface ExecutionGateDeps {
  authorization: AuthorizationDecider
  loadAutonomyPolicy?: (connectionId: string) => Promise<EffectiveAutonomyPolicy | null>
  /** Phase 15 — release controls (kill switches, rollout stages); defaults to the database stores. */
  runtimeControls?: RuntimeControlDeps
  /** P14-F2 — resource preflight before an approval is requested or consumed; defaults to the adapter's own `checkResource`. */
  resourcePreflight?: ResourcePreflight
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
  // Phase 15 — release controls
  | "KILL_SWITCH_ACTIVE"
  | "ROLLOUT_BLOCKED"
  | "POLICY_UNAVAILABLE"
  | "EXECUTION_GATE_DENIED"
  // Known-issue fixes after Phase 15
  /** P14-F2: the resource is missing or not the owner's (same answer as the adapter's). */
  | "RESOURCE_NOT_FOUND"
  /** P14-F3: the connection already has the maximum number of pending approval requests. */
  | "APPROVAL_LIMIT_REACHED"

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
  // Phase 11 — ledger context.
  ownerId: string
  teamId: string | null
  environment: string
  purpose: GatePurpose
}

/**
 * Phase 11 — why the gate is being asked: a new decision (sync call / task
 * submission), the worker's re-verification before an attempt, or a stored
 * result being read back. Ledger volume and wording depend on it; the
 * decision itself never does.
 */
export type GatePurpose = "decision" | "revalidation" | "result_read"

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
  private readonly resourcePreflight: ResourcePreflight
  private readonly clock: () => Date

  constructor(private readonly deps: ExecutionGateDeps) {
    this.loadPolicy = deps.loadAutonomyPolicy ?? loadEffectiveAutonomyPolicy
    this.resourcePreflight = deps.resourcePreflight ?? adapterResourcePreflight
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
    return this.failClosed(context, capability, () => this.traced(context, capability, "decision", () => this.evaluate(context, capability, input, true, "decision")))
  }

  /** Phase 11 — one agent.authorization span per gate evaluation. */
  private traced<T>(context: AgentExecutionContext, capability: CapabilityDefinition, purpose: GatePurpose, run: () => Promise<T>): Promise<T> {
    return withAgentSpan(
      "agent.authorization",
      {
        "agent.request.id": context.requestId,
        "agent.connection.id": context.connectionId,
        "agent.capability.id": capability.id,
        "agent.capability.version": capability.version,
        "agent.risk_tier": capability.operationType,
        "agent.environment": context.environment,
        "agent.reason_code": purpose.toUpperCase(),
      },
      run
    )
  }

  /**
   * Phase 8 seam — the same live identity + Phase 6 + autonomy evaluation,
   * WITHOUT touching approvals. Used by the task worker to re-verify a queued
   * task immediately before execution; when approval is required the worker
   * verifies the approval already bound to the task instead of consuming a
   * new one. Denials and failures are thrown exactly like `authorize()`.
   */
  async evaluatePolicy(
    context: AgentExecutionContext,
    capability: CapabilityDefinition,
    input: unknown,
    purpose: Exclude<GatePurpose, "decision"> = "revalidation"
  ): Promise<GateEvaluation> {
    return this.failClosed(context, capability, () => this.traced(context, capability, purpose, () => this.evaluate(context, capability, input, false, purpose)))
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
        ownerId: context.ownerId,
        teamId: context.teamId ?? null,
        environment: context.environment,
        purpose: "decision",
      })
      throw new ExecutionGateDeniedError("POLICY_UNAVAILABLE", `Capability "${capability.id}" could not be evaluated. Failing closed.`)
    }
  }

  private async evaluate(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown, consume: boolean, purpose: GatePurpose): Promise<GateGrant> {
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
      ownerId: context.ownerId,
      teamId: context.teamId ?? null,
      environment: context.environment,
      purpose,
    }
    // Phase 11: what is known so far about the decision, for the ledger.
    const decided: Partial<GateEventFields> = {}
    const deny = (code: GateCode, message: string, autonomyLevel: string, approvalRef?: string, approvalState?: string): never => {
      recordGateEvent({ ...base, ...decided, autonomyLevel, outcome: "DENIED", reasonCode: code, approvalRef, approvalState, durationMs: Date.now() - startedAt })
      throw new ExecutionGateDeniedError(code, message)
    }

    // 1. Identity. Phase 1/2 already refused non-ACTIVE connections at
    //    authentication time; this is defense in depth.
    if (!context.connectionId || !context.ownerId || context.connectionStatus !== "ACTIVE") {
      deny("IDENTITY_INVALID", "The agent identity is not valid for execution.", "OBSERVE_ONLY")
    }

    // 1b. Phase 15 release controls — before authorization, autonomy and any
    //     approval is created or consumed. A store failure fails closed
    //     (POLICY_UNAVAILABLE: transient for a queued task, a denial for a call).
    const release = await checkRuntimeControls(
      { capabilityId: capability.id, riskTier: capability.operationType, connectionId: context.connectionId, environment: context.environment },
      this.deps.runtimeControls
    )
    if (!release.allowed) {
      recordRuntimeControlRefusal({ capabilityId: capability.id, riskTier: capability.operationType, connectionId: context.connectionId, environment: context.environment, requestId: context.requestId, ownerId: context.ownerId }, release, "GATE")
      if (release.code === "RELEASE_CONTROLS_UNAVAILABLE") {
        deny("POLICY_UNAVAILABLE", `Capability "${capability.id}" could not be evaluated because the release controls are unavailable. Failing closed.`, "OBSERVE_ONLY")
      }
      if (release.code === "KILL_SWITCH_ACTIVE") deny("KILL_SWITCH_ACTIVE", `Capability "${capability.id}" is stopped by an operator kill switch.`, "OBSERVE_ONLY")
      deny("ROLLOUT_BLOCKED", `Capability "${capability.id}" is not released to this connection in this environment.`, "OBSERVE_ONLY")
    }

    // 2. Phase 6 authorization, freshly evaluated.
    const authorization = await this.deps.authorization.decide(context, capability, input)
    decided.authorizationDecision = authorization.decision
    decided.authorizationPolicyRef = authorization.matchedPolicyVersionId
      ? `${authorization.matchedPolicyVersionId}@v${authorization.matchedPolicyVersion ?? 0}`
      : "none"
    decided.policyEvaluationMs = authorization.evaluationDurationMs

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
    decided.autonomyPolicyVersion = autonomy.policyVersion

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

    decided.inputDigest = evaluation.inputDigest

    if (autonomy.outcome === "ALLOW_AUTONOMOUS") {
      recordGateEvent({ ...base, ...decided, autonomyLevel: autonomy.effectiveLevel, outcome: "ALLOWED", reasonCode: autonomy.reasonCode, durationMs: Date.now() - startedAt })
      return { ...evaluation, approval: null }
    }

    if (!consume) {
      // Evaluation only (Phase 8 worker re-check): the caller must verify the
      // approval it already holds. Nothing is created or consumed here.
      recordGateEvent({ ...base, ...decided, autonomyLevel: autonomy.effectiveLevel, outcome: "APPROVAL_REQUIRED", reasonCode: autonomy.reasonCode, durationMs: Date.now() - startedAt })
      return { ...evaluation, approval: null }
    }

    // 4a. Human approval required, so first the resource itself (P14-F2): no
    //     approval is requested, or consumed, for a resource this owner
    //     cannot reach. The refusal is the adapter's own RESOURCE_NOT_FOUND
    //     (same code, same message), so it tells the agent nothing an
    //     autonomous call would not. A failure to check is a denial.
    try {
      await this.resourcePreflight(context, capability, input)
    } catch (err) {
      if (err instanceof ExecutionError && err.code === "RESOURCE_NOT_FOUND") {
        deny("RESOURCE_NOT_FOUND", err.message, autonomy.effectiveLevel)
      }
      deny("POLICY_UNAVAILABLE", `Capability "${capability.id}" could not be evaluated because its resource could not be verified. Failing closed.`, autonomy.effectiveLevel)
    }

    // 4b. The approval itself. Any storage error fails closed.
    try {
      const approval = await this.requireApproval(context, capability, input, evaluation, now, startedAt, { ...base, ...decided })
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
    base: GateEventBase & Partial<GateEventFields>
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

    // P14-F3: every distinct input is a distinct operation with its own
    // request, so the number of requests a connection may leave waiting for
    // a human is bounded. Only a call that would CREATE a request is
    // refused; repeating an already pending operation still answers with
    // that request's reference.
    const createsRequest = !live || isExpired(live.expiresAt, now)
    if (createsRequest) {
      const pending = await countPendingApprovals(context.connectionId, now)
      if (pending >= MAX_PENDING_APPROVALS_PER_CONNECTION) {
        fail(
          "APPROVAL_LIMIT_REACHED",
          `This connection already has ${MAX_PENDING_APPROVALS_PER_CONNECTION} approval requests waiting for a human decision. ` +
            "No new request was created. Wait until the pending ones are decided or expire, then retry."
        )
      }
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
