/**
 * lib/agent-gateway/tasks/guard.ts
 *
 * Worker-time re-verification. A task being authorized when it was created
 * says nothing about now, so immediately before EVERY attempt the worker
 * re-checks, from live state (no cache):
 *
 *   deadline -> connection (uncached DB read) -> environment -> capability +
 *   adapter binding -> input integrity -> Phase 6 + autonomy (the Phase 7
 *   gate, evaluation-only) -> the bound approval when one is required.
 *
 * Outcome mapping (documented in docs/agent-gateway/phase-8/09-task-security.md):
 *   revoked / suspended / expired connection, owner change, policy denial,
 *   autonomy denial, approval newly required         -> EXPIRED  AUTHORIZATION_REVOKED
 *   capability disabled / unexposed / adapter changed -> EXPIRED  CAPABILITY_DISABLED
 *   environment changed, deadline reached              -> EXPIRED  TASK_EXPIRED
 *   bound approval missing / expired / policy changed  -> EXPIRED  APPROVAL_EXPIRED
 *   stored input or binding does not verify (tamper)   -> FAILED   EXECUTION_FAILED (security event, never retried)
 *   policy/approval store unavailable                  -> transient pre-dispatch failure (retry per class)
 */
import { db } from "@/lib/db"
import type { CapabilityDefinition } from "../capabilities/types"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { AdapterRegistry } from "../execution/resolver/adapter-registry"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { AgentConnectionStatusValue } from "../shared/types"
import { AuthorizationDeniedError } from "../mcp/errors"
import type { GateEvaluation } from "../execution-gate/gate"
import { computeBindingDigest, computeInputDigest, type OperationBinding } from "../approvals/binding"
import type { AgentTaskRow, TaskErrorCode } from "./types"

export interface PolicyEvaluator {
  evaluatePolicy(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<GateEvaluation>
}

export interface TaskConnectionState {
  status: AgentConnectionStatusValue | string
  environment: string
  ownerId: string
  expiresAt: Date | null
}

export interface TaskApprovalState {
  status: string
  bindingDigest: string
  expiresAt: Date
}

export interface GuardDeps {
  capabilityRegistry: CapabilityRegistry
  adapterRegistry: AdapterRegistry
  gate: PolicyEvaluator
  /** The worker's own configured environment (AGENT_GATEWAY_ENVIRONMENT). */
  environment: string
  loadConnection?: (connectionId: string) => Promise<TaskConnectionState | null>
  loadApproval?: (approvalRequestId: string) => Promise<TaskApprovalState | null>
}

export type GuardResult =
  | { ok: true; capability: CapabilityDefinition }
  | { ok: false; kind: "TERMINAL"; to: "EXPIRED" | "FAILED"; errorCode: TaskErrorCode; detailCode: string; security?: boolean }
  | { ok: false; kind: "TRANSIENT"; detailCode: string }

async function defaultLoadConnection(connectionId: string): Promise<TaskConnectionState | null> {
  // Deliberately NOT the Phase 2 connection-status cache: always the database.
  const row = await db.agentConnection.findUnique({
    where: { id: connectionId },
    select: { status: true, environment: true, ownerId: true, expiresAt: true },
  })
  return (row as TaskConnectionState | null) ?? null
}

async function defaultLoadApproval(id: string): Promise<TaskApprovalState | null> {
  const row = await db.agentApprovalRequest.findUnique({ where: { id }, select: { status: true, bindingDigest: true, expiresAt: true } })
  return (row as TaskApprovalState | null) ?? null
}

/** The stored, server-derived security context of a task, as a Phase 4 execution context. */
export function taskExecutionContext(task: AgentTaskRow, connectionStatus: AgentConnectionStatusValue, now: Date, signal: AbortSignal): AgentExecutionContext {
  return {
    requestId: task.requestId,
    connectionId: task.connectionId,
    agentId: task.agentId ?? undefined,
    ownerId: task.ownerId,
    teamId: task.teamId,
    connectionStatus,
    capabilityId: task.capabilityId,
    capabilityVersion: task.capabilityVersion,
    environment: task.environment,
    timestamp: now,
    signal,
    idempotencyKey: task.idempotencyKey ?? undefined,
    tracing: { requestId: task.requestId, connectionId: task.connectionId, capabilityId: task.capabilityId, capabilityVersion: task.capabilityVersion },
  }
}

/** Phase 7 binding of the task's operation, under the given policy context. */
export function taskBindingDigest(task: AgentTaskRow, authorizationPolicyRef: string, autonomyPolicyVersion: number | null): string {
  const binding: OperationBinding = {
    connectionId: task.connectionId,
    agentId: task.agentId ?? null,
    ownerId: task.ownerId,
    teamId: task.teamId ?? null,
    capabilityId: task.capabilityId,
    capabilityVersion: task.capabilityVersion,
    resourceType: task.resourceType ?? null,
    resourceId: task.resourceId ?? null,
    environment: task.environment,
    inputDigest: task.inputDigest,
    authorizationPolicyRef,
    autonomyPolicyVersion,
  }
  return computeBindingDigest(binding)
}

const terminal = (to: "EXPIRED" | "FAILED", errorCode: TaskErrorCode, detailCode: string, security = false): GuardResult => ({
  ok: false,
  kind: "TERMINAL",
  to,
  errorCode,
  detailCode,
  security,
})

export async function verifyTaskForExecution(task: AgentTaskRow, deps: GuardDeps, now: Date): Promise<GuardResult> {
  // 1. Overall deadline (exclusive).
  if (now.getTime() >= new Date(task.expiresAt).getTime()) return terminal("EXPIRED", "TASK_EXPIRED", "DEADLINE_REACHED")

  // 2. Connection — authoritative, uncached.
  let connection: TaskConnectionState | null
  try {
    connection = await (deps.loadConnection ?? defaultLoadConnection)(task.connectionId)
  } catch {
    return { ok: false, kind: "TRANSIENT", detailCode: "CONNECTION_STORE_UNAVAILABLE" }
  }
  if (!connection || connection.status !== "ACTIVE") return terminal("EXPIRED", "AUTHORIZATION_REVOKED", "CONNECTION_NOT_ACTIVE")
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= now.getTime()) return terminal("EXPIRED", "AUTHORIZATION_REVOKED", "CONNECTION_EXPIRED")
  if (connection.ownerId !== task.ownerId) return terminal("EXPIRED", "AUTHORIZATION_REVOKED", "OWNER_CHANGED")

  // 3. Environment: the task, the connection and this worker must all agree.
  if (task.environment !== deps.environment || connection.environment !== task.environment) {
    return terminal("EXPIRED", "TASK_EXPIRED", "ENVIRONMENT_MISMATCH")
  }

  // 4. Capability + adapter binding, exactly the version the task was created for.
  const capability = deps.capabilityRegistry.getVersion(task.capabilityId, task.capabilityVersion)
  if (
    !capability ||
    capability.status === "DISABLED" ||
    capability.exposure !== "AGENT_AVAILABLE" ||
    !capability.async.asyncSupported ||
    capability.executionReference?.adapterKey !== task.adapterId ||
    !deps.adapterRegistry.has(task.capabilityId, task.capabilityVersion)
  ) {
    return terminal("EXPIRED", "CAPABILITY_DISABLED", "CAPABILITY_UNAVAILABLE")
  }

  // 5. Integrity of the stored operation.
  let recomputed: string
  try {
    recomputed = computeInputDigest(task.input)
  } catch {
    return terminal("FAILED", "EXECUTION_FAILED", "INPUT_INTEGRITY", true)
  }
  if (recomputed !== task.inputDigest) return terminal("FAILED", "EXECUTION_FAILED", "INPUT_INTEGRITY", true)

  // 6. Live Phase 6 authorization + Phase 7 autonomy (no approval side effects).
  let evaluation: GateEvaluation
  try {
    evaluation = await deps.gate.evaluatePolicy(taskExecutionContext(task, "ACTIVE", now, new AbortController().signal), capability, task.input)
  } catch (err) {
    if (err instanceof AuthorizationDeniedError) {
      if (err.code === "POLICY_UNAVAILABLE") return { ok: false, kind: "TRANSIENT", detailCode: "POLICY_UNAVAILABLE" }
      return terminal("EXPIRED", "AUTHORIZATION_REVOKED", err.code)
    }
    return { ok: false, kind: "TRANSIENT", detailCode: "POLICY_UNAVAILABLE" }
  }
  if ((evaluation.resourceType ?? null) !== (task.resourceType ?? null) || (evaluation.resourceId ?? null) !== (task.resourceId ?? null)) {
    return terminal("FAILED", "EXECUTION_FAILED", "RESOURCE_INTEGRITY", true)
  }

  // 7. Approval, when the CURRENT policy requires one: only the approval bound
  //    to this task, still unexpired, for exactly this operation, under the
  //    same policy context it was granted in.
  if (evaluation.autonomy.outcome === "REQUIRE_APPROVAL") {
    if (!task.approvalRequestId) return terminal("EXPIRED", "AUTHORIZATION_REVOKED", "APPROVAL_NOW_REQUIRED")
    let approval: TaskApprovalState | null
    try {
      approval = await (deps.loadApproval ?? defaultLoadApproval)(task.approvalRequestId)
    } catch {
      return { ok: false, kind: "TRANSIENT", detailCode: "APPROVAL_STORE_UNAVAILABLE" }
    }
    if (!approval || approval.status !== "CONSUMED") return terminal("EXPIRED", "APPROVAL_EXPIRED", "APPROVAL_NOT_CONSUMED")
    if (now.getTime() >= new Date(approval.expiresAt).getTime()) return terminal("EXPIRED", "APPROVAL_EXPIRED", "APPROVAL_WINDOW_PASSED")
    if (taskBindingDigest(task, task.authorizationPolicyRef, task.autonomyPolicyVersion ?? null) !== approval.bindingDigest) {
      return terminal("FAILED", "EXECUTION_FAILED", "APPROVAL_BINDING_INTEGRITY", true)
    }
    if (taskBindingDigest(task, evaluation.authorizationPolicyRef, evaluation.autonomy.policyVersion) !== approval.bindingDigest) {
      return terminal("EXPIRED", "APPROVAL_EXPIRED", "APPROVAL_POLICY_CHANGED")
    }
  }

  return { ok: true, capability }
}
