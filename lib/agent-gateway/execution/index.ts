/**
 * lib/agent-gateway/execution/index.ts
 *
 * Singleton accessor for the execution layer, mirroring Phase 2/3's
 * `getX()` + `__resetXForTests()` pattern exactly
 * (auth/credential-store-provider.ts, capabilities/index.ts).
 */
import { AdapterRegistry } from "./resolver/adapter-registry"
import { AdapterResolver } from "./resolver/adapter-resolver"
import { registerCoreAdapters } from "./adapters/index"
import { getCapabilityRegistry } from "../capabilities"

let adapterRegistrySingleton: AdapterRegistry | null = null
let resolverSingleton: AdapterResolver | null = null

export function getAdapterRegistry(): AdapterRegistry {
  if (!adapterRegistrySingleton) {
    const registry = new AdapterRegistry()
    registerCoreAdapters(registry)
    adapterRegistrySingleton = registry
  }
  return adapterRegistrySingleton
}

export function getAdapterResolver(): AdapterResolver {
  if (!resolverSingleton) {
    resolverSingleton = new AdapterResolver(getCapabilityRegistry(), getAdapterRegistry())
  }
  return resolverSingleton
}

/** Test-only: clears both memoized singletons so tests can exercise fresh instances. */
export function __resetExecutionLayerForTests(): void {
  adapterRegistrySingleton = null
  resolverSingleton = null
}

export { AdapterRegistry } from "./resolver/adapter-registry"
export { AdapterResolver } from "./resolver/adapter-resolver"
export type { ExecuteOptions } from "./resolver/adapter-resolver"
export { resolveExecutionTarget, assertEnvironmentMatches } from "./resolver/hard-safety-checks"
export { buildExecutionContext } from "./resolver/build-execution-context"
export { ExecutionError, toExecutionError } from "./contracts/execution-error"
export type { ExecutionErrorCode } from "./contracts/execution-error"
export type { ExecutionResult } from "./contracts/execution-result"
export type { AgentExecutionContext } from "./contracts/execution-context"
export type { AgentCapabilityAdapter } from "./contracts/adapter"
export { checkIdempotency, recordIdempotencyResult, releaseIdempotencyReservation } from "./idempotency/idempotency-guard"
export type { IdempotencyMode, IdempotencyOutcome } from "./idempotency/idempotency-guard"
export { recordExecutionEvent } from "./observability/execution-log"
export { registerCoreAdapters } from "./adapters/index"
