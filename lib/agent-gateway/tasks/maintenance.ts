/**
 * lib/agent-gateway/tasks/maintenance.ts
 *
 * Sweep, reconcile and retention for agent tasks — one bounded pass.
 * Invoked (a) once when the task worker starts, and (b) by the repeatable
 * `agent-task.maintenance` job registered in the EXISTING
 * scheduleRecurringJobs() (lib/workers.ts). No new scheduler.
 *
 *   sweep      expire pending tasks past their queue timeout / deadline;
 *              time out running tasks past their execution timeout / deadline
 *   reconcile  re-enqueue pending tasks whose job is missing (Redis data loss),
 *              finish retries whose RETRY_QUEUED step was lost, and recover
 *              STARTING attempts abandoned by a crashed worker
 *   retention  drop stored results, then whole rows, of old terminal tasks
 *
 * Every change is a conditional transition, so maintenance racing a live
 * worker can never double-act.
 */
import { gatewayLogger } from "../observability/request-log"
import { clearResultsFinishedBefore, deleteTasksFinishedBefore, listTasks } from "./store"
import { applyDueTimeTransition, failAttempt, payloadFor, scheduleRetry, type LifecycleDeps } from "./lifecycle"
import { jobIdFor } from "./ids"
import { ReleaseService } from "../rollout/release-service"
import { getCapabilityRegistry } from "../capabilities"
import { getGatewayConfig } from "../config"

const BATCH = 200
/** A FAILED task waiting longer than this for its RETRY_QUEUED step is considered stuck. */
const RETRY_STEP_GRACE_MS = 30_000

export interface MaintenanceReport {
  expired: number
  timedOut: number
  requeued: number
  retriesCompleted: number
  recoveredStarting: number
  resultsCleared: number
  deleted: number
  /** Phase 15 — INTERNAL / CANARY rollouts paused by their health gate in this pass. */
  autoPaused: number
  errors: number
}

export async function runTaskMaintenance(deps: LifecycleDeps, at?: Date): Promise<MaintenanceReport> {
  const now = at ?? deps.clock()
  const report: MaintenanceReport = { expired: 0, timedOut: 0, requeued: 0, retriesCompleted: 0, recoveredStarting: 0, resultsCleared: 0, deleted: 0, autoPaused: 0, errors: 0 }
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run()
    } catch {
      report.errors += 1
      gatewayLogger.warn({ step: name }, "agent_gateway_task_maintenance_step_failed")
    }
  }

  // Sweep: time rules for pending and running tasks.
  await step("sweep", async () => {
    const queueCutoff = new Date(now.getTime() - deps.config.queueTimeoutMs)
    const execCutoff = new Date(now.getTime() - deps.config.executionTimeoutMs)
    const pending = await listTasks(
      { status: { in: ["QUEUED", "RETRY_QUEUED"] }, OR: [{ expiresAt: { lte: now } }, { queuedAt: { lte: queueCutoff } }] },
      BATCH
    )
    for (const task of pending) if (await applyDueTimeTransition(task, deps.config, now)) report.expired += 1
    const running = await listTasks(
      { status: { in: ["RUNNING", "CANCELLING"] }, OR: [{ expiresAt: { lte: now } }, { attemptStartedAt: { lte: execCutoff } }] },
      BATCH
    )
    for (const task of running) if (await applyDueTimeTransition(task, deps.config, now)) report.timedOut += 1
  })

  // Reconcile: attempts abandoned between claim and dispatch.
  await step("recover-starting", async () => {
    const graceCutoff = new Date(now.getTime() - deps.config.startingGraceMs)
    const stuck = await listTasks({ status: "STARTING", attemptStartedAt: { lte: graceCutoff } }, BATCH)
    for (const task of stuck) {
      if (await applyDueTimeTransition(task, deps.config, now)) {
        report.expired += 1
        continue
      }
      await failAttempt(task, { preDispatch: true, transient: true, detailCode: "WORKER_INTERRUPTED" }, deps)
      report.recoveredStarting += 1
    }
  })

  // Reconcile: FAILED rows whose retry never reached RETRY_QUEUED.
  await step("complete-retries", async () => {
    const cutoff = new Date(now.getTime() - RETRY_STEP_GRACE_MS)
    const failed = await listTasks({ status: "FAILED", retryScheduled: true, failedAt: { lte: cutoff } }, BATCH)
    for (const task of failed) if (await scheduleRetry(task, deps)) report.retriesCompleted += 1
  })

  // Reconcile: pending tasks whose job is gone (e.g. Redis restarted without persistence).
  await step("requeue", async () => {
    if (!deps.queue.isConfigured()) return
    const pending = await listTasks({ status: { in: ["QUEUED", "RETRY_QUEUED"] }, expiresAt: { gt: now } }, BATCH)
    for (const task of pending) {
      const next = task.attempts + 1
      const jobId = jobIdFor(task.id, next)
      if (await deps.queue.hasJob(jobId)) continue
      await deps.queue.enqueue(payloadFor(task, next), { jobId })
      report.requeued += 1
    }
  })

  // Retention.
  await step("retention", async () => {
    report.resultsCleared = await clearResultsFinishedBefore(new Date(now.getTime() - deps.config.resultRetentionMs), now)
    report.deleted = await deleteTasksFinishedBefore(new Date(now.getTime() - deps.config.taskRetentionMs))
  })

  // Phase 15 — health gates: pause progressive rollouts that are failing (never GENERAL; see rollout/release-service.ts).
  await step("release-health", async () => {
    const service = new ReleaseService({ registry: getCapabilityRegistry(), environment: getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT, clock: () => now })
    report.autoPaused = (await service.autoPauseUnhealthy()).length
  })

  gatewayLogger.info({ ...report }, "agent_gateway_task_maintenance")
  return report
}
