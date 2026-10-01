/**
 * lib/agent-gateway/capabilities/types.ts
 *
 * Phase 3 — Capability & Tool Registry type model.
 *
 * A CapabilityDefinition is a REGISTRY/DESCRIPTION contract, never an
 * execution engine. It describes WHAT a capability is, WHO it belongs to
 * (which existing backend domain), and HOW it is shaped — never HOW it
 * actually runs. Execution wiring (calling into an existing business
 * service) is explicitly Phase 4 scope.
 *
 * Existence in this registry is NOT authorization, NOT approval, and NOT
 * autonomy. A capability can be fully described here and still be
 * completely unreachable by any agent — see `ExposureLevel`.
 */
import type { z } from "zod"

/**
 * Reuses Phase 0's exact 4-tier risk classification verbatim
 * (docs/agent-gateway/phase-0/RISK-MATRIX.md) — no second, conflicting
 * risk system is introduced here.
 */
export type RiskTier = "READ" | "LOW_RISK_WRITE" | "HIGH_RISK_MUTATION" | "CRITICAL"

/**
 * Explicit operation-intent metadata, independent of risk tier (a READ can
 * be SYNC or ASYNC; a HIGH_RISK_MUTATION can be REVERSIBLE or not). Kept
 * intentionally small — this is descriptive metadata, not a second engine.
 */
export type OperationMode = "SYNC" | "ASYNC"
export type IdempotencyClass = "IDEMPOTENT" | "NON_IDEMPOTENT"
export type ReversibilityClass = "REVERSIBLE" | "IRREVERSIBLE"

/**
 * Capability discovery/exposure boundary (spec's "Security Boundary"
 * section). Existence in the registry never implies any of these except
 * its own literal meaning — authorization, approval, and autonomy are
 * separate, future-phase concerns (Phase 6/7) that this registry does not
 * implement and must not be conflated with.
 *
 *  - PUBLIC_DISCOVERABLE: metadata may be listed to any internal caller
 *    without further restriction (still never to an unauthenticated HTTP
 *    caller — Phase 3 exposes no public endpoint at all).
 *  - INTERNAL_ONLY: exists for internal reference/documentation and future
 *    Phase 4+ wiring, but is not (yet) a candidate for direct agent
 *    invocation — typically HIGH_RISK_MUTATION capabilities awaiting a
 *    Phase 6/7 policy+approval story.
 *  - AGENT_AVAILABLE: the capability's CONTRACT is considered stable
 *    enough that a future, separately-authorized executor could invoke it.
 *    This still grants nothing by itself in Phase 3 — no executor exists.
 *  - DISABLED: temporarily inactive; `resolve()`/`get()` must fail closed
 *    (CAPABILITY_DISABLED), never silently skip to another version.
 *  - DEPRECATED: still resolvable (so callers get a clear signal) but
 *    flagged for callers to migrate away from; never returned by default
 *    "latest" resolution once a non-deprecated newer version exists.
 *  - FORBIDDEN: architecturally excluded from ever being agent-callable
 *    (Phase 0 AI_BLOCKED tier — money movement, credential/secret
 *    exposure, privilege escalation). The registry can describe *that*
 *    such an operation exists and *why* it is blocked, but its
 *    `executionReference` must always be `null`.
 */
export type ExposureLevel =
  | "PUBLIC_DISCOVERABLE"
  | "INTERNAL_ONLY"
  | "AGENT_AVAILABLE"
  | "DISABLED"
  | "DEPRECATED"
  | "FORBIDDEN"

export type CapabilityStatus = "ACTIVE" | "DEPRECATED" | "DISABLED"

/**
 * A controlled, non-executable reference to a FUTURE Phase 4 adapter.
 * `adapterKey` is a plain string identifier (same charset/shape as a
 * capability id — `domain.action`) — never a function value, never a
 * dynamic `require()`/`import()` target, never a client-suppliable value.
 * Phase 4 is responsible for maintaining the actual adapterKey -> handler
 * map; Phase 3 only validates the *shape and safety* of the string itself
 * (see dangerous-primitive-guard.ts).
 *
 * `null` means "intentionally unexecutable" — required for FORBIDDEN
 * capabilities (see ExposureLevel), which must be representable in the
 * registry without ever being wired to anything.
 */
export interface ExecutionReference {
  adapterKey: string
}

export interface PermissionMetadata {
  /**
   * A permission literal from the EXISTING RBAC system
   * (lib/permissions.ts's PERMISSIONS constants, e.g. "read:products") or
   * an existing subadmin resource/action pair reference. Never an invented
   * permission name that could conflict with existing RBAC. `null` is
   * valid for domains with no existing permission constant yet — this
   * must be documented at the call site, never silently assumed.
   */
  permission: string | null
  /** Free-text note when `permission` is null, explaining the gap. */
  note?: string
}

export interface ResourceMetadata {
  resourceType: string
  /** Name of the field in the input schema that identifies the resource, e.g. "productId". */
  resourceLocator?: string
}

export interface SideEffectMetadata {
  /** Human-readable side effects this capability is known to cause, once executed by a future adapter. Descriptive only. */
  effects: string[]
  emitsEvents?: string[]
  triggersRevalidation?: { tags?: string[]; paths?: string[] }
}

export interface IdempotencyMetadata {
  requiresIdempotencyKey: boolean
  idempotencyScope?: string
  retrySafe: boolean
  duplicateBehavior: string
  class: IdempotencyClass
}

export interface AsyncMetadata {
  /** The capability's default mode. Unchanged by Phase 8: a direct tool call always runs this mode. */
  executionMode: OperationMode
  queue?: string
  worker?: string
  expectedDurationMs?: number
  pollingSupported?: boolean
  /**
   * Phase 8 — the capability MAY additionally be submitted for asynchronous
   * execution through the Task Engine (`agent_task_submit`). It does not
   * change `executionMode` or the SYNC path. Only allowed on executable,
   * non-FORBIDDEN, non-DISABLED capabilities (enforced at registration).
   */
  asyncSupported?: boolean
  /**
   * Phase 8 — the adapter stops promptly when `context.signal` aborts while
   * the underlying service call is in progress, so a RUNNING task can be
   * cooperatively cancelled. Absent/false means a RUNNING task cannot be
   * cancelled and the engine reports CANCELLATION_UNAVAILABLE honestly.
   */
  cooperativeCancellation?: boolean
}

export interface RollbackMetadata {
  reversibility: ReversibilityClass
  /** How a human/admin would reverse this today, if at all. Descriptive only — not an executable rollback action. */
  mechanism: string
  /**
   * Phase 11 — the explicit, declarative recovery mapping (see
   * recovery/spec.ts). Absent on a write = manual recovery only. Never a
   * function, never an arbitrary operation: a registered capability id +
   * version and a field map from the original execution's identifiers.
   */
  recovery?: import("../recovery/spec").RecoverySpec
}

export interface CapabilityErrorContractEntry {
  code: string
  description: string
}

/**
 * The full, versioned, typed description of one capability. Immutable
 * once registered — the registry never mutates a stored definition.
 */
export interface CapabilityDefinition<TInput = unknown, TOutput = unknown> {
  /** Stable id, WITHOUT version suffix. Format: `domain.action` (see id.ts). Never database-table terminology. */
  id: string
  /** Explicit version number. Small, reliable model — not semver. */
  version: number
  domain: string
  name: string
  description: string
  status: CapabilityStatus
  operationType: RiskTier
  exposure: ExposureLevel

  /** Zod schema describing accepted input. Required for every non-FORBIDDEN, non-DISABLED capability. Unknown keys must be rejected (`.strict()`). */
  inputSchema: z.ZodType<TInput> | null
  /** Zod schema describing the BUSINESS RESULT shape, never a raw Prisma row. */
  outputSchema: z.ZodType<TOutput> | null
  errorContract: CapabilityErrorContractEntry[]

  requiredIdentityContext: Array<"connectionId" | "ownerId" | "teamId">
  resource: ResourceMetadata
  permission: PermissionMetadata

  sideEffects: SideEffectMetadata
  idempotency: IdempotencyMetadata
  async: AsyncMetadata
  rollback: RollbackMetadata

  /**
   * Controlled reference to a future Phase 4 execution adapter. Must be
   * `null` for FORBIDDEN capabilities and any capability without a
   * reviewed adapter mapping yet.
   */
  executionReference: ExecutionReference | null

  documentationUrl?: string
  /** Security classification note — free text pointer back to Phase 0's DATA-SENSITIVITY-MATRIX.md tier for this domain, for human review, not machine-enforced here. */
  securityClassification?: string
  metadata?: Record<string, string>
}
