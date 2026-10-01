/**
 * lib/agent-gateway/governance/views.ts
 *
 * Admin-facing projections. Explicit allowlists of fields, so a column added
 * later is never exposed by accident. NEVER included: credential hashes,
 * encrypted secrets (credential signing secrets, webhook secrets), step-up
 * code hashes, binding/input digests in lists, task input, task results,
 * idempotency scopes, or the raw approval payload.
 */
import type { CapabilityDefinition } from "../capabilities/types"
import { classifyRetry } from "../tasks/retry-policy"
import { mandatoryApprovalReason } from "../autonomy/approval-requirements"
import { scrubSecrets } from "../security/secret-patterns"

export const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null)
const isoReq = (d: Date | string): string => new Date(d).toISOString()

type Row = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === "string" ? v : null)
/** Phase 12: an agent-supplied value shown to administrators never carries a credential-shaped string. */
const agentStr = (v: unknown): string | null => (typeof v === "string" ? scrubSecrets(v).value : null)

// ── Connections ──────────────────────────────────────────────────────────

export interface ConnectionAdminView {
  id: string
  name: string
  provider: string
  externalAgentId: string | null
  ownerId: string
  teamId: string | null
  status: string
  authMethod: string
  environment: string
  createdAt: string
  lastAuthenticatedAt: string | null
  lastSeenAt: string | null
  expiresAt: string | null
  suspendedAt: string | null
  revokedAt: string | null
}

export function toConnectionAdminView(row: Row): ConnectionAdminView {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    provider: String(row.provider ?? ""),
    externalAgentId: str(row.externalAgentId),
    ownerId: String(row.ownerId ?? ""),
    teamId: str(row.teamId),
    status: String(row.status ?? ""),
    authMethod: String(row.authMethod ?? "BEARER"),
    environment: String(row.environment ?? ""),
    createdAt: isoReq((row.createdAt as Date) ?? new Date(0)),
    lastAuthenticatedAt: iso(row.lastAuthenticatedAt as Date | null),
    lastSeenAt: iso(row.lastSeenAt as Date | null),
    expiresAt: iso(row.expiresAt as Date | null),
    suspendedAt: iso(row.suspendedAt as Date | null),
    revokedAt: iso(row.revokedAt as Date | null),
  }
}

export interface CredentialAdminView {
  id: string
  status: string
  fingerprint: string | null
  keyId: string | null
  createdAt: string
  activatedAt: string | null
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
}

export function toCredentialAdminView(row: Row): CredentialAdminView {
  return {
    id: String(row.id),
    status: String(row.status ?? ""),
    fingerprint: str(row.fingerprint),
    keyId: str(row.keyId),
    createdAt: isoReq((row.createdAt as Date) ?? new Date(0)),
    activatedAt: iso(row.activatedAt as Date | null),
    expiresAt: iso(row.expiresAt as Date | null),
    lastUsedAt: iso(row.lastUsedAt as Date | null),
    revokedAt: iso(row.revokedAt as Date | null),
  }
}

// ── Autonomy ─────────────────────────────────────────────────────────────

export interface AutonomyAdminView {
  version: number
  status: string
  autonomyLevel: string
  maxRiskTier: string
  allowedCapabilityIds: string[]
  approvalRequiredFor: string[]
  environmentScope: string[]
  resourceScopeReference: string | null
  expiresAt: string | null
  note: string | null
  createdAt: string
}

export function toAutonomyAdminView(row: Row): AutonomyAdminView {
  return {
    version: Number(row.version),
    status: String(row.status ?? ""),
    autonomyLevel: String(row.autonomyLevel ?? ""),
    maxRiskTier: String(row.maxRiskTier ?? ""),
    allowedCapabilityIds: Array.isArray(row.allowedCapabilityIds) ? (row.allowedCapabilityIds as string[]) : [],
    approvalRequiredFor: Array.isArray(row.approvalRequiredFor) ? (row.approvalRequiredFor as string[]) : [],
    environmentScope: Array.isArray(row.environmentScope) ? (row.environmentScope as string[]) : [],
    resourceScopeReference: str(row.resourceScopeReference),
    expiresAt: iso(row.expiresAt as Date | null),
    note: str(row.note),
    createdAt: isoReq((row.createdAt as Date) ?? new Date(0)),
  }
}

// ── Policies ─────────────────────────────────────────────────────────────

export interface PolicyVersionAdminView {
  id: string
  version: number
  status: string
  effect: string
  scope: string
  scopeValue: string | null
  capabilityId: string | null
  riskConstraint: string | null
  approvalRequirement: boolean
  conditions: unknown
  note: string | null
  createdAt: string
  createdById: string
}

export function toPolicyVersionAdminView(row: Row): PolicyVersionAdminView {
  return {
    id: String(row.id),
    version: Number(row.version),
    status: String(row.status ?? ""),
    effect: String(row.effect ?? ""),
    scope: String(row.scope ?? ""),
    scopeValue: str(row.scopeValue),
    capabilityId: str(row.capabilityId),
    riskConstraint: str(row.riskConstraint),
    approvalRequirement: row.approvalRequirement === true,
    conditions: row.conditions ?? null,
    note: str(row.note),
    createdAt: isoReq((row.createdAt as Date) ?? new Date(0)),
    createdById: String(row.createdById ?? ""),
  }
}

export interface PolicyAdminView {
  id: string
  name: string
  description: string | null
  enabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
  current: PolicyVersionAdminView | null
  /** Latest version number (the optimistic-concurrency token for new versions). */
  latestVersion: number
}

export function toPolicyAdminView(row: Row, current: Row | null, latestVersion: number): PolicyAdminView {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: str(row.description),
    enabled: row.enabled !== false,
    priority: Number(row.priority ?? 0),
    createdAt: isoReq((row.createdAt as Date) ?? new Date(0)),
    updatedAt: isoReq((row.updatedAt as Date) ?? (row.createdAt as Date) ?? new Date(0)),
    current: current ? toPolicyVersionAdminView(current) : null,
    latestVersion,
  }
}

// ── Approvals ────────────────────────────────────────────────────────────

export interface ApprovalListAdminView {
  publicRef: string
  status: string
  effectiveStatus: string
  capabilityId: string
  capabilityVersion: number
  riskTier: string
  connectionId: string
  environment: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
  expiresAt: string
}

export function toApprovalListAdminView(row: Row, now: Date): ApprovalListAdminView {
  const expiresAt = new Date(row.expiresAt as Date)
  const status = String(row.status ?? "")
  const live = status === "PENDING" || status === "APPROVED"
  return {
    publicRef: String(row.publicRef),
    status,
    effectiveStatus: live && expiresAt.getTime() <= now.getTime() ? "EXPIRED" : status,
    capabilityId: String(row.capabilityId ?? ""),
    capabilityVersion: Number(row.capabilityVersion ?? 1),
    riskTier: String(row.riskTier ?? ""),
    connectionId: String(row.connectionId ?? ""),
    environment: String(row.environment ?? ""),
    resourceType: str(row.resourceType),
    resourceId: agentStr(row.resourceId),
    createdAt: isoReq(row.createdAt as Date),
    expiresAt: expiresAt.toISOString(),
  }
}

// ── Tasks ────────────────────────────────────────────────────────────────

export interface TaskAdminView {
  taskRef: string
  capabilityId: string
  capabilityVersion: number
  adapterId: string
  connectionId: string
  ownerId: string
  teamId: string | null
  agentId: string | null
  environment: string
  resourceType: string | null
  resourceId: string | null
  status: string
  attempts: number
  maxAttempts: number
  retryClass: string
  retryScheduled: boolean
  origin: "AGENT" | "TRIGGER"
  triggerRef: string | null
  approvalRef: string | null
  hasIdempotencyKey: boolean
  errorCode: string | null
  errorDetailCode: string | null
  /** Whether a result is stored; the result itself is never shown in governance views. */
  resultState: "STORED" | "REMOVED" | "NONE"
  createdAt: string
  queuedAt: string | null
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  finishedAt: string | null
  expiresAt: string
}

export const TERMINAL_TASK_STATUSES = ["SUCCEEDED", "CANCELLED", "EXPIRED", "TIMED_OUT"] as const

export function toTaskAdminView(row: Row, refs: { triggerRef?: string | null; approvalRef?: string | null } = {}): TaskAdminView {
  const hasResult = row.result !== null && row.result !== undefined
  return {
    taskRef: String(row.taskRef),
    capabilityId: String(row.capabilityId ?? ""),
    capabilityVersion: Number(row.capabilityVersion ?? 1),
    adapterId: String(row.adapterId ?? ""),
    connectionId: String(row.connectionId ?? ""),
    ownerId: String(row.ownerId ?? ""),
    teamId: str(row.teamId),
    agentId: str(row.agentId),
    environment: String(row.environment ?? ""),
    resourceType: str(row.resourceType),
    resourceId: agentStr(row.resourceId),
    status: String(row.status ?? ""),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.maxAttempts ?? 1),
    retryClass: String(row.retryClass ?? ""),
    retryScheduled: row.retryScheduled === true,
    origin: row.triggerId ? "TRIGGER" : "AGENT",
    triggerRef: refs.triggerRef ?? null,
    approvalRef: refs.approvalRef ?? null,
    hasIdempotencyKey: typeof row.idempotencyKey === "string" && row.idempotencyKey.length > 0,
    errorCode: str(row.errorCode),
    errorDetailCode: str(row.errorDetailCode),
    resultState: row.resultRemovedAt ? "REMOVED" : hasResult ? "STORED" : "NONE",
    createdAt: isoReq((row.createdAt as Date) ?? new Date(0)),
    queuedAt: iso(row.queuedAt as Date | null),
    startedAt: iso(row.startedAt as Date | null),
    completedAt: iso(row.completedAt as Date | null),
    failedAt: iso(row.failedAt as Date | null),
    cancelledAt: iso(row.cancelledAt as Date | null),
    finishedAt: iso(row.finishedAt as Date | null),
    expiresAt: isoReq(row.expiresAt as Date),
  }
}

/** A task an administrator can still try to cancel. */
export function isCancellableTask(view: Pick<TaskAdminView, "status" | "retryScheduled">): boolean {
  if (view.status === "FAILED") return view.retryScheduled
  return !(TERMINAL_TASK_STATUSES as readonly string[]).includes(view.status)
}

// ── Capabilities ─────────────────────────────────────────────────────────

export interface CapabilityAdminView {
  id: string
  version: number
  domain: string
  name: string
  description: string
  status: string
  riskTier: string
  exposure: string
  resourceType: string
  resourceLocator: string | null
  asyncSupported: boolean
  cooperativeCancellation: boolean
  retryClass: string
  mandatoryApproval: string | null
  idempotencyClass: string
  requiresIdempotencyKey: boolean
  reversibility: string
  references: { policies: number; triggers: number }
}

export function toCapabilityAdminView(def: CapabilityDefinition, environment: string, references: { policies: number; triggers: number }): CapabilityAdminView {
  return {
    id: def.id,
    version: def.version,
    domain: def.domain,
    name: def.name,
    description: def.description,
    status: def.status,
    riskTier: def.operationType,
    exposure: def.exposure,
    resourceType: def.resource.resourceType,
    resourceLocator: def.resource.resourceLocator ?? null,
    asyncSupported: def.async.asyncSupported === true,
    cooperativeCancellation: def.async.cooperativeCancellation === true,
    retryClass: classifyRetry(def),
    mandatoryApproval: mandatoryApprovalReason(def, environment),
    idempotencyClass: def.idempotency.class,
    requiresIdempotencyKey: def.idempotency.requiresIdempotencyKey,
    reversibility: def.rollback.reversibility,
    references,
  }
}
