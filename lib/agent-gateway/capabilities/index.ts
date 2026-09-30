/**
 * lib/agent-gateway/capabilities/index.ts
 *
 * Singleton accessor for the Capability Registry, mirroring the exact
 * pattern used by Phase 2's auth/credential-store-provider.ts and
 * identity/connection-service.ts (`getX()` + `__resetXForTests()`).
 *
 * This is the ONLY way any other module should obtain a populated
 * registry. Constructing a bare `new CapabilityRegistry()` elsewhere and
 * registering ad-hoc capabilities into it bypasses the reviewed manifest
 * and must not be done outside of tests.
 */
import { CapabilityRegistry } from "./registry"
import { registerCoreCapabilities } from "./manifest"

let singleton: CapabilityRegistry | null = null

export function getCapabilityRegistry(): CapabilityRegistry {
  if (!singleton) {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    singleton = registry
  }
  return singleton
}

/** Test-only: clears the memoized registry so tests can exercise a fresh instance. */
export function __resetCapabilityRegistryForTests(): void {
  singleton = null
}

export { CapabilityRegistry } from "./registry"
export { CapabilityError, toCapabilityError } from "./errors"
export type { CapabilityErrorCode } from "./errors"
export { assertValidCapabilityId, parseCapabilityRef, storageKey } from "./id"
export { DangerousPrimitiveError, assertNoDangerousPrimitives } from "./dangerous-primitive-guard"
export { validateAgainstSchema } from "./schema-validation"
export type {
  CapabilityDefinition,
  RiskTier,
  ExposureLevel,
  CapabilityStatus,
  ExecutionReference,
  PermissionMetadata,
  ResourceMetadata,
  SideEffectMetadata,
  IdempotencyMetadata,
  AsyncMetadata,
  RollbackMetadata,
  OperationMode,
  IdempotencyClass,
  ReversibilityClass,
} from "./types"
export { CORE_CAPABILITY_MANIFEST, registerCoreCapabilities } from "./manifest"
