/**
 * lib/agent-gateway/tasks/worker.ts
 *
 * `AgentTaskWorker` — the processor for the `agent-task` queue, registered
 * inside the EXISTING worker process (lib/workers.ts startWorkers()). It
 * does not execute business logic itself: every attempt goes through the
 * existing Phase 4 AdapterResolver (capability resolution, schema
 * validation, environment check, adapter, output contract).
 *
 * Per job:
 *   1. the job payload is only a set of references; the stored task row is
 *      the ONLY source of execution parameters, and a payload that disagrees
 *      with it is treated as tampering (task FAILED, security event);
 *   2. the attempt is claimed with a conditional transition (attempt n-1 -> n),
 *      so a duplicate or stale job can never run the same attempt twice;
 *   3. the worker-time guard re-verifies identity, capability, authorization,
 *      autonomy, approval, environment and integrity (tasks/guard.ts);
 *   4. the adapter runs under the execution timeout / overall deadline;
 *   5. the outcome is recorded with a conditional transition; a late result
 *      after a timeout is discarded.
 *
 * Durability: the worker throws ONLY before an attempt is claimed (e.g. the
 * task store is unreachable), letting BullMQ redeliver. A redelivered job for
 * an already-claimed attempt means the previous worker died: pre-dispatch
 * attempts are retried; mid-run attempts are retried only for SAFE_RETRY
 * tasks, because nothing else may be executed twice.
 */
import { AGENT_TASK_JOBS } from "@/lib/queue"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AdapterRegistry } from "../execution/resolver/adapter-registry"
import { AdapterResolver } from "../execution/resolver/adapter-resolver"
import type { ExecutionResult } from "../execution/contracts/execution-result"
import { toExecutionError } from "../execution/contracts/execution-error"
import { getGatewayConfig } from "../config"
import { gatewayLogger } from "../observability/request-log"
import { getTaskEngineConfig, type TaskEngineConfig } from "./config"
import { TASK_JOB_PAYLOAD_SCHEMA, type TaskJobPayload, type TaskQueuePort } from "./queue"
import { findTaskById, transitionTask } from "./store"
import { isTerminalTask } from "./state-machine"
import { jobIdFor } from "./ids"
import { isTransientExecutionCode } from "./retry-policy"
import { applyDueTimeTransition, emit, failAttempt, scheduleRetry, type LifecycleDeps } from "./lifecycle"
import { verifyTaskForExecution, type GuardDeps, type PolicyEvaluator } from "./guard"
import { filterTaskResult } from "./result-filter"
import { runTaskMaintenance } from "./maintenance"
import type { AgentTaskRow } from "./types"

export interface TaskExecutor {
  execute(capabilityRef: string, rawInput: unknown, gatewayContext: AgentGatewayRequestContext, idempotencyKey?: string): Promise<ExecutionResult>
}

export interface AgentTaskWorkerDeps {
  capabilityRegistry: CapabilityRegistry
  adapterRegistry: AdapterRegistry
  gate: PolicyEvaluator
  queue: TaskQueuePort
  config?: TaskEngineConfig
  clock?: () => Date
  /** This worker's environment. Defaults to AGENT_GATEWAY_ENVIRONMENT. */
  environment?: string
  /** Defaults to the existing Phase 4 AdapterResolver. */
  executor?: TaskExecutor
  loadConnection?: GuardDeps["loadConnection"]
  loadApproval?: GuardDeps["loadApproval"]
  /** How often a cooperatively-cancellable attempt checks for CANCELLING. */
  cancellationPollMs?: number
}

export interface TaskJobLike {
  name: string
  data: unknown
  id?: string | null
}

type AttemptOutcome = { kind: "success"; output: unknown } | { kind: "timeout" } | { kind: "error"; code: string }

export class AgentTaskWorker {
  private readonly config: TaskEngineConfig
  private readonly clock: () => Date
  private readonly executor: TaskExecutor
  private readonly lifecycle: LifecycleDeps
  private readonly guardDeps: GuardDeps

  constructor(private readonly deps: AgentTaskWorkerDeps) {
    this.config = deps.config ?? getTaskEngineConfig()
    this.clock = deps.clock ?? (() => new Date())
    this.executor = deps.executor ?? new AdapterResolver(deps.capabilityRegistry, deps.adapterRegistry)
    this.lifecycle = { queue: deps.queue, config: this.config, clock: this.clock }
    this.guardDeps = {
      capabilityRegistry: deps.capabilityRegistry,
      adapterRegistry: deps.adapterRegistry,
      gate: deps.gate,
      environment: deps.environment ?? getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT,
      loadConnection: deps.loadConnection,
      loadApproval: deps.loadApproval,
    }
  }

  async process(job: TaskJobLike): Promise<void> {
    if (job.name === AGENT_TASK_JOBS.MAINTENANCE) {
      await runTaskMaintenance(this.lifecycle)
      return
    }
    if (job.name !== AGENT_TASK_JOBS.EXECUTE) {
      gatewayLogger.warn({ jobName: job.name }, "agent_gateway_task_job_unknown")
      return
    }
    const parsed = TASK_JOB_PAYLOAD_SCHEMA.safeParse(job.data)
    if (!parsed.success) {
      gatewayLogger.warn({ jobId: job.id ?? null, reason: "MALFORMED_PAYLOAD" }, "agent_gateway_task_job_rejected")
      return
    }
    const payload = parsed.data

    // Store unreachable -> throw: BullMQ redelivers; nothing was claimed or dispatched.
    const task = await findTaskById(payload.taskId)
    if (!task) {
      gatewayLogger.warn({ jobId: job.id ?? null, errorCode: "TASK_NOT_FOUND" }, "agent_gateway_task_job_rejected")
      return
    }
    if (isTerminalTask(task.status, task.retryScheduled)) return

    const jobId = job.id ?? jobIdFor(task.id, payload.attempt)
    if (!this.payloadMatches(payload, task)) {
      await this.rejectTampered(task)
      return
    }

    const stale = () => gatewayLogger.info({ taskId: task.id, taskRef: task.taskRef, jobId, attempt: payload.attempt, current: task.attempts, errorCode: "TASK_ALREADY_RUNNING" }, "agent_gateway_task_job_stale")

    switch (task.status) {
      case "QUEUED":
      case "RETRY_QUEUED":
        if (payload.attempt !== task.attempts + 1) return stale()
        return this.runAttempt(task, payload.attempt, jobId)
      case "STARTING":
        // Redelivery of a claimed attempt that never dispatched: the previous worker died.
        if (payload.attempt !== task.attempts) return stale()
        return failAttempt(task, { preDispatch: true, transient: true, detailCode: "WORKER_INTERRUPTED" }, this.lifecycle)
      case "RUNNING":
        // Redelivery mid-run: the adapter may already have executed. Only SAFE_RETRY retries.
        if (payload.attempt !== task.attempts) return stale()
        return failAttempt(task, { preDispatch: false, transient: true, detailCode: "WORKER_INTERRUPTED" }, this.lifecycle)
      case "CANCELLING":
        if (payload.attempt !== task.attempts) return stale()
        if (task.retryClass === "SAFE_RETRY") {
          const ok = await transitionTask(task.id, { from: "CANCELLING", to: "CANCELLED", attempts: task.attempts, now: this.clock(), data: { errorCode: "TASK_CANCELLED" } })
          if (ok) emit("task.cancelled", { ...task, status: "CANCELLED" })
          return
        }
        return failAttempt(task, { preDispatch: false, transient: true, detailCode: "WORKER_INTERRUPTED" }, this.lifecycle)
      case "FAILED":
        // Retry scheduled but the RETRY_QUEUED step was lost: finish it.
        if (payload.attempt === task.attempts) await scheduleRetry(task, this.lifecycle)
        return
      default:
        return
    }
  }

  private payloadMatches(payload: TaskJobPayload, task: AgentTaskRow): boolean {
    return (
      payload.capabilityId === task.capabilityId &&
      payload.capabilityVersion === task.capabilityVersion &&
      payload.adapterId === task.adapterId &&
      payload.environment === task.environment &&
      payload.idempotencyRef === (task.idempotencyKey ?? null)
    )
  }

  private async rejectTampered(task: AgentTaskRow): Promise<void> {
    emit("task.security_violation", task, { errorCode: "EXECUTION_FAILED", detailCode: "PAYLOAD_INTEGRITY" })
    if (task.status === "FAILED") return // retry pending: the legitimate job re-verifies integrity itself
    const ok = await transitionTask(task.id, {
      from: task.status,
      to: "FAILED",
      attempts: task.attempts,
      now: this.clock(),
      data: { retryScheduled: false, errorCode: "EXECUTION_FAILED", errorDetailCode: "PAYLOAD_INTEGRITY" },
    }).catch(() => false)
    if (ok) emit("task.failed", { ...task, status: "FAILED", errorCode: "EXECUTION_FAILED" }, { detailCode: "PAYLOAD_INTEGRITY" })
  }

  private async runAttempt(task: AgentTaskRow, attempt: number, jobId: string): Promise<void> {
    const claimAt = this.clock()
    if (await applyDueTimeTransition(task, this.config, claimAt)) return

    const claimed = await transitionTask(task.id, { from: task.status, to: "STARTING", attempts: task.attempts, now: claimAt, data: { attempts: attempt } })
    if (!claimed) return // cancelled or claimed by someone else
    let current: AgentTaskRow = { ...task, status: "STARTING", attempts: attempt, attemptStartedAt: claimAt }

    const guard = await verifyTaskForExecution(current, this.guardDeps, claimAt).catch(
      () => ({ ok: false, kind: "TRANSIENT", detailCode: "GUARD_ERROR" }) as const
    )
    if (!guard.ok) {
      if (guard.kind === "TRANSIENT") {
        await failAttempt(current, { preDispatch: true, transient: true, detailCode: guard.detailCode }, this.lifecycle)
        return
      }
      if (guard.security) emit("task.security_violation", current, { errorCode: guard.errorCode, detailCode: guard.detailCode })
      const ok = await transitionTask(task.id, {
        from: "STARTING",
        to: guard.to,
        attempts: attempt,
        now: this.clock(),
        data: { retryScheduled: false, errorCode: guard.errorCode, errorDetailCode: guard.detailCode },
      })
      if (ok) emit(guard.to === "EXPIRED" ? "task.expired" : "task.failed", { ...current, status: guard.to, errorCode: guard.errorCode }, { detailCode: guard.detailCode })
      return
    }

    const startedAt = this.clock()
    const running = await transitionTask(task.id, { from: "STARTING", to: "RUNNING", attempts: attempt, now: startedAt, data: { startedAt: task.startedAt ?? startedAt } })
    if (!running) return // cancelled between claim and dispatch: never dispatched
    current = { ...current, status: "RUNNING", attemptStartedAt: startedAt, startedAt: task.startedAt ?? startedAt }
    emit("task.started", current, { jobId })

    const outcome = await this.execute(current, guard.capability, startedAt)
    await this.settle(current, guard.capability, outcome, startedAt)
  }

  private async execute(task: AgentTaskRow, capability: CapabilityDefinition, startedAt: Date): Promise<AttemptOutcome> {
    const controller = new AbortController()
    const budget = Math.max(1, Math.min(this.config.executionTimeoutMs, new Date(task.expiresAt).getTime() - startedAt.getTime()))
    const gatewayContext: AgentGatewayRequestContext = {
      requestId: task.requestId,
      receivedAt: startedAt,
      authenticated: true,
      machine: {
        connectionId: task.connectionId,
        // Not a credential: the task acts on its stored, server-derived context.
        credentialId: `agent-task:${task.taskRef}`,
        ownerId: task.ownerId,
        agentId: task.agentId ?? undefined,
        teamId: task.teamId,
        connectionStatus: "ACTIVE",
        authenticatedAt: startedAt,
      },
      connectionId: task.connectionId,
      ownerId: task.ownerId,
      agentId: task.agentId ?? undefined,
      teamId: task.teamId ?? undefined,
      protocol: "MCP",
      signal: controller.signal,
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    let poller: ReturnType<typeof setInterval> | undefined
    const timeout = new Promise<AttemptOutcome>((resolve) => {
      timer = setTimeout(() => {
        controller.abort()
        resolve({ kind: "timeout" })
      }, budget)
    })
    if (capability.async.cooperativeCancellation) {
      poller = setInterval(() => {
        void findTaskById(task.id)
          .then((fresh) => {
            if (fresh?.status === "CANCELLING") controller.abort()
          })
          .catch(() => undefined)
      }, this.deps.cancellationPollMs ?? 1000)
    }
    try {
      const run = this.executor
        .execute(`${task.capabilityId}@v${task.capabilityVersion}`, task.input, gatewayContext, task.idempotencyKey ?? undefined)
        .then((result): AttemptOutcome => ({ kind: "success", output: result.output }))
        .catch((err: unknown): AttemptOutcome => ({ kind: "error", code: toExecutionError(err).code }))
      return await Promise.race([run, timeout])
    } finally {
      if (timer) clearTimeout(timer)
      if (poller) clearInterval(poller)
    }
  }

  private async settle(task: AgentTaskRow, capability: CapabilityDefinition, outcome: AttemptOutcome, startedAt: Date): Promise<void> {
    const now = this.clock()
    const durationMs = now.getTime() - startedAt.getTime()
    const attempts = task.attempts

    if (outcome.kind === "timeout") {
      const ok = await transitionTask(task.id, { from: ["RUNNING", "CANCELLING"], to: "TIMED_OUT", attempts, now, data: { errorCode: "TASK_TIMEOUT" } })
      if (ok) emit("task.timed_out", { ...task, status: "TIMED_OUT", errorCode: "TASK_TIMEOUT" }, { durationMs })
      return
    }

    if (outcome.kind === "success") {
      const filtered = filterTaskResult(capability, outcome.output, this.config.maxResultBytes)
      if (!filtered.ok) {
        const ok = await transitionTask(task.id, {
          from: ["RUNNING", "CANCELLING"],
          to: "FAILED",
          attempts,
          now,
          data: { retryScheduled: false, errorCode: "EXECUTION_FAILED", errorDetailCode: filtered.detailCode },
        })
        if (ok) emit("task.failed", { ...task, status: "FAILED", errorCode: "EXECUTION_FAILED" }, { detailCode: filtered.detailCode, durationMs })
        return
      }
      const ok = await transitionTask(task.id, { from: ["RUNNING", "CANCELLING"], to: "SUCCEEDED", attempts, now, data: { result: filtered.value, errorCode: null } })
      if (ok) emit("task.succeeded", { ...task, status: "SUCCEEDED", errorCode: null }, { durationMs })
      else gatewayLogger.info({ taskId: task.id, taskRef: task.taskRef, attempt: attempts }, "agent_gateway_task_late_result_discarded")
      return
    }

    // Adapter / resolver error.
    if (outcome.code === "CANCELLED") {
      const ok = await transitionTask(task.id, { from: "CANCELLING", to: "CANCELLED", attempts, now, data: { errorCode: "TASK_CANCELLED" } })
      if (ok) {
        emit("task.cancelled", { ...task, status: "CANCELLED", errorCode: "TASK_CANCELLED" }, { durationMs })
        return
      }
    }
    const fresh = await findTaskById(task.id)
    if (!fresh || fresh.attempts !== attempts || (fresh.status !== "RUNNING" && fresh.status !== "CANCELLING")) return
    await failAttempt(fresh, { preDispatch: false, transient: isTransientExecutionCode(outcome.code), detailCode: outcome.code }, this.lifecycle)
  }
}
