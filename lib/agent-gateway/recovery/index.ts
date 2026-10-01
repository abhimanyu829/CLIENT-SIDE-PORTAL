/**
 * lib/agent-gateway/recovery — Phase 11 capability-aware recovery.
 */
import { getCapabilityRegistry } from "../capabilities"
import { getAdapterRegistry } from "../execution"
import { ExecutionGate } from "../execution-gate/gate"
import { PolicyEngineAuthorizer } from "../authorization/authorizer"
import { RecoveryService } from "./service"

/** The production wiring: real registry, adapters and gate (Phase 6 + Phase 7). */
export function createRecoveryService(): RecoveryService {
  return new RecoveryService({
    capabilityRegistry: getCapabilityRegistry(),
    adapterRegistry: getAdapterRegistry(),
    gate: new ExecutionGate({ authorization: new PolicyEngineAuthorizer() }),
  })
}

export { RecoveryService, toRecoveryView } from "./service"
export type { RecoveryView, RecoveryServiceDeps, RecoveryGate, RecoveryExecutor } from "./service"
export { RECOVERY_CLASSES, resolveRecoverySpec, captureRecoveryInput, assertValidRecoverySpec, RecoverySpecError } from "./spec"
export type { RecoveryClass, RecoverySpec } from "./spec"
export { findRecoveryByRef, listRecoveries, RECOVERY_REF_PATTERN } from "./store"
export type { AgentRecoveryRow, RecoveryStatus } from "./store"
