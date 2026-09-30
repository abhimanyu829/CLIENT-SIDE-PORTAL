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
 * This is intentionally the ONLY place `adapter.execute()` is ever called.
 * There is no other code path in this module that can reach an adapter.
 */
import type { AgentGatewayRequestContext } from "../../shared/types"
import type { CapabilityRegistry } from "../../capabilities/registry"
import { CapabilityError } from "../../capabilities/errors"
import type { AdapterRegistry } from "./adapter-registry"
import { resolveExecutionTarget, assertEnvironmentMatches } from "./hard-safety-checks"
import { buildExecutionContext } from "./build-execution-context"
import { ExecutionError, toExecutionError } from "../contracts/execution-error"
import type { ExecutionResult } from "../contracts/execution-result"
import { getAgentConnectionService } from "../../identity/connection-service"
import { getGatewayConfig } from "../../config"
import { checkIdempotency, recordIdempotencyResult } from "../idempotency/idempotency-guard"
import { recordExecutionEvent } from "../observability/execution-log"

export class AdapterResolver {
  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    private readonly adapterRegistry: AdapterRegistry
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
    idempotencyKey?: string
  ): Promise<ExecutionResult> {
    const startedAt = Date.now()
    let capabilityIdForLog = capabilityRef
    let versionForLog = 0

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

      // Check 6: input schema validation — delegated to the Phase 3
      // registry's own validateInput(), never re-implemented here.
      let validatedInput: unknown
      try {
        validatedInput = this.capabilityRegistry.validateInput(`${definition.id}@v${definition.version}`, rawInput)
      } catch (err) {
        if (err instanceof CapabilityError) {
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

      // Idempotency (Phase 4 requirement, reusing Phase 3's declared metadata).
      const idempotencyOutcome = await checkIdempotency(definition, gatewayContext.machine!.connectionId, idempotencyKey)
      if (idempotencyOutcome.kind === "REQUIRED_BUT_MISSING") {
        throw new ExecutionError("IDEMPOTENCY_KEY_REQUIRED", `Capability "${definition.id}" requires an idempotency key.`)
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
        return idempotencyOutcome.result
      }

      const executionContext = buildExecutionContext(
        gatewayContext,
        definition.id,
        definition.version,
        connectionSummary.environment,
        idempotencyKey
      )

      const result = await adapter.execute(executionContext, validatedInput)

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

      if (idempotencyOutcome.kind === "NEW_KEY") {
        await recordIdempotencyResult(definition, gatewayContext.machine!.connectionId, idempotencyKey!, result)
      }

      recordExecutionEvent({
        requestId: gatewayContext.requestId,
        connectionId: gatewayContext.machine!.connectionId,
        capabilityId: definition.id,
        capabilityVersion: definition.version,
        adapterId: adapter.capabilityId,
        durationMs: Date.now() - startedAt,
        outcome: "SUCCESS",
      })

      return result
    } catch (rawErr) {
      const err = toExecutionError(rawErr)
      recordExecutionEvent({
        requestId: gatewayContext.requestId,
        connectionId: gatewayContext.machine?.connectionId,
        capabilityId: capabilityIdForLog,
        capabilityVersion: versionForLog,
        durationMs: Date.now() - startedAt,
        outcome: "FAILURE",
        errorCode: err.code,
      })
      throw err
    }
  }
}
