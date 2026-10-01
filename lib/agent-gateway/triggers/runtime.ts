/**
 * lib/agent-gateway/triggers/runtime.ts
 *
 * `TriggerRuntime` — turns one arrival (an allowlisted platform event, a
 * verified webhook call, a due schedule occurrence) into AT MOST one Phase 8
 * task, through exactly the chain an agent call uses:
 *
 *   fresh trigger (ACTIVE, unexpired)
 *     -> dedup (unique triggerId + deliveryKey)
 *     -> concurrency slot (unique columns; decided by the database)
 *     -> fresh connection (ACTIVE, unexpired, same owner + environment)
 *     -> pinned capability version is still the current, async-capable one
 *     -> AgentTaskService.submit(): Phase 3 validation, ExecutionGate
 *        (identity + Phase 6 + Phase 7 approval), idempotent task + enqueue.
 *
 * A trigger existing grants nothing: every firing is re-authorized against
 * live policy, and an approval-requiring operation is recorded as
 * APPROVAL_REQUIRED (the gate files the approval request) instead of running.
 * Nothing from the delivery except a validated resource id ever reaches the
 * capability input; the capability, input, owner and connection come from
 * the stored, human-configured trigger.
 */
import { z } from "zod"
import type { AgentGatewayRequestContext } from "../shared/types"
import { generateRequestId } from "../shared/crypto"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { CapabilityDefinition } from "../capabilities/types"
import { AuthorizationDeniedError } from "../mcp/errors"
import { gatewayLogger } from "../observability/request-log"
import { getGatewayConfig } from "../config"
import { db } from "@/lib/db"
import { AGENT_TASK_JOBS } from "@/lib/queue"
import { TaskError } from "../tasks/errors"
import type { SubmitTaskArgs, TaskOrigin } from "../tasks/engine"
import type { SubmitTaskResult } from "../tasks/types"
import { idempotencyScopeFor, triggerIdempotencyKey } from "../tasks/ids"
import { findTaskById, findTaskByIdempotencyScope } from "../tasks/store"
import { isTerminalTask } from "../tasks/state-machine"
import { getTriggerConfig, type TriggerConfig } from "./config"
import { RESOURCE_ID_PATTERN, TRIGGER_EVENT_CATALOG, type NormalizedTriggerEvent } from "./event-catalog"
import { planDueOccurrence, type OccurrencePlan } from "./schedule"
import {
  advanceSchedule,
  claimActiveSlot,
  claimPendingSlot,
  createRun,
  dropPendingRun,
  findActiveSlotHolder,
  findRunByDelivery,
  findTriggerById,
  finishRun,
  isUniqueViolation,
  listActiveEventTriggers,
  listDueSchedules,
  listExpiredTriggers,
  listPendingRuns,
  promotePendingRun,
  rearmRun,
  recordTriggerOutcome,
  releaseActiveSlot,
  transitionTriggerStatus,
} from "./store"
import type { AgentTriggerRow, AgentTriggerRunRow, TriggerDelivery, TriggerRunStatus, TriggerStatus } from "./types"

/** The part of the Phase 8 task service a trigger uses. */
export interface TriggerTaskSubmitter {
  submit(gatewayContext: AgentGatewayRequestContext, environment: string, args: SubmitTaskArgs, origin?: TaskOrigin): Promise<SubmitTaskResult>
}

export interface TriggerConnectionState {
  status: string
  environment: string
  ownerId: string
  teamId: string | null
  externalAgentId: string | null
  expiresAt: Date | null
}

export interface TriggerRuntimeDeps {
  taskService: TriggerTaskSubmitter
  capabilityRegistry: CapabilityRegistry
  config?: TriggerConfig
  clock?: () => Date
  /** This process's environment. Defaults to AGENT_GATEWAY_ENVIRONMENT. */
  environment?: string
  loadConnection?: (connectionId: string) => Promise<TriggerConnectionState | null>
}

export type FireOutcome =
  | "TASK_CREATED"
  | "PENDING"
  | "DROPPED"
  | "DENIED"
  | "APPROVAL_REQUIRED"
  | "FAILED"
  | "SKIPPED_MISSED"
  | "DUPLICATE"
  | "INACTIVE"

export interface FireResult {
  outcome: FireOutcome
  runRef?: string
  errorCode?: string
  /** True when the delivery may be retried (transient task-creation failure). */
  retryable?: boolean
}

export interface TickReport {
  due: number
  fired: number
  skipped: number
  expired: number
  promoted: number
}

/** A run that took the active slot but never recorded a task within this window is stale. */
const STALE_SLOT_MS = 10 * 60_000
const LIVE_STATUSES: readonly TriggerStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "DISABLED"]

/** Reference-only payload of an `agent-trigger.event` job (ids, never the event payload). */
export const TRIGGER_EVENT_JOB_SCHEMA = z
  .object({
    eventType: z.string().min(1).max(64),
    digest: z.string().regex(/^[0-9a-f]{64}$/),
    resourceType: z.string().min(1).max(64),
    resourceId: z.string().regex(RESOURCE_ID_PATTERN).nullable(),
    actorId: z.string().regex(RESOURCE_ID_PATTERN).nullable(),
    subjectUserId: z.string().regex(RESOURCE_ID_PATTERN).nullable(),
    occurredAt: z.string().min(1).max(64),
  })
  .strict()

async function defaultLoadConnection(connectionId: string): Promise<TriggerConnectionState | null> {
  // Always the database (never the Phase 2 status cache).
  const row = await db.agentConnection.findUnique({
    where: { id: connectionId },
    select: { status: true, environment: true, ownerId: true, teamId: true, externalAgentId: true, expiresAt: true },
  })
  if (!row) return null
  return {
    status: row.status,
    environment: row.environment,
    ownerId: row.ownerId,
    teamId: row.teamId ?? null,
    externalAgentId: row.externalAgentId ?? null,
    expiresAt: row.expiresAt ?? null,
  }
}

const isExpired = (trigger: Pick<AgentTriggerRow, "expiresAt">, now: Date): boolean =>
  !!trigger.expiresAt && new Date(trigger.expiresAt).getTime() <= now.getTime()

export class TriggerRuntime {
  private readonly config: TriggerConfig
  private readonly clock: () => Date
  private readonly environment: string
  private readonly loadConnection: (connectionId: string) => Promise<TriggerConnectionState | null>

  constructor(private readonly deps: TriggerRuntimeDeps) {
    this.config = deps.config ?? getTriggerConfig()
    this.clock = deps.clock ?? (() => new Date())
    this.environment = deps.environment ?? getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT
    this.loadConnection = deps.loadConnection ?? defaultLoadConnection
  }

  // ── Queue entry point ───────────────────────────────────────────────────

  /** Processor for `agent-trigger.*` jobs on the existing agent-task queue. */
  async process(job: { name: string; data: unknown; id?: string | null }): Promise<void> {
    if (job.name === AGENT_TASK_JOBS.TRIGGER_TICK) {
      await this.runScheduleTick()
      return
    }
    if (job.name === AGENT_TASK_JOBS.TRIGGER_EVENT) {
      const parsed = TRIGGER_EVENT_JOB_SCHEMA.safeParse(job.data)
      if (!parsed.success || !TRIGGER_EVENT_CATALOG[parsed.data.eventType]) {
        gatewayLogger.warn({ jobId: job.id ?? null, reason: "MALFORMED_EVENT_JOB" }, "agent_gateway_trigger_job_rejected")
        return
      }
      await this.dispatchEvent(parsed.data)
      return
    }
    gatewayLogger.warn({ jobName: job.name }, "agent_gateway_trigger_job_unknown")
  }

  // ── Events ──────────────────────────────────────────────────────────────

  /** Fires every matching ACTIVE event trigger once for this event. */
  async dispatchEvent(event: NormalizedTriggerEvent): Promise<FireResult[]> {
    const definition = TRIGGER_EVENT_CATALOG[event.eventType]
    if (!definition) return []
    const candidates = await listActiveEventTriggers(event.eventType)
    const results: FireResult[] = []
    for (const trigger of candidates) {
      if (!this.eventMatches(trigger, event, !!definition.subjectUserField)) continue
      results.push(await this.fire(trigger, { source: "EVENT", deliveryKey: `event:${event.digest}`, resourceId: event.resourceId }))
    }
    return results
  }

  private eventMatches(trigger: AgentTriggerRow, event: NormalizedTriggerEvent, aboutUser: boolean): boolean {
    if (trigger.environment !== this.environment) return false
    if (trigger.eventResourceId && trigger.eventResourceId !== event.resourceId) return false
    const scope = trigger.eventActorScope ?? "OWNER"
    if (aboutUser) {
      // Events about a user only ever fire that user's own triggers.
      return scope === "OWNER" && !!event.subjectUserId && event.subjectUserId === trigger.ownerId
    }
    if (scope === "OWNER") return !!event.actorId && event.actorId === trigger.ownerId
    return scope === "ANY"
  }

  // ── Schedules ───────────────────────────────────────────────────────────

  /** One scheduler pass (driven by the repeatable `agent-trigger.schedule-tick` job). */
  async runScheduleTick(): Promise<TickReport> {
    const now = this.clock()
    const report: TickReport = { due: 0, fired: 0, skipped: 0, expired: 0, promoted: 0 }
    const due = await listDueSchedules(now, this.config.tickBatch)
    report.due = due.length

    for (const trigger of due) {
      const expected = trigger.nextRunAt ? new Date(trigger.nextRunAt) : null
      if (!expected) continue
      let plan: OccurrencePlan
      try {
        plan = planDueOccurrence(
          {
            scheduleKind: trigger.scheduleKind,
            cronExpression: trigger.cronExpression,
            timezone: trigger.timezone,
            runAt: trigger.runAt,
            missedRunPolicy: trigger.missedRunPolicy,
            nextRunAt: trigger.nextRunAt,
            expiresAt: trigger.expiresAt,
          },
          now,
          { lateToleranceMs: this.config.lateToleranceMs, catchUpWindowMs: this.config.catchUpWindowMs }
        )
      } catch {
        await this.scheduleError(trigger, expected, now)
        continue
      }

      // Exactly one tick owns this occurrence: the conditional nextRunAt claim.
      if (!(await advanceSchedule(trigger.id, expected, plan.nextRunAt, plan.scheduledFor))) continue

      const deliveryKey = `schedule:${plan.scheduledFor.toISOString()}`
      if (plan.fire) {
        await this.fire(trigger, { source: "SCHEDULE", deliveryKey, scheduledFor: plan.scheduledFor })
        report.fired += 1
      } else {
        await this.recordSkipped(trigger, deliveryKey, plan.scheduledFor, now)
        report.skipped += 1
      }
      if (plan.nextRunAt === null) {
        // One-time schedule done, or no occurrence before expiresAt.
        if (await transitionTriggerStatus(trigger.id, ["ACTIVE"], "EXPIRED", { expiredAt: now, nextRunAt: null })) report.expired += 1
      }
    }

    for (const trigger of await listExpiredTriggers(now, this.config.tickBatch)) {
      if (await transitionTriggerStatus(trigger.id, ["ACTIVE", "PAUSED"], "EXPIRED", { expiredAt: now, nextRunAt: null })) report.expired += 1
    }
    report.promoted = await this.releasePending()
    return report
  }

  private async recordSkipped(trigger: AgentTriggerRow, deliveryKey: string, scheduledFor: Date, now: Date): Promise<void> {
    try {
      await createRun({ triggerId: trigger.id, deliveryKey, source: "SCHEDULE", status: "SKIPPED_MISSED", scheduledFor, errorCode: "MISSED_RUN", completedAt: now })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
    }
    await recordTriggerOutcome(trigger.id, "NEUTRAL", now)
    gatewayLogger.info({ triggerRef: trigger.publicRef, scheduledFor: scheduledFor.toISOString() }, "agent_gateway_trigger_run_skipped_missed")
  }

  private async scheduleError(trigger: AgentTriggerRow, occurrence: Date, now: Date): Promise<void> {
    // A schedule that cannot be evaluated stops (fail closed) until a human fixes it.
    const disabled = await transitionTriggerStatus(trigger.id, ["ACTIVE"], "DISABLED", { disabledAt: now, nextRunAt: null })
    if (!disabled) return
    try {
      await createRun({ triggerId: trigger.id, deliveryKey: `schedule-error:${occurrence.toISOString()}`, source: "SCHEDULE", status: "FAILED", errorCode: "SCHEDULE_ERROR", completedAt: now })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
    }
    await recordTriggerOutcome(trigger.id, "FAILURE", now)
    gatewayLogger.warn({ triggerRef: trigger.publicRef, errorCode: "SCHEDULE_ERROR" }, "agent_gateway_trigger_disabled")
  }

  // ── Firing ──────────────────────────────────────────────────────────────

  /**
   * Handles one delivery. Never throws for business outcomes (they are
   * recorded on the run); throws only when storage is unreachable before
   * the delivery was recorded, so the caller (queue / webhook) can retry.
   */
  async fire(triggerHint: Pick<AgentTriggerRow, "id">, delivery: TriggerDelivery): Promise<FireResult> {
    const now = this.clock()
    const trigger = await findTriggerById(triggerHint.id)
    if (!trigger || trigger.status !== "ACTIVE") return { outcome: "INACTIVE" }
    if (isExpired(trigger, now)) {
      await transitionTriggerStatus(trigger.id, ["ACTIVE", "PAUSED"], "EXPIRED", { expiredAt: now, nextRunAt: null })
      return { outcome: "INACTIVE" }
    }

    let run: AgentTriggerRunRow
    try {
      run = await createRun({
        triggerId: trigger.id,
        deliveryKey: delivery.deliveryKey,
        source: delivery.source,
        status: "PENDING",
        resourceId: delivery.resourceId ?? null,
        scheduledFor: delivery.scheduledFor ?? null,
        bodyDigest: delivery.bodyDigest ?? null,
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const existing = await findRunByDelivery(trigger.id, delivery.deliveryKey)
      if (!existing) return { outcome: "DUPLICATE" }
      // A delivery whose task creation failed transiently is retried, not swallowed.
      if (!(await rearmRun(existing.id))) {
        gatewayLogger.info({ triggerRef: trigger.publicRef, runRef: existing.publicRef }, "agent_gateway_trigger_delivery_duplicate")
        return { outcome: "DUPLICATE", runRef: existing.publicRef }
      }
      run = { ...existing, status: "PENDING", errorCode: null, completedAt: null }
    }

    if (trigger.concurrency === "ALLOW_PARALLEL") return this.execute(run, trigger)

    if (await this.acquireActiveSlot(run, trigger, now)) return this.execute(run, trigger)

    if (trigger.concurrency === "QUEUE_ONE" && (await claimPendingSlot(run.id, trigger.id))) {
      gatewayLogger.info({ triggerRef: trigger.publicRef, runRef: run.publicRef }, "agent_gateway_trigger_run_queued")
      return { outcome: "PENDING", runRef: run.publicRef }
    }
    const errorCode = trigger.concurrency === "QUEUE_ONE" ? "COALESCED" : "CONCURRENCY_LIMIT"
    await finishRun(run.id, "DROPPED", this.clock(), { errorCode })
    await recordTriggerOutcome(trigger.id, "NEUTRAL", this.clock())
    gatewayLogger.info({ triggerRef: trigger.publicRef, runRef: run.publicRef, errorCode }, "agent_gateway_trigger_run_dropped")
    return { outcome: "DROPPED", runRef: run.publicRef, errorCode }
  }

  /** Takes the trigger's active slot, first freeing it if its holder is finished or stale. */
  private async acquireActiveSlot(run: AgentTriggerRunRow, trigger: AgentTriggerRow, now: Date): Promise<boolean> {
    if (await claimActiveSlot(run.id, trigger.id, now)) return true
    const holder = await findActiveSlotHolder(trigger.id)
    if (holder && holder.id !== run.id && !(await this.releaseIfDone(holder, trigger, now))) return false
    return claimActiveSlot(run.id, trigger.id, now)
  }

  /**
   * Frees the active slot when its holder can no longer be running work.
   * Returns true when the slot is free afterwards.
   */
  private async releaseIfDone(holder: AgentTriggerRunRow, trigger: AgentTriggerRow, now: Date): Promise<boolean> {
    let taskId = holder.taskId ?? null
    if (!taskId && holder.status === "PENDING") {
      const since = holder.activeSince ? new Date(holder.activeSince).getTime() : new Date(holder.receivedAt).getTime()
      if (now.getTime() - since < STALE_SLOT_MS) return false // task creation in flight
      // Stale: the firing process died. Recover the task if it was created.
      const task = await findTaskByIdempotencyScope(idempotencyScopeFor(trigger.connectionId, triggerIdempotencyKey(holder.publicRef)))
      if (task) {
        await finishRun(holder.id, "TASK_CREATED", now, { taskId: task.id, errorCode: null })
        taskId = task.id
      } else {
        await finishRun(holder.id, "FAILED", now, { errorCode: "TASK_CREATION_FAILED", releaseSlot: true })
        return true
      }
    }
    if (taskId) {
      const task = await findTaskById(taskId)
      if (task && !isTerminalTask(task.status, task.retryScheduled)) return false
    }
    await releaseActiveSlot(holder.id, trigger.id)
    return true
  }

  /** Promotes waiting QUEUE_ONE runs whose trigger's active slot has become free. */
  async releasePending(): Promise<number> {
    let promoted = 0
    for (const run of await listPendingRuns(this.config.tickBatch)) {
      const now = this.clock()
      const trigger = await findTriggerById(run.triggerId)
      if (!trigger || trigger.status !== "ACTIVE" || isExpired(trigger, now)) {
        await dropPendingRun(run.id, run.triggerId, now, "TRIGGER_INACTIVE")
        continue
      }
      const holder = await findActiveSlotHolder(trigger.id)
      if (holder && !(await this.releaseIfDone(holder, trigger, now))) continue
      if (!(await promotePendingRun(run.id, trigger.id, now))) continue
      promoted += 1
      await this.execute({ ...run, pendingSlotKey: null, activeSlotKey: trigger.id, activeSince: now }, trigger)
    }
    return promoted
  }

  // ── Task creation ───────────────────────────────────────────────────────

  private async execute(run: AgentTriggerRunRow, trigger: AgentTriggerRow): Promise<FireResult> {
    const now = this.clock()
    const finish = async (status: TriggerRunStatus, errorCode: string, retryable = false): Promise<FireResult> => {
      await finishRun(run.id, status, this.clock(), { errorCode, releaseSlot: true })
      await recordTriggerOutcome(trigger.id, status === "APPROVAL_REQUIRED" ? "NEUTRAL" : "FAILURE", this.clock())
      gatewayLogger.info({ triggerRef: trigger.publicRef, runRef: run.publicRef, status, errorCode }, "agent_gateway_trigger_run_finished")
      return { outcome: status as FireOutcome, runRef: run.publicRef, errorCode, ...(retryable ? { retryable } : {}) }
    }

    // 1. The connection, from the database.
    let connection: TriggerConnectionState | null
    try {
      connection = await this.loadConnection(trigger.connectionId)
    } catch {
      return finish("FAILED", "TASK_CREATION_FAILED", true)
    }
    const connectionExpired = !!connection && (connection.status === "EXPIRED" || (!!connection.expiresAt && new Date(connection.expiresAt).getTime() <= now.getTime()))
    if (!connection || connection.status === "REVOKED") {
      await transitionTriggerStatus(trigger.id, LIVE_STATUSES, "REVOKED", { revokedAt: now, nextRunAt: null })
      return finish("DENIED", "AUTHORIZATION_DENIED")
    }
    if (connectionExpired) {
      await transitionTriggerStatus(trigger.id, ["ACTIVE", "PAUSED"], "EXPIRED", { expiredAt: now, nextRunAt: null })
      return finish("DENIED", "AUTHORIZATION_DENIED")
    }
    if (connection.status !== "ACTIVE" || connection.ownerId !== trigger.ownerId) return finish("DENIED", "AUTHORIZATION_DENIED")
    if (connection.environment !== trigger.environment || trigger.environment !== this.environment) return finish("DENIED", "AUTHORIZATION_DENIED")

    // 2. The pinned capability version must still be the current one.
    const capability = this.currentPinnedCapability(trigger)
    if (!capability) {
      await transitionTriggerStatus(trigger.id, ["ACTIVE"], "DISABLED", { disabledAt: now, nextRunAt: null })
      gatewayLogger.warn({ triggerRef: trigger.publicRef, errorCode: "TRIGGER_VALIDATION_FAILED" }, "agent_gateway_trigger_disabled")
      return finish("FAILED", "TRIGGER_VALIDATION_FAILED")
    }

    // 3. The stored input, plus (only) the bound resource id.
    const input: Record<string, unknown> = { ...((trigger.input ?? {}) as Record<string, unknown>) }
    if (trigger.bindResource) {
      const locator = capability.resource.resourceLocator
      if (!locator || typeof run.resourceId !== "string" || !RESOURCE_ID_PATTERN.test(run.resourceId)) return finish("FAILED", "CONDITION_ERROR")
      input[locator] = run.resourceId
    }

    // 4. The same submission chain as an agent call.
    try {
      const result = await this.deps.taskService.submit(
        this.syntheticContext(trigger, connection, now),
        trigger.environment,
        { capabilityId: trigger.capabilityId, input, idempotencyKey: triggerIdempotencyKey(run.publicRef) },
        { triggerId: trigger.id }
      )
      const doneAt = this.clock()
      try {
        await finishRun(run.id, "TASK_CREATED", doneAt, { taskId: result.taskId, errorCode: null })
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
        // The task is already linked to another run of this trigger: never link it twice.
        await finishRun(run.id, "FAILED", doneAt, { errorCode: "TASK_CREATION_FAILED", releaseSlot: true })
        return { outcome: "FAILED", runRef: run.publicRef, errorCode: "TASK_CREATION_FAILED" }
      }
      await recordTriggerOutcome(trigger.id, "SUCCESS", doneAt)
      gatewayLogger.info({ triggerRef: trigger.publicRef, runRef: run.publicRef, taskRef: result.task.taskRef, created: result.created }, "agent_gateway_trigger_task_created")
      return { outcome: "TASK_CREATED", runRef: run.publicRef }
    } catch (err) {
      if (err instanceof AuthorizationDeniedError) {
        return err.code === "APPROVAL_REQUIRED" ? finish("APPROVAL_REQUIRED", "APPROVAL_REQUIRED") : finish("DENIED", "AUTHORIZATION_DENIED")
      }
      if (err instanceof TaskError) {
        switch (err.code) {
          case "QUEUE_UNAVAILABLE":
            return finish("FAILED", "QUEUE_UNAVAILABLE", true)
          case "TASK_STORE_UNAVAILABLE":
            return finish("FAILED", "TASK_CREATION_FAILED", true)
          case "AUTHORIZATION_REVOKED":
          case "ENVIRONMENT_MISMATCH":
          case "APPROVAL_EXPIRED":
            return finish("DENIED", "AUTHORIZATION_DENIED")
          default:
            // Configuration no longer valid (input / capability / idempotency).
            return finish("FAILED", "TRIGGER_VALIDATION_FAILED")
        }
      }
      return finish("FAILED", "TASK_CREATION_FAILED", true)
    }
  }

  private currentPinnedCapability(trigger: AgentTriggerRow): CapabilityDefinition | null {
    let current: CapabilityDefinition | null
    try {
      current = this.deps.capabilityRegistry.get(trigger.capabilityId)
    } catch {
      current = null
    }
    if (!current || current.version !== trigger.capabilityVersion) return null
    if (current.status !== "ACTIVE" || current.exposure !== "AGENT_AVAILABLE" || !current.async.asyncSupported) return null
    return current
  }

  /**
   * The trigger acts as its connection, with the connection's LIVE state.
   * The credential id is a non-credential marker (like Phase 8's worker).
   */
  private syntheticContext(trigger: AgentTriggerRow, connection: TriggerConnectionState, now: Date): AgentGatewayRequestContext {
    const agentId = connection.externalAgentId ?? undefined
    return {
      requestId: generateRequestId(),
      receivedAt: now,
      authenticated: true,
      machine: {
        connectionId: trigger.connectionId,
        credentialId: `agent-trigger:${trigger.publicRef}`,
        ownerId: connection.ownerId,
        agentId,
        teamId: connection.teamId,
        connectionStatus: "ACTIVE",
        authenticatedAt: now,
      },
      connectionId: trigger.connectionId,
      ownerId: connection.ownerId,
      agentId,
      teamId: connection.teamId ?? undefined,
      protocol: "MCP",
      signal: new AbortController().signal,
    }
  }
}
