/**
 * lib/agent-gateway/execution/resolver/adapter-resolver.ts
 *
 * `AdapterResolver` — the single orchestration entry point Phase 5+ (or
 * any future internal caller) uses to execute a capability. Ties together:
 *
 *   Phase 3 CapabilityRegistry  (does the capability exist / is it safe?)
 *   AdapterRegistry             (which adapter executes it?)
 *   hard-safety-checks          (the 9 structural checks)
 *   build-execution-context     (trusted context, Phase 2 identity only)
 *   idempotency guard           (Phase 4 idempotency enforcement)
 *   the adapter itself          (translates input -> real service -> output)
 *   observability hook          (safe execution metadata only)
 *
 * Phase 11 adds, around the adapter call and without changing any check:
 *   - circuit breakers (CAPABILITY / CONNECTION / ADAPTER scopes);
 *   - evidence BEFORE any mutation: a non-READ capability runs only after
 *     its "execution.started" intent is in the audit ledger (fail closed);
 *   - the outcome ("execution.succeeded" / "execution.failed") with input
 *     and output DIGESTS and, for recoverable capabilities, the recorded
 *     identifiers the declared recovery needs;
 *   - agent.execution / agent.business_service spans and labelled metrics.
 *
 * This is intentionally the ONLY place `adapter.execute()` is ever called.
 * There is no other code path in this module that can reach an adapter.
 */
import type { AgentGatewayRequestContext } from "../../shared/types"
import type { CapabilityRegistry } from "../../capabilities/registry"
import type { CapabilityDefinition } from "../../capabilities/types"
import { CapabilityError } from "../../capabilities/errors"
import type { AdapterRegistry } from "./adapter-registry"
import { resolveExecutionTarget, assertEnvironmentMatches } from "./hard-safety-checks"
import { buildExecutionContext } from "./build-execution-context"
import { ExecutionError, toExecutionError } from "../contracts/execution-error"
import type { ExecutionResult } from "../contracts/execution-result"
import { getAgentConnectionService } from "../../identity/connection-service"
import { getGatewayConfig } from "../../config"
import { checkIdempotency, recordIdempotencyResult, releaseIdempotencyReservation, type IdempotencyMode } from "../idempotency/idempotency-guard"
import { recordExecutionEvent } from "../observability/execution-log"
import { computeInputDigest } from "../../approvals/binding"
import { computeOutputDigest } from "../../audit-ledger/digest"
import { recordAudit, recordAuditStrict, recordAuditThrottled } from "../../audit-ledger/recorder"
import type { AuditEventInput } from "../../audit-ledger/types"
import { withAgentSpan } from "../../observability/tracing"
import { countMetric, observeMetric } from "../../observability/agent-metrics"
import { getCircuitBreakers, isBreakerFailure, type BreakerScope } from "../../resilience/circuit-breaker"
import { captureRecoveryInput, resolveRecoverySpec } from "../../recovery/spec"
import { checkRuntimeControls, recordRuntimeControlRefusal, type RuntimeControlDeps } from "../../rollout/controls"
import { guardAgentOutput } from "../../security/content-guard"
import { recordContentFindings, recordInputRejected, recordOutputWithheld } from "../../security/evidence"
import { isInputHygieneDetails } from "../../security/input-hygiene"

type AuditBase = Omit<AuditEventInput, "action" | "outcome">

export interface ExecuteOptions {
  /**
   * How the idempotency cache protects a keyed write (idempotency-guard.ts).
   * Default STRICT: the synchronous tool path, where the cache is the only
   * duplicate protection. The task worker and recovery pass BEST_EFFORT:
   * they have a durable dedupe of their own.
   */
  idempotency?: IdempotencyMode
}

/**
 * Errors after which the adapter provably made no change (it refused
 * before writing), so a held idempotency reservation may be released and
 * the same key retried. Anything else after dispatch is ambiguous and keeps
 * the reservation until it expires.
 */
const NO_EFFECT_AFTER_DISPATCH: ReadonlySet<string> = new Set(["INVALID_INPUT", "RESOURCE_NOT_FOUND", "FORBIDDEN", "CONFLICT"])

function safeInputDigest(input: unknown): string | null {
  try {
    return computeInputDigest(input)
  } catch {
    return null
  }
}

function resourceRefOf(definition: CapabilityDefinition, input: unknown): string | null {
  const locator = definition.resource.resourceLocator
  if (!locator || !input || typeof input !== "object") return null
  const value = (input as Record<string, unknown>)[locator]
  return typeof value === "string" ? value : null
}

export class AdapterResolver {
  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    private readonly adapterRegistry: AdapterRegistry,
    /** Phase 15 — release controls; defaults to the database stores. */
    private readonly runtimeControls?: RuntimeControlDeps
  ) {}

  /**
   * Executes `capabilityRef` (e.g. "products.list" or "products.list@v1")
   * against `rawInput`, using the trusted machine identity already present
   * on `gatewayContext`. `idempotencyKey`, when the capability requires
   * one, must be supplied by the caller (e.g. from a request header) —
   * this function does not invent one.
   */
  async execute(
    capabilityRef: string,
    rawInput: unknown,
    gatewayContext: AgentGatewayRequestContext,
    idempotencyKey?: string,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    return withAgentSpan(
      "agent.execution",
      {
        "agent.request.id": gatewayContext.requestId,
        "agent.connection.id": gatewayContext.machine?.connectionId,
        "agent.capability.id": capabilityRef.split("@")[0],
      },
      () => this.run(capabilityRef, rawInput, gatewayContext, idempotencyKey, options.idempotency ?? "STRICT")
    )
  }

  /** Every registered capability id: a mention of one inside third-party content is an injection signal. */
  private toolNamesForDetection(): string[] {
    try {
      return this.capabilityRegistry.list({ includeDisabled: true, includeForbidden: true }).map((d) => d.id)
    } catch {
      return []
    }
  }

  /**
   * Phase 12 — the content guard (security/content-guard.ts), applied to
   * every result before it can reach an agent. Mutates and returns
   * `result`; throws (withholds the result) when it cannot be delivered
   * safely. `content` is always overwritten: an adapter cannot pre-set it.
   */
  private guardResult(definition: CapabilityDefinition, result: ExecutionResult, audit: AuditBase): ExecutionResult {
    const guarded = guardAgentOutput(definition, result.output, { toolNames: this.toolNamesForDetection() })
    if (!guarded.ok) {
      recordOutputWithheld(audit)
      throw new ExecutionError("INTERNAL_ERROR", `The result of "${definition.id}" was withheld because it could not be delivered safely.`, { withheld: guarded.reason })
    }
    result.output = guarded.output
    result.content = guarded.findings
    recordContentFindings(audit, guarded.findings)
    return result
  }

  private admitThroughBreakers(definition: CapabilityDefinition, connectionId: string, audit: AuditBase): Array<[BreakerScope, string]> {
    const breakers = getCircuitBreakers()
    const scopes: Array<[BreakerScope, string]> = [
      ["CAPABILITY", definition.id],
      ["CONNECTION", connectionId],
    ]
    if (definition.executionReference?.adapterKey) scopes.push(["ADAPTER", definition.executionReference.adapterKey])
    const admitted: Array<[BreakerScope, string]> = []
    for (const [scope, key] of scopes) {
      const check = breakers.check(scope, key)
      if (!check.allowed) {
        for (const [s, k] of admitted) breakers.releaseProbe(s, k)
        recordAuditThrottled(
          { ...audit, action: "failure.circuit_rejected", outcome: "DENIED", errorCode: "EXECUTION_UNAVAILABLE", metadata: { breakerScope: scope, breakerKey: key } },
          `circuit:${scope}:${key}`
        )
        throw new ExecutionError("EXECUTION_UNAVAILABLE", `Capability "${definition.id}" is temporarily unavailable after repeated failures. Retry later.`)
      }
      admitted.push([scope, key])
    }
    return admitted
  }

  private async run(
    capabilityRef: string,
    rawInput: unknown,
    gatewayContext: AgentGatewayRequestContext,
    idempotencyKey: string | undefined,
    idempotencyMode: IdempotencyMode
  ): Promise<ExecutionResult> {
    const startedAt = Date.now()
    let capabilityIdForLog = capabilityRef
    let versionForLog = 0
    let definitionForLog: CapabilityDefinition | null = null
    let audit: AuditBase | null = null
    let breakerScopes: Array<[BreakerScope, string]> = []
    let dispatched = false
    // The idempotency reservation this call holds (STRICT mode), if any.
    let reservation: { definition: CapabilityDefinition; connectionId: string; key: string } | null = null

    try {
      // Checks 1-5, 8: existence/forbidden/disabled/adapter-bound/identity-present.
      const { definition, adapter } = resolveExecutionTarget(
        this.capabilityRegistry,
        this.adapterRegistry,
        capabilityRef,
        gatewayContext
      )
      capabilityIdForLog = definition.id
      versionForLog = definition.version
      definitionForLog = definition

      // Check 6: input schema validation — delegated to the Phase 3
      // registry's own validateInput(), never re-implemented here.
      let validatedInput: unknown
      try {
        validatedInput = this.capabilityRegistry.validateInput(`${definition.id}@v${definition.version}`, rawInput)
      } catch (err) {
        if (err instanceof CapabilityError) {
          if (isInputHygieneDetails(err.details)) {
            recordInputRejected(
              { connectionId: gatewayContext.machine?.connectionId, ownerId: gatewayContext.machine?.ownerId, capabilityId: definition.id, requestId: gatewayContext.requestId },
              err.details.hygiene,
              err.details.path,
              "EXECUTION"
            )
          }
          throw new ExecutionError("INVALID_INPUT", err.message, err.details)
        }
        throw err
      }

      // Check 7: environment match. The connection's OWN recorded
      // environment (set at provisioning time, never client-supplied) must
      // match the environment THIS gateway instance is configured for
      // (Phase 1's AGENT_GATEWAY_ENVIRONMENT, also never client-supplied).
      // This is what prevents a "development"-provisioned connection from
      // executing capabilities against a "production"-configured gateway
      // instance, per Phase 2's documented limitation that this
      // enforcement did not exist until now.
      const connectionSummary = await getAgentConnectionService().getById(gatewayContext.machine!.connectionId)
      if (!connectionSummary) {
        throw new ExecutionError("FORBIDDEN", "The machine identity's connection could not be re-verified.")
      }
      assertEnvironmentMatches(connectionSummary.environment, getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT)

      // Phase 15: release controls, re-checked immediately before dispatch (a
      // kill switch flipped after the gate decision still stops the call).
      const releaseSubject = { capabilityId: definition.id, riskTier: definition.operationType, connectionId: gatewayContext.machine!.connectionId, environment: connectionSummary.environment }
      const release = await checkRuntimeControls(releaseSubject, this.runtimeControls)
      if (!release.allowed) {
        recordRuntimeControlRefusal({ ...releaseSubject, requestId: gatewayContext.requestId, ownerId: gatewayContext.machine!.ownerId }, release, "RESOLVER")
        if (release.code === "RELEASE_CONTROLS_UNAVAILABLE") throw new ExecutionError("EXECUTION_UNAVAILABLE", "Release controls are unavailable, so this operation was not executed. Retry later.")
        throw new ExecutionError(release.code, release.code === "KILL_SWITCH_ACTIVE" ? "This capability is stopped by an operator kill switch." : "This capability is not released to this connection in this environment.")
      }

      const machine = gatewayContext.machine!
      audit = {
        actor: { type: "AGENT", id: machine.connectionId },
        requestId: gatewayContext.requestId,
        connectionId: machine.connectionId,
        agentId: machine.agentId ?? null,
        ownerId: machine.ownerId,
        teamId: machine.teamId ?? null,
        capabilityId: definition.id,
        capabilityVersion: definition.version,
        riskTier: definition.operationType,
        resourceType: definition.resource.resourceType,
        resourceRef: resourceRefOf(definition, validatedInput),
        environment: connectionSummary.environment,
        adapterId: definition.executionReference?.adapterKey ?? null,
        inputDigest: safeInputDigest(validatedInput),
      }

      // Idempotency (Phase 4 requirement, reusing Phase 3's declared metadata).
      const idempotencyOutcome = await checkIdempotency(definition, gatewayContext.machine!.connectionId, idempotencyKey, idempotencyMode)
      if (idempotencyOutcome.kind === "REQUIRED_BUT_MISSING") {
        throw new ExecutionError("IDEMPOTENCY_KEY_REQUIRED", `Capability "${definition.id}" requires an idempotency key.`)
      }
      if (idempotencyOutcome.kind === "UNAVAILABLE") {
        throw new ExecutionError(
          "EXECUTION_UNAVAILABLE",
          `Duplicate protection for "${definition.id}" is unavailable, so this operation was not executed. Retry later, or submit it with agent_task_submit.`
        )
      }
      if (idempotencyOutcome.kind === "IN_FLIGHT") {
        throw new ExecutionError(
          "IDEMPOTENCY_CONFLICT",
          "A request with this idempotency key is already in progress, or ended without a confirmed result. Retry the same key shortly; if this persists, check whether the operation took effect before using a new key."
        )
      }
      if (idempotencyOutcome.kind === "NEW_KEY" && idempotencyOutcome.reserved) {
        reservation = { definition, connectionId: gatewayContext.machine!.connectionId, key: idempotencyKey! }
      }
      if (idempotencyOutcome.kind === "REPLAY") {
        recordExecutionEvent({
          requestId: gatewayContext.requestId,
          connectionId: gatewayContext.machine!.connectionId,
          capabilityId: definition.id,
          capabilityVersion: definition.version,
          adapterId: adapter.capabilityId,
          durationMs: Date.now() - startedAt,
          outcome: "SUCCESS",
          idempotencyReplay: true,
        })
        recordAudit({ ...audit, action: "execution.replayed", outcome: "SUCCESS", metadata: { idempotencyReplay: true } })
        countMetric("agent_execution_total", { capability: definition.id, outcome: "REPLAYED", risk_tier: definition.operationType })
        // Phase 12: a replayed result is guarded again (the cache is not a trust anchor).
        return this.guardResult(definition, idempotencyOutcome.result, audit)
      }

      // Phase 11: circuit breakers (narrow scopes, never global).
      breakerScopes = this.admitThroughBreakers(definition, machine.connectionId, audit)

      // Phase 11: no unaudited mutation. The intent is recorded BEFORE the
      // adapter runs; if the ledger cannot take it, nothing is executed.
      if (definition.operationType !== "READ") {
        try {
          await recordAuditStrict({ ...audit, action: "execution.started", outcome: "INFO" })
        } catch {
          throw new ExecutionError("EXECUTION_UNAVAILABLE", "The audit ledger is unavailable, so this operation was not executed. Retry later.")
        }
      }

      const executionContext = buildExecutionContext(
        gatewayContext,
        definition.id,
        definition.version,
        connectionSummary.environment,
        idempotencyKey
      )

      dispatched = true
      const result = await withAgentSpan(
        "agent.business_service",
        { "agent.capability.id": definition.id, "agent.risk_tier": definition.operationType },
        () => adapter.execute(executionContext, validatedInput)
      )

      // Output validation against the capability's own outputSchema — the
      // adapter's job is to translate the existing service's result, but
      // the RESOLVER is what enforces the contract is actually honored,
      // never trusting the adapter's own claim of correctness.
      if (definition.outputSchema) {
        const parsed = definition.outputSchema.safeParse(result.output)
        if (!parsed.success) {
          throw new ExecutionError(
            "INTERNAL_ERROR",
            `Adapter for "${definition.id}" produced output that does not conform to its own capability contract.`
          )
        }
        result.output = parsed.data
      }

      // Phase 12: secrets removed (fail closed), size bounded, injection
      // signals and content trust attached — before anything is cached,
      // digested or returned.
      this.guardResult(definition, result, audit)

      if (idempotencyOutcome.kind === "NEW_KEY") {
        // Records the result, then releases the reservation (kept on purpose
        // if the result could not be recorded). Either way it is handed off:
        // a later failure in this call must not release it.
        const reserved = reservation !== null
        reservation = null
        await recordIdempotencyResult(definition, gatewayContext.machine!.connectionId, idempotencyKey!, result, { reserved })
      }

      const breakers = getCircuitBreakers()
      for (const [scope, key] of breakerScopes) breakers.recordSuccess(scope, key)
      breakerScopes = []

      const durationMs = Date.now() - startedAt
      recordExecutionEvent({
        requestId: gatewayContext.requestId,
        connectionId: gatewayContext.machine!.connectionId,
        capabilityId: definition.id,
        capabilityVersion: definition.version,
        adapterId: adapter.capabilityId,
        durationMs,
        outcome: "SUCCESS",
      })
      const recoveryInput = captureRecoveryInput(resolveRecoverySpec(definition), validatedInput, result.output)
      recordAudit({
        ...audit,
        action: "execution.succeeded",
        outcome: "SUCCESS",
        executionStatus: "SUCCEEDED",
        outputDigest: computeOutputDigest(result.output),
        metadata: { durationMs, ...(recoveryInput ? { recoveryInput } : {}) },
      })
      countMetric("agent_execution_total", { capability: definition.id, outcome: "SUCCESS", risk_tier: definition.operationType })
      observeMetric("agent_execution_duration_ms", durationMs, { capability: definition.id, outcome: "SUCCESS" })

      return result
    } catch (rawErr) {
      let err = toExecutionError(rawErr)
      // Phase 11: a transient refusal BEFORE the adapter ran (open breaker,
      // ledger unavailable, connection re-verification failure) is marked
      // as such, so the Phase 8 worker may retry a non-idempotent write that
      // provably never executed instead of failing it permanently. Only the
      // resolver can know this: a `dispatched` claim coming from anywhere
      // else (e.g. an adapter's error) is removed.
      if (!dispatched && isBreakerFailure(err.code)) {
        err = new ExecutionError(err.code, err.message, { ...(err.details ?? {}), dispatched: false })
      } else if (err.details && "dispatched" in err.details) {
        const rest = { ...err.details }
        delete rest.dispatched
        err = new ExecutionError(err.code, err.message, Object.keys(rest).length > 0 ? rest : undefined)
      }
      if (breakerScopes.length > 0) {
        const breakers = getCircuitBreakers()
        for (const [scope, key] of breakerScopes) {
          if (!dispatched) breakers.releaseProbe(scope, key)
          // The dependency answered (e.g. not found / conflict): it is healthy.
          else if (isBreakerFailure(err.code)) breakers.recordFailure(scope, key)
          else breakers.recordSuccess(scope, key)
        }
      }
      // A held idempotency reservation is released only when the operation
      // provably took no effect; an ambiguous failure keeps the key blocked
      // until the reservation expires, so a retry cannot run it twice.
      if (reservation && (!dispatched || NO_EFFECT_AFTER_DISPATCH.has(err.code))) {
        await releaseIdempotencyReservation(reservation.definition, reservation.connectionId, reservation.key)
      }
      const durationMs = Date.now() - startedAt
      recordExecutionEvent({
        requestId: gatewayContext.requestId,
        connectionId: gatewayContext.machine?.connectionId,
        capabilityId: capabilityIdForLog,
        capabilityVersion: versionForLog,
        durationMs,
        outcome: "FAILURE",
        errorCode: err.code,
      })
      if (audit) {
        const withheld = typeof err.details?.withheld === "string" ? err.details.withheld : undefined
        recordAudit({
          ...audit,
          action: "execution.failed",
          outcome: "FAILED",
          executionStatus: dispatched ? "FAILED" : "REFUSED",
          errorCode: err.code,
          metadata: { durationMs, detailCode: withheld },
        })
      }
      countMetric("agent_execution_total", { capability: capabilityIdForLog, outcome: "FAILURE", risk_tier: definitionForLog?.operationType })
      observeMetric("agent_execution_duration_ms", durationMs, { capability: capabilityIdForLog, outcome: "FAILURE" })
      throw err
    }
  }
}
