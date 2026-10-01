/**
 * lib/agent-gateway/governance/health.ts
 *
 * Runtime / health snapshot for administrators. Reuses the public gateway
 * health check (lib/agent-gateway/health.ts) and adds operator detail that
 * must never be public: feature switches, the agent-task queue depth, stuck
 * tasks, overdue schedules, approval backlog. Values only — never URLs,
 * hosts, credentials or secret names. Each probe is bounded and degrades to
 * "unavailable" instead of failing the page.
 */
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"
import { env } from "@/lib/env"
import { agentTaskQueue } from "@/lib/queue"
import { getGatewayConfig } from "../config"
import { getGatewayHealth, type GatewayHealthPayload } from "../health"
import { getMcpConfig } from "../mcp/config"
import { getTaskEngineConfig } from "../tasks/config"
import { getTriggerConfig } from "../triggers/config"

const PROBE_TIMEOUT_MS = 2_000
const DAY = 24 * 60 * 60_000

async function bounded<T>(work: () => Promise<T>, timeoutMs = PROBE_TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type QueueCounts = Record<"waiting" | "active" | "delayed" | "failed" | "completed", number>

export interface RuntimeSnapshot {
  generatedAt: string
  environment: string
  flags: { gateway: boolean; mcp: boolean; signedRequests: boolean; tasks: boolean; triggers: boolean }
  health: GatewayHealthPayload | null
  redisControls: "configured" | "not-configured"
  queue: { state: "ok" | "not-configured" | "unavailable"; counts: QueueCounts | null }
  tasks: {
    stuckStarting: number
    stuckRunning: number
    overdueQueued: number
    stuckRefs: string[]
  }
  schedules: { overdue: number; oldestOverdueAt: string | null }
  approvals: { pending: number; oldestPendingAt: string | null }
  triggers: { failing: number; failedRunsLast24h: number }
  limits: {
    taskQueueTimeoutMs: number
    taskExecutionTimeoutMs: number
    taskDeadlineMs: number
    triggerMinIntervalMs: number
    triggerLateToleranceMs: number
    webhookMaxBodyBytes: number
  }
}

export interface RuntimeDeps {
  queueCounts?: () => Promise<QueueCounts>
  queueConfigured?: () => boolean
  gatewayHealth?: () => Promise<GatewayHealthPayload>
}

async function defaultQueueCounts(): Promise<QueueCounts> {
  const counts = (await agentTaskQueue.getJobCounts("waiting", "active", "delayed", "failed", "completed")) as Partial<QueueCounts> | undefined
  if (!counts || typeof counts !== "object") throw new Error("queue unavailable")
  return { waiting: counts.waiting ?? 0, active: counts.active ?? 0, delayed: counts.delayed ?? 0, failed: counts.failed ?? 0, completed: counts.completed ?? 0 }
}

export async function getRuntimeSnapshot(now: Date = new Date(), deps: RuntimeDeps = {}): Promise<RuntimeSnapshot> {
  const gateway = getGatewayConfig()
  const tasks = getTaskEngineConfig()
  const triggers = getTriggerConfig()
  const queueConfigured = (deps.queueConfigured ?? (() => !!env.REDIS_URL))()
  const t = now.getTime()

  const [health, counts, stuckStarting, stuckRunning, overdueQueued, stuck, overdue, oldestOverdue, pending, oldestPending, failing, failedRuns] = await Promise.all([
    bounded(deps.gatewayHealth ?? getGatewayHealth),
    queueConfigured ? bounded(deps.queueCounts ?? defaultQueueCounts) : Promise.resolve(null),
    db.agentTask.count({ where: { status: "STARTING", attemptStartedAt: { lt: new Date(t - tasks.startingGraceMs) } } }),
    db.agentTask.count({ where: { status: "RUNNING", attemptStartedAt: { lt: new Date(t - tasks.executionTimeoutMs - 60_000) } } }),
    db.agentTask.count({ where: { status: { in: ["QUEUED", "RETRY_QUEUED"] }, queuedAt: { lt: new Date(t - tasks.queueTimeoutMs) } } }),
    db.agentTask.findMany({
      where: {
        OR: [
          { status: "STARTING", attemptStartedAt: { lt: new Date(t - tasks.startingGraceMs) } },
          { status: "RUNNING", attemptStartedAt: { lt: new Date(t - tasks.executionTimeoutMs - 60_000) } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { taskRef: true },
    }),
    db.agentTrigger.count({ where: { type: "SCHEDULE", status: "ACTIVE", nextRunAt: { lt: new Date(t - 2 * triggers.lateToleranceMs) } } }),
    db.agentTrigger.findFirst({
      where: { type: "SCHEDULE", status: "ACTIVE", nextRunAt: { lt: new Date(t - 2 * triggers.lateToleranceMs) } },
      orderBy: { nextRunAt: "asc" },
      select: { nextRunAt: true },
    }),
    db.agentApprovalRequest.count({ where: { status: "PENDING", expiresAt: { gt: now } } }),
    db.agentApprovalRequest.findFirst({ where: { status: "PENDING", expiresAt: { gt: now } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.agentTrigger.count({ where: { failureCount: { gt: 0 }, status: { in: ["ACTIVE", "PAUSED"] } } }),
    db.agentTriggerRun.count({ where: { status: "FAILED", receivedAt: { gte: new Date(t - DAY) } } }),
  ])

  return {
    generatedAt: now.toISOString(),
    environment: gateway.AGENT_GATEWAY_ENVIRONMENT,
    flags: {
      gateway: gateway.AGENT_GATEWAY_ENABLED,
      mcp: !!getMcpConfig().AGENT_GATEWAY_MCP_ENABLED,
      signedRequests: gateway.AGENT_GATEWAY_SIGNING_ENABLED,
      tasks: tasks.enabled,
      triggers: triggers.enabled,
    },
    health,
    redisControls: redis ? "configured" : "not-configured",
    queue: { state: !queueConfigured ? "not-configured" : counts ? "ok" : "unavailable", counts },
    tasks: { stuckStarting, stuckRunning, overdueQueued, stuckRefs: stuck.map((s) => s.taskRef) },
    schedules: { overdue, oldestOverdueAt: oldestOverdue?.nextRunAt ? new Date(oldestOverdue.nextRunAt).toISOString() : null },
    approvals: { pending, oldestPendingAt: oldestPending ? new Date(oldestPending.createdAt).toISOString() : null },
    triggers: { failing, failedRunsLast24h: failedRuns },
    limits: {
      taskQueueTimeoutMs: tasks.queueTimeoutMs,
      taskExecutionTimeoutMs: tasks.executionTimeoutMs,
      taskDeadlineMs: tasks.deadlineMs,
      triggerMinIntervalMs: triggers.minIntervalMs,
      triggerLateToleranceMs: triggers.lateToleranceMs,
      webhookMaxBodyBytes: triggers.webhookMaxBodyBytes,
    },
  }
}
