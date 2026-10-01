/**
 * lib/agent-gateway/tasks/engine.ts
 *
 * `AgentTaskService` — the agent-facing side of the Phase 8 Task Engine:
 * submit, status/result, cancel. Reached only through the gateway-reserved
 * MCP task tools (mcp/task-tools.ts), after Phase 1/2 authentication.
 *
 * Submission runs the SAME chain as a synchronous call — capability
 * resolution (Phase 3), input validation (Phase 3), the ExecutionGate
 * (identity + Phase 6 + Phase 7, including atomic single-use approval
 * consumption) — and only then records a task and enqueues attempt 1.
 * Everything security-relevant on the task is derived server-side from the
 * verified identity and the gate's decision; the agent supplies only the
 * capability id, the input and an optional idempotency key.
 */
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { CapabilityDefinition } from "../capabilities/types"
import { CapabilityError } from "../capabilities/errors"
import { assertValidCapabilityId } from "../capabilities/id"
import type { AdapterRegistry } from "../execution/resolver/adapter-registry"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import { buildExecutionContext } from "../execution/resolver/build-execution-context"
import { buildAuthorizationContext } from "../authorization/context-builder"
import { AuthorizationDeniedError } from "../mcp/errors"
import type { GateGrant } from "../execution-gate/gate"
import { canonicalJson } from "../approvals/canonical-json"
import { computeInputDigest } from "../approvals/binding"
import { generateTaskRef, idempotencyScopeFor, isValidIdempotencyKey, isValidTaskRef, jobIdFor, operationKeyFor, TRIGGER_IDEMPOTENCY_PREFIX } from "./ids"
import { classifyRetry, maxAttemptsFor } from "./retry-policy"
import { TaskError, taskNotFound } from "./errors"
import { getTaskEngineConfig, type TaskEngineConfig } from "./config"
import type { TaskQueuePort } from "./queue"
import {
  createTask,
  findOwnedTask,
  findTaskByActiveOperationKey,
  findTaskById,
  findTaskByIdempotencyScope,
  transitionTask,
} from "./store"
import { applyDueTimeTransition, emit, payloadFor } from "./lifecycle"
import { taskExecutionContext, type PolicyEvaluator } from "./guard"
import { toTaskView } from "./view"
import type { AgentTaskRow, AgentTaskView, CancelTaskResult, SubmitTaskResult, TaskCallerIdentity } from "./types"
import { currentTraceContext } from "../observability/trace-context"
import { withAgentSpan } from "../observability/tracing"
import { guardAgentOutput, type ContentFindings } from "../security/content-guard"
import { isInputHygieneDetails } from "../security/input-hygiene"
import { recordInputRejected } from "../security/evidence"

/** The part of the ExecutionGate the engine uses (grant = authorize + consumed approval). */
export interface TaskGate extends PolicyEvaluator {
  grant(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<GateGrant>
}

export interface AgentTaskServiceDeps {
  capabilityRegistry: CapabilityRegistry
  adapterRegistry: AdapterRegistry
  gate: TaskGate
  queue: TaskQueuePort
  config?: TaskEngineConfig
  clock?: () => Date
}

export interface SubmitTaskArgs {
  capabilityId: string
  input: unknown
  idempotencyKey?: string
}

/**
 * Server-side origin of a submission (Phase 9). Never agent input: the MCP
 * task tools never pass it. A trigger-originated task runs the SAME chain.
 */
export interface TaskOrigin {
  triggerId: string
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

interface OperationIdentity {
  connectionId: string
  ownerId: string
  capabilityId: string
  capabilityVersion: number
  resourceType: string | null
  resourceId: string | null
  inputDigest: string
}

function sameOperation(row: AgentTaskRow, op: OperationIdentity): boolean {
  return (
    row.connectionId === op.connectionId &&
    row.ownerId === op.ownerId &&
    row.capabilityId === op.capabilityId &&
    row.capabilityVersion === op.capabilityVersion &&
    (row.resourceType ?? null) === op.resourceType &&
    (row.resourceId ?? null) === op.resourceId &&
    row.inputDigest === op.inputDigest
  )
}

export class AgentTaskService {
  private readonly config: TaskEngineConfig
  private readonly clock: () => Date

  constructor(private readonly deps: AgentTaskServiceDeps) {
    this.config = deps.config ?? getTaskEngineConfig()
    this.clock = deps.clock ?? (() => new Date())
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  async submit(gatewayContext: AgentGatewayRequestContext, environment: string, args: SubmitTaskArgs, origin?: TaskOrigin): Promise<SubmitTaskResult> {
    return withAgentSpan(
      "agent.task",
      {
        "agent.request.id": gatewayContext.requestId,
        "agent.connection.id": gatewayContext.machine?.connectionId,
        "agent.capability.id": typeof args.capabilityId === "string" ? args.capabilityId : undefined,
        "agent.environment": environment,
      },
      () => this.submitTask(gatewayContext, environment, args, origin)
    )
  }

  private async submitTask(gatewayContext: AgentGatewayRequestContext, environment: string, args: SubmitTaskArgs, origin?: TaskOrigin): Promise<SubmitTaskResult> {
    const machine = gatewayContext.machine
    if (!machine || machine.connectionStatus !== "ACTIVE") {
      throw new TaskError("AUTHORIZATION_REVOKED", "The agent identity is not valid for execution.")
    }

    const capability = this.resolveAsyncCapability(args.capabilityId)
    const validated = this.validateInput(capability, args.input, gatewayContext)

    let canonical: string
    try {
      canonical = canonicalJson(validated)
    } catch {
      throw new TaskError("INVALID_INPUT", "The input contains values that cannot be recorded for asynchronous execution.")
    }
    if (Buffer.byteLength(canonical, "utf8") > this.config.maxInputBytes) {
      throw new TaskError("INVALID_INPUT", "The input is too large for asynchronous execution.")
    }
    const storedInput = JSON.parse(canonical) as Prisma.InputJsonValue
    const inputDigest = computeInputDigest(validated)

    if (args.idempotencyKey !== undefined && !isValidIdempotencyKey(args.idempotencyKey)) {
      throw new TaskError("INVALID_INPUT", "The idempotency key must be 8-128 characters of [A-Za-z0-9._:-].")
    }
    if (!origin && args.idempotencyKey?.startsWith(TRIGGER_IDEMPOTENCY_PREFIX)) {
      throw new TaskError("INVALID_INPUT", `Idempotency keys starting with "${TRIGGER_IDEMPOTENCY_PREFIX}" are reserved.`)
    }
    if (capability.idempotency.requiresIdempotencyKey && !args.idempotencyKey) {
      throw new TaskError("IDEMPOTENCY_KEY_REQUIRED", `Capability "${capability.id}" requires an idempotency key.`)
    }

    // Queue must be configured BEFORE the gate runs, so an unavailable queue
    // can never consume an approval.
    if (!this.deps.queue.isConfigured()) {
      throw new TaskError("QUEUE_UNAVAILABLE", "Asynchronous execution is currently unavailable.")
    }

    const execContext = buildExecutionContext(gatewayContext, capability.id, capability.version, environment)
    const authzContext = buildAuthorizationContext(execContext, capability, validated)
    const op: OperationIdentity = {
      connectionId: machine.connectionId,
      ownerId: machine.ownerId,
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      resourceType: authzContext.capabilityResourceType ?? null,
      resourceId: authzContext.resourceId ?? null,
      inputDigest,
    }
    const scope = args.idempotencyKey ? idempotencyScopeFor(machine.connectionId, args.idempotencyKey) : null
    const opKey = scope ? null : operationKeyFor(op)

    const existing = await this.guardStore(() => this.findExisting(scope, opKey, op))
    if (existing) return { task: toTaskView(existing), created: false, taskId: existing.id }

    await this.assertConnectionEnvironment(machine.connectionId, environment)

    let grant: GateGrant
    try {
      grant = await this.deps.gate.grant(execContext, capability, validated)
    } catch (err) {
      // A concurrent identical submission may have created the task while we
      // were denied (e.g. it consumed the approval first): answer with it.
      if (err instanceof AuthorizationDeniedError) {
        const raced = await this.findExisting(scope, opKey, op).catch(() => null)
        if (raced) return { task: toTaskView(raced), created: false, taskId: raced.id }
      }
      throw err
    }

    const now = this.clock()
    let deadline = now.getTime() + this.config.deadlineMs
    if (grant.approval) deadline = Math.min(deadline, grant.approval.expiresAt.getTime())
    if (deadline <= now.getTime()) throw new TaskError("APPROVAL_EXPIRED", "The approval expired before the task could be created.")

    const retryClass = classifyRetry(capability)
    let row: AgentTaskRow
    try {
      row = await createTask({
        taskRef: generateTaskRef(),
        requestId: gatewayContext.requestId,
        connectionId: machine.connectionId,
        agentId: machine.agentId ?? null,
        ownerId: machine.ownerId,
        teamId: machine.teamId ?? null,
        capabilityId: capability.id,
        capabilityVersion: capability.version,
        adapterId: capability.executionReference!.adapterKey,
        environment,
        resourceType: op.resourceType,
        resourceId: op.resourceId,
        input: storedInput,
        inputDigest,
        idempotencyKey: args.idempotencyKey ?? null,
        idempotencyScope: scope,
        activeOperationKey: opKey,
        approvalRequestId: grant.approval?.id ?? null,
        authorizationPolicyRef: grant.authorizationPolicyRef,
        autonomyPolicyVersion: grant.autonomy.policyVersion,
        retryClass,
        maxAttempts: maxAttemptsFor(retryClass),
        queuedAt: now,
        expiresAt: new Date(deadline),
        triggerId: origin?.triggerId ?? null,
        // Phase 11: the worker continues this trace.
        traceId: currentTraceContext()?.traceId ?? null,
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Concurrent identical submission won: return it (or reject a key collision).
        const winner = await this.findExisting(scope, opKey, op).catch(() => null)
        if (winner) return { task: toTaskView(winner), created: false, taskId: winner.id }
      }
      throw new TaskError("TASK_STORE_UNAVAILABLE", "The task could not be recorded.")
    }
    emit("task.created", row)

    try {
      await this.deps.queue.enqueue(payloadFor(row, 1), { jobId: jobIdFor(row.id, 1) })
    } catch {
      // Never report QUEUED for work that was not enqueued. Release the
      // idempotency identity so the agent can retry with the same key.
      const failed = await transitionTask(row.id, {
        from: "QUEUED",
        to: "FAILED",
        attempts: 0,
        now: this.clock(),
        data: { retryScheduled: false, errorCode: "QUEUE_UNAVAILABLE", errorDetailCode: "ENQUEUE_FAILED", idempotencyScope: null },
      }).catch(() => false)
      if (failed) emit("task.failed", { ...row, status: "FAILED", errorCode: "QUEUE_UNAVAILABLE" })
      throw new TaskError("QUEUE_UNAVAILABLE", "Asynchronous execution is currently unavailable.")
    }
    emit("task.queued", row, { jobId: jobIdFor(row.id, 1) })
    return { task: toTaskView(row), created: true, taskId: row.id }
  }

  // ── Status / result ─────────────────────────────────────────────────────

  async getStatus(identity: TaskCallerIdentity, taskRef: unknown): Promise<AgentTaskView> {
    return (await this.getStatusWithContent(identity, taskRef)).view
  }

  /**
   * Phase 12 — the status view plus the content findings of its result. A
   * stored result is guarded again on every read (secrets, size, injection
   * signals, content trust), so rows written before Phase 12 are covered.
   */
  async getStatusWithContent(identity: TaskCallerIdentity, taskRef: unknown): Promise<{ view: AgentTaskView; content: ContentFindings | null }> {
    const row = await this.loadOwned(identity, taskRef)
    const view = toTaskView(row)
    let content: ContentFindings | null = null
    if (row.status === "SUCCEEDED") {
      if (row.resultRemovedAt || row.result === null || row.result === undefined) {
        view.resultUnavailable = "REMOVED"
      } else if (await this.resultStillReadable(row)) {
        const capability = this.deps.capabilityRegistry.getVersion(row.capabilityId, row.capabilityVersion)
        const toolNames = this.deps.capabilityRegistry.list({ includeDisabled: true, includeForbidden: true }).map((d) => d.id)
        const guarded = guardAgentOutput(capability ?? { contentTrust: undefined, outputSchema: null }, row.result, { toolNames })
        if (guarded.ok) {
          view.result = guarded.output
          content = guarded.findings
        } else {
          view.resultUnavailable = "WITHHELD"
        }
      } else {
        view.resultUnavailable = "AUTHORIZATION_REVOKED"
      }
    }
    return { view, content }
  }

  // ── Cancel ──────────────────────────────────────────────────────────────

  async cancel(identity: TaskCallerIdentity, taskRef: unknown): Promise<CancelTaskResult> {
    let row = await this.loadOwned(identity, taskRef)
    // Two passes: if a worker moves the task between our read and our write,
    // re-read once and answer for the new state. Never loops.
    for (let pass = 0; pass < 2; pass += 1) {
      const now = this.clock()
      switch (row.status) {
        case "QUEUED":
        case "RETRY_QUEUED":
        case "STARTING": {
          const ok = await transitionTask(row.id, { from: row.status, to: "CANCELLED", attempts: row.attempts, now, data: { errorCode: "TASK_CANCELLED" } })
          if (ok) {
            if (row.status !== "STARTING") await this.deps.queue.removePending(jobIdFor(row.id, row.attempts + 1))
            const cancelled = { ...row, status: "CANCELLED" as const, errorCode: "TASK_CANCELLED" }
            emit("task.cancelled", cancelled)
            return { outcome: "CANCELLED", task: toTaskView((await findTaskById(row.id)) ?? cancelled) }
          }
          break
        }
        case "FAILED": {
          if (!row.retryScheduled) throw new TaskError("TASK_ALREADY_COMPLETED", "The task has already finished.")
          // Between attempts: take the retry slot ourselves, then cancel it.
          const queued = await transitionTask(row.id, { from: "FAILED", to: "RETRY_QUEUED", attempts: row.attempts, now })
          if (queued) {
            const ok = await transitionTask(row.id, { from: "RETRY_QUEUED", to: "CANCELLED", attempts: row.attempts, now, data: { errorCode: "TASK_CANCELLED" } })
            if (ok) {
              const cancelled = { ...row, status: "CANCELLED" as const, errorCode: "TASK_CANCELLED" }
              emit("task.cancelled", cancelled)
              return { outcome: "CANCELLED", task: toTaskView((await findTaskById(row.id)) ?? cancelled) }
            }
          }
          break
        }
        case "RUNNING": {
          const capability = this.deps.capabilityRegistry.getVersion(row.capabilityId, row.capabilityVersion)
          if (!capability?.async.cooperativeCancellation) {
            // Honest answer: this adapter cannot be interrupted once running.
            return { outcome: "CANCELLATION_UNAVAILABLE", task: toTaskView(row) }
          }
          const ok = await transitionTask(row.id, { from: "RUNNING", to: "CANCELLING", attempts: row.attempts, now })
          if (ok) {
            const cancelling = { ...row, status: "CANCELLING" as const }
            emit("task.cancellation_requested", cancelling)
            return { outcome: "CANCELLATION_REQUESTED", task: toTaskView((await findTaskById(row.id)) ?? cancelling) }
          }
          break
        }
        case "CANCELLING":
          return { outcome: "CANCELLATION_REQUESTED", task: toTaskView(row) }
        case "CANCELLED":
          throw new TaskError("TASK_CANCELLED", "The task was already cancelled.")
        case "EXPIRED":
          throw new TaskError("TASK_EXPIRED", "The task expired.")
        case "TIMED_OUT":
          throw new TaskError("TASK_TIMEOUT", "The task timed out.")
        case "SUCCEEDED":
          throw new TaskError("TASK_ALREADY_COMPLETED", "The task has already finished.")
      }
      const fresh = await findTaskById(row.id)
      if (!fresh) throw taskNotFound()
      row = fresh
    }
    throw new TaskError("TASK_ALREADY_RUNNING", "The task changed state while cancelling. Retry the request.")
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private resolveAsyncCapability(capabilityId: unknown): CapabilityDefinition {
    // Bare ids only — the same names the MCP tools use. A version-pinned ref
    // ("x.y@v1") would let a caller target a non-current version that the
    // tool projection never exposes.
    if (typeof capabilityId !== "string") throw new TaskError("CAPABILITY_NOT_FOUND", "Capability not found.")
    try {
      assertValidCapabilityId(capabilityId)
    } catch {
      throw new TaskError("CAPABILITY_NOT_FOUND", "Capability not found.")
    }
    let capability: CapabilityDefinition | null
    try {
      capability = this.deps.capabilityRegistry.get(capabilityId)
    } catch {
      capability = null
    }
    // Same exposure filter as the MCP tool projection: not exposed == not found.
    if (!capability || capability.exposure !== "AGENT_AVAILABLE" || capability.status !== "ACTIVE") {
      throw new TaskError("CAPABILITY_NOT_FOUND", "Capability not found.")
    }
    if (!capability.async.asyncSupported || !capability.executionReference || !this.deps.adapterRegistry.has(capability.id, capability.version)) {
      throw new TaskError("ASYNC_NOT_SUPPORTED", `Capability "${capability.id}" does not support asynchronous execution.`)
    }
    return capability
  }

  private validateInput(capability: CapabilityDefinition, input: unknown, gatewayContext?: AgentGatewayRequestContext): unknown {
    try {
      return this.deps.capabilityRegistry.validateInput(`${capability.id}@v${capability.version}`, input ?? {})
    } catch (err) {
      if (err instanceof CapabilityError) {
        // Phase 12: a hostile input is refused before it is ever stored.
        if (isInputHygieneDetails(err.details)) {
          recordInputRejected(
            { connectionId: gatewayContext?.machine?.connectionId, ownerId: gatewayContext?.machine?.ownerId, capabilityId: capability.id, requestId: gatewayContext?.requestId },
            err.details.hygiene,
            err.details.path,
            "TASK"
          )
        }
        throw new TaskError("INVALID_INPUT", err.message)
      }
      throw new TaskError("INVALID_INPUT", "The input failed validation.")
    }
  }

  private async findExisting(scope: string | null, opKey: string | null, op: OperationIdentity): Promise<AgentTaskRow | null> {
    if (scope) {
      const row = await findTaskByIdempotencyScope(scope)
      if (!row) return null
      if (sameOperation(row, op)) return row
      throw new TaskError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different operation.")
    }
    if (opKey) {
      const row = await findTaskByActiveOperationKey(opKey)
      if (row && sameOperation(row, op)) return row
    }
    return null
  }

  private async assertConnectionEnvironment(connectionId: string, environment: string): Promise<void> {
    const row = await this.guardStore(() =>
      db.agentConnection.findUnique({ where: { id: connectionId }, select: { environment: true, status: true } })
    )
    if (!row || row.status !== "ACTIVE") throw new TaskError("AUTHORIZATION_REVOKED", "The agent identity is not valid for execution.")
    if (row.environment !== environment) {
      throw new TaskError("ENVIRONMENT_MISMATCH", "This connection is not registered for this environment.")
    }
  }

  private async loadOwned(identity: TaskCallerIdentity, taskRef: unknown): Promise<AgentTaskRow> {
    if (!isValidTaskRef(taskRef)) throw taskNotFound()
    const row = await this.guardStore(() => findOwnedTask(taskRef, identity.connectionId, identity.ownerId))
    if (!row) throw taskNotFound()
    // Enforce time rules on read, so a stale task is never reported as live.
    const changed = await applyDueTimeTransition(row, this.config, this.clock()).catch(() => false)
    if (!changed) return row
    return (await this.guardStore(() => findTaskById(row.id))) ?? row
  }

  /** A stored result is returned only while the caller is STILL authorized for that operation. */
  private async resultStillReadable(row: AgentTaskRow): Promise<boolean> {
    const capability = this.deps.capabilityRegistry.getVersion(row.capabilityId, row.capabilityVersion)
    if (!capability) return false
    try {
      await this.deps.gate.evaluatePolicy(taskExecutionContext(row, "ACTIVE", this.clock(), new AbortController().signal), capability, row.input, "result_read")
      return true
    } catch {
      return false
    }
  }

  private async guardStore<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (err) {
      if (err instanceof TaskError || err instanceof AuthorizationDeniedError) throw err
      throw new TaskError("TASK_STORE_UNAVAILABLE", "Task storage is currently unavailable.")
    }
  }
}
