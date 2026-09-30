/**
 * lib/agent-gateway/human-in-the-loop/index.ts — Phase 7 Cua boundary barrel.
 */
export {
  APPROVAL_SURFACE_TITLE,
  describeApprovalSurface,
  cuaObservationCanGrantApproval,
  toCuaRuntimeSignal,
  evaluateObservationAgainstSurface,
  parseCuaHealthReport,
} from "./cua-contract"
export type {
  CuaEnvironmentStatus,
  CuaRuntimeSignal,
  ApprovalSurfaceDescriptor,
  CuaObservation,
  CuaApprovalBridge,
} from "./cua-contract"
