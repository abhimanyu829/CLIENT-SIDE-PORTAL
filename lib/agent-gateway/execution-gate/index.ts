/**
 * lib/agent-gateway/execution-gate/index.ts — Phase 7 execution gate barrel.
 */
export { ExecutionGate, ExecutionGateDeniedError } from "./gate"
export type { AuthorizationDecider, ExecutionGateDeps, GateCode } from "./gate"
export { recordGateEvent } from "./observability"
export type { GateEventFields } from "./observability"
