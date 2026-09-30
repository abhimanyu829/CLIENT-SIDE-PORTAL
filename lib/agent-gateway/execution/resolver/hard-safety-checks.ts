/**
 * lib/agent-gateway/execution/resolver/hard-safety-checks.ts
 *
 * The 9 hard execution-safety checks the Phase 4 spec requires, enforced
 * BEFORE any adapter is ever invoked. This is explicitly NOT the Phase 6
 * policy/ABAC engine — these are structural safety checks (does the
 * capability exist, is it enabled, is an adapter registered, does the
 * input conform to schema, does the environment match, is identity
 * valid), never a fine-grained authorization decision.
 */
import type { CapabilityDefinition } from "../../capabilities/types"
import { CapabilityError } from "../../capabilities/errors"
import type { CapabilityRegistry } from "../../capabilities/registry"
import type { AdapterRegistry } from "./adapter-registry"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentGatewayRequestContext } from "../../shared/types"
import { ExecutionError } from "../contracts/execution-error"

export interface ResolvedExecutionTarget {
  definition: CapabilityDefinition
  adapter: AgentCapabilityAdapter
}

/**
 * Runs checks 1-9 from the spec, in order, failing closed on the first
 * violation:
 *   1. capability must exist
 *   2. capability must be executable (not FORBIDDEN)
 *   3. capability must be enabled (not DISABLED)
 *   4. adapter must be registered
 *   5. adapter mapping must be valid (adapter's own id/version match)
 *   6. input must conform to schema (performed by the caller via
 *      `capabilityRegistry.validateInput()` — this function assumes that
 *      has already happened and does not re-validate)
 *   7. environment must match
 *   8. machine identity must be valid (a `machine` identity is present)
 *   9. adapter must invoke only its explicitly bound service — enforced
 *      structurally by the adapter interface itself (no dynamic dispatch
 *      exists anywhere in this module for the resolver to bypass)
 */
export function resolveExecutionTarget(
  capabilityRegistry: CapabilityRegistry,
  adapterRegistry: AdapterRegistry,
  ref: string,
  gatewayContext: AgentGatewayRequestContext
): ResolvedExecutionTarget {
  // Checks 1-3: existence, forbidden, disabled. `resolve()` already fails
  // closed on CAPABILITY_NOT_FOUND / CAPABILITY_DISABLED; we additionally
  // reject FORBIDDEN and non-AGENT_AVAILABLE exposure levels here, since
  // Phase 3's `resolve()` does NOT reject FORBIDDEN by itself (only
  // `validateInput()` does) and callers must not be able to reach
  // execution for an INTERNAL_ONLY-but-not-yet-approved capability either.
  let definition: CapabilityDefinition
  try {
    definition = capabilityRegistry.resolve(ref)
  } catch (err) {
    if (err instanceof CapabilityError) {
      throw new ExecutionError(
        err.code === "CAPABILITY_DISABLED" ? "EXECUTION_UNAVAILABLE" : "RESOURCE_NOT_FOUND",
        `Capability "${ref}" is not available for execution.`
      )
    }
    throw err
  }

  if (definition.exposure === "FORBIDDEN") {
    throw new ExecutionError("FORBIDDEN", `Capability "${ref}" is permanently excluded from execution.`)
  }
  if (definition.exposure !== "AGENT_AVAILABLE") {
    // INTERNAL_ONLY, DISABLED, DEPRECATED (as a default exposure — an
    // explicit @vN reference to a deprecated-but-still-AGENT_AVAILABLE
    // version is allowed through by this check; DEPRECATED as a status is
    // a separate field checked below).
    throw new ExecutionError(
      "NOT_EXECUTABLE_YET",
      `Capability "${ref}" is not currently approved for agent execution (exposure=${definition.exposure}).`
    )
  }
  if (definition.status === "DISABLED") {
    throw new ExecutionError("EXECUTION_UNAVAILABLE", `Capability "${ref}" is disabled.`)
  }

  // Check 4/5: adapter registered and correctly bound.
  const adapter = adapterRegistry.get(definition.id, definition.version)
  if (!adapter) {
    throw new ExecutionError(
      "ADAPTER_NOT_FOUND",
      `Capability "${ref}" has no registered execution adapter yet.`
    )
  }
  if (adapter.capabilityId !== definition.id || adapter.capabilityVersion !== definition.version) {
    // Structural guard against a mis-registered adapter — should be
    // unreachable if AdapterRegistry.register() is used correctly, but
    // checked here too since this is the last point before execution.
    throw new ExecutionError(
      "ADAPTER_NOT_FOUND",
      `Adapter registered for "${ref}" does not match its own declared capability binding.`
    )
  }

  // Check 8: machine identity must be present and valid.
  if (!gatewayContext.machine) {
    throw new ExecutionError("FORBIDDEN", "No verified machine identity is present on this request.")
  }
  if (gatewayContext.machine.connectionStatus !== "ACTIVE") {
    throw new ExecutionError("FORBIDDEN", "The machine identity's connection is not ACTIVE.")
  }

  return { definition, adapter }
}

/** Check 7: environment must match. `expectedEnvironment` is the AgentConnection's own recorded environment (never client-supplied). */
export function assertEnvironmentMatches(connectionEnvironment: string, executionEnvironment: string): void {
  if (connectionEnvironment !== executionEnvironment) {
    throw new ExecutionError(
      "ENVIRONMENT_MISMATCH",
      `This connection is registered for environment "${connectionEnvironment}", not "${executionEnvironment}".`
    )
  }
}
