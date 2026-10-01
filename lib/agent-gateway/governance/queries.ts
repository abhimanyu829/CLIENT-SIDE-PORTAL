/**
 * lib/agent-gateway/governance/queries.ts
 *
 * Read models for the Agent Governance pages. Read-only; every list is
 * server-side paginated (`skip` / `take PAGE_SIZE` + count) and filtered by
 * allowlisted values only. Projections come from views.ts (no secrets, no
 * hashes, no task input / result). The data stays in its existing tables —
 * governance introduces no second source of truth.
 */
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getCapabilityRegistry } from "../capabilities"
import type { CapabilityDefinition } from "../capabilities/types"
import { getGatewayConfig } from "../config"
import { TRIGGER_EVENT_CATALOG } from "../triggers/event-catalog"
import { nextOccurrences } from "../triggers/schedule"
import { toTriggerRunView, toTriggerView } from "../triggers/view"
import type { AgentTriggerRow, AgentTriggerRunRow, TriggerRunView, TriggerView } from "../triggers/types"
import { TRIGGER_STATUSES } from "../triggers/types"
import { AGENT_TASK_STATUSES } from "../tasks/types"
import { AUTONOMY_LEVELS } from "../autonomy/types"
import { PAGE_SIZE, pageMeta, skipFor, type Paged } from "./pagination"
import {
  toApprovalListAdminView,
  toAutonomyAdminView,
  toCapabilityAdminView,
  toConnectionAdminView,
  toCredentialAdminView,
  toPolicyAdminView,
  toPolicyVersionAdminView,
  toTaskAdminView,
  type ApprovalListAdminView,
  type AutonomyAdminView,
  type CapabilityAdminView,
  type ConnectionAdminView,
  type CredentialAdminView,
  type PolicyAdminView,
  type PolicyVersionAdminView,
  type TaskAdminView,
} from "./views"

export const CONNECTION_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"] as const
export const CONNECTION_ENVIRONMENTS = ["development", "staging", "production"] as const
export const AUTH_METHODS = ["BEARER", "SIGNED_REQUEST"] as const
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "CONSUMED"] as const
export const TRIGGER_TYPES = ["EVENT", "WEBHOOK", "SCHEDULE"] as const
export const TASK_ORIGINS = ["AGENT", "TRIGGER"] as const
export const RISK_TIERS = ["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"] as const
export const EXPOSURES = ["PUBLIC_DISCOVERABLE", "INTERNAL_ONLY", "AGENT_AVAILABLE", "DISABLED", "DEPRECATED", "FORBIDDEN"] as const
export const LIVE_TRIGGER_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "DISABLED"] as const

const DAY = 24 * 60 * 60_000

async function paged<T, R>(rowsPromise: Promise<R[]>, totalPromise: Promise<number>, page: number, map: (row: R) => T): Promise<Paged<T>> {
  const [rows, total] = await Promise.all([rowsPromise, totalPromise])
  return { rows: rows.map(map), meta: pageMeta(total, page) }
}

async function countBy<K extends string>(keys: readonly K[], count: (key: K) => Promise<number>): Promise<Record<K, number>> {
  const values = await Promise.all(keys.map((key) => count(key)))
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Record<K, number>
}

// ── Overview ─────────────────────────────────────────────────────────────

export interface GovernanceOverview {
  connections: Record<(typeof CONNECTION_STATUSES)[number], number>
  tasks: Record<(typeof AGENT_TASK_STATUSES)[number], number>
  tasksLast24h: number
  triggers: Record<(typeof TRIGGER_STATUSES)[number], number>
  triggersByType: Record<(typeof TRIGGER_TYPES)[number], number>
  pendingApprovals: number
  oldestPendingApprovalAt: string | null
  failingTriggers: Array<{ triggerRef: string; name: string; type: string; failureCount: number; lastFailureAt: string | null }>
}

export async function getOverview(now: Date = new Date()): Promise<GovernanceOverview> {
  const [connections, tasks, triggers, triggersByType, tasksLast24h, pendingApprovals, oldest, failing] = await Promise.all([
    countBy(CONNECTION_STATUSES, (status) => db.agentConnection.count({ where: { status } })),
    countBy(AGENT_TASK_STATUSES, (status) => db.agentTask.count({ where: { status } })),
    countBy(TRIGGER_STATUSES, (status) => db.agentTrigger.count({ where: { status } })),
    countBy(TRIGGER_TYPES, (type) => db.agentTrigger.count({ where: { type, status: { in: [...LIVE_TRIGGER_STATUSES] } } })),
    db.agentTask.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY) } } }),
    db.agentApprovalRequest.count({ where: { status: "PENDING", expiresAt: { gt: now } } }),
    db.agentApprovalRequest.findFirst({ where: { status: "PENDING", expiresAt: { gt: now } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.agentTrigger.findMany({
      where: { failureCount: { gt: 0 }, status: { in: [...LIVE_TRIGGER_STATUSES] } },
      orderBy: { lastFailureAt: "desc" },
      take: 5,
      select: { publicRef: true, name: true, type: true, failureCount: true, lastFailureAt: true },
    }),
  ])
  return {
    connections,
    tasks,
    tasksLast24h,
    triggers,
    triggersByType,
    pendingApprovals,
    oldestPendingApprovalAt: oldest ? new Date(oldest.createdAt).toISOString() : null,
    failingTriggers: failing.map((t) => ({
      triggerRef: t.publicRef,
      name: t.name,
      type: t.type,
      failureCount: t.failureCount,
      lastFailureAt: t.lastFailureAt ? new Date(t.lastFailureAt).toISOString() : null,
    })),
  }
}

// ── Connections ──────────────────────────────────────────────────────────

export interface ConnectionFilters {
  status?: (typeof CONNECTION_STATUSES)[number]
  environment?: (typeof CONNECTION_ENVIRONMENTS)[number]
  authMethod?: (typeof AUTH_METHODS)[number]
  page: number
}

export async function listConnections(filters: ConnectionFilters): Promise<Paged<ConnectionAdminView>> {
  const where: Prisma.AgentConnectionWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.environment ? { environment: filters.environment } : {}),
    ...(filters.authMethod ? { authMethod: filters.authMethod } : {}),
  }
  return paged(
    db.agentConnection.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE }),
    db.agentConnection.count({ where }),
    filters.page,
    (row) => toConnectionAdminView(row as unknown as Record<string, unknown>)
  )
}

export interface ConnectionDetail {
  connection: ConnectionAdminView
  credentials: CredentialAdminView[]
  autonomy: { active: AutonomyAdminView | null; latestVersion: number; history: AutonomyAdminView[] }
  triggers: TriggerView[]
  recentTasks: TaskAdminView[]
  pendingApprovals: number
}

export async function getConnectionDetail(id: string, now: Date = new Date()): Promise<ConnectionDetail | null> {
  const row = await db.agentConnection.findUnique({ where: { id } })
  if (!row) return null
  const [credentials, history, triggers, tasks, pendingApprovals] = await Promise.all([
    db.agentCredential.findMany({ where: { connectionId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.agentAutonomyPolicy.findMany({ where: { connectionId: id }, orderBy: { version: "desc" }, take: 20 }),
    db.agentTrigger.findMany({ where: { connectionId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.agentTask.findMany({ where: { connectionId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.agentApprovalRequest.count({ where: { connectionId: id, status: "PENDING", expiresAt: { gt: now } } }),
  ])
  const historyViews = history.map((h) => toAutonomyAdminView(h as unknown as Record<string, unknown>))
  return {
    connection: toConnectionAdminView(row as unknown as Record<string, unknown>),
    credentials: credentials.map((c) => toCredentialAdminView(c as unknown as Record<string, unknown>)),
    autonomy: {
      active: historyViews.find((h) => h.status === "ACTIVE") ?? null,
      latestVersion: historyViews[0]?.version ?? 0,
      history: historyViews,
    },
    triggers: triggers.map((t) => toTriggerView(t as AgentTriggerRow)),
    recentTasks: tasks.map((t) => toTaskAdminView(t as unknown as Record<string, unknown>)),
    pendingApprovals,
  }
}

// ── Capabilities (the Phase 3 registry is the only source) ───────────────

export interface CapabilityFilters {
  exposure?: (typeof EXPOSURES)[number]
  riskTier?: (typeof RISK_TIERS)[number]
  asyncOnly?: boolean
}

export async function listCapabilities(filters: CapabilityFilters = {}): Promise<CapabilityAdminView[]> {
  const environment = getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT
  const defs = getCapabilityRegistry()
    .list({ includeDisabled: true, includeForbidden: true })
    .filter((d) => (!filters.exposure || d.exposure === filters.exposure) && (!filters.riskTier || d.operationType === filters.riskTier) && (!filters.asyncOnly || d.async.asyncSupported === true))
    .sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version)
  const [policyVersions, triggers] = await Promise.all([
    db.agentPolicyVersion.findMany({ where: { status: "ACTIVE" }, select: { capabilityId: true } }),
    db.agentTrigger.findMany({ where: { status: { in: [...LIVE_TRIGGER_STATUSES] } }, select: { capabilityId: true }, take: 10_000 }),
  ])
  const tally = (rows: Array<{ capabilityId: string | null }>) => {
    const out = new Map<string, number>()
    for (const r of rows) if (r.capabilityId) out.set(r.capabilityId, (out.get(r.capabilityId) ?? 0) + 1)
    return out
  }
  const byPolicy = tally(policyVersions as Array<{ capabilityId: string | null }>)
  const byTrigger = tally(triggers as Array<{ capabilityId: string | null }>)
  return defs.map((d) => toCapabilityAdminView(d, environment, { policies: byPolicy.get(d.id) ?? 0, triggers: byTrigger.get(d.id) ?? 0 }))
}

/** Every registered capability id (policy and autonomy forms). */
export function allCapabilityIds(): string[] {
  return Array.from(new Set(getCapabilityRegistry().list({ includeDisabled: true, includeForbidden: true }).map((d) => d.id))).sort()
}

// ── Policies (Phase 6) ───────────────────────────────────────────────────

export interface PolicyFilters {
  enabled?: boolean
  page: number
}

export async function listPolicies(filters: PolicyFilters): Promise<Paged<PolicyAdminView>> {
  const where: Prisma.AgentPolicyWhereInput = filters.enabled === undefined ? {} : { enabled: filters.enabled }
  const [rows, total] = await Promise.all([
    db.agentPolicy.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE }),
    db.agentPolicy.count({ where }),
  ])
  const currentIds = rows.map((r) => r.currentVersionId).filter((v): v is string => typeof v === "string")
  const current = currentIds.length ? await db.agentPolicyVersion.findMany({ where: { id: { in: currentIds } } }) : []
  const byId = new Map(current.map((v) => [v.id, v]))
  return {
    rows: rows.map((r) => {
      const cur = r.currentVersionId ? byId.get(r.currentVersionId) ?? null : null
      // The current version is always the newest one (every change creates version N+1).
      return toPolicyAdminView(r as unknown as Record<string, unknown>, cur as unknown as Record<string, unknown> | null, cur ? cur.version : 0)
    }),
    meta: pageMeta(total, filters.page),
  }
}

export interface PolicyDetail {
  policy: PolicyAdminView
  versions: PolicyVersionAdminView[]
}

export async function getPolicyDetail(id: string): Promise<PolicyDetail | null> {
  const row = await db.agentPolicy.findUnique({ where: { id } })
  if (!row) return null
  const versions = await db.agentPolicyVersion.findMany({ where: { policyId: id }, orderBy: { version: "desc" }, take: 50 })
  const current = versions.find((v) => v.id === row.currentVersionId) ?? null
  const latest = versions[0]?.version ?? 0
  return {
    policy: toPolicyAdminView(row as unknown as Record<string, unknown>, current as unknown as Record<string, unknown> | null, latest),
    versions: versions.map((v) => toPolicyVersionAdminView(v as unknown as Record<string, unknown>)),
  }
}

// ── Autonomy (Phase 7) ───────────────────────────────────────────────────

export interface AutonomyFilters {
  level?: (typeof AUTONOMY_LEVELS)[number]
  page: number
}

export interface AutonomyListRow extends AutonomyAdminView {
  connectionId: string
  connectionName: string
  connectionStatus: string
}

export async function listAutonomy(filters: AutonomyFilters): Promise<Paged<AutonomyListRow> & { defaultPostureConnections: number }> {
  const where: Prisma.AgentAutonomyPolicyWhereInput = { status: "ACTIVE", ...(filters.level ? { autonomyLevel: filters.level } : {}) }
  const [rows, total, activeIds] = await Promise.all([
    db.agentAutonomyPolicy.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE }),
    db.agentAutonomyPolicy.count({ where }),
    db.agentAutonomyPolicy.findMany({ where: { status: "ACTIVE" }, select: { connectionId: true }, take: 10_000 }),
  ])
  const ids = Array.from(new Set(rows.map((r) => r.connectionId)))
  const connections = ids.length ? await db.agentConnection.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, status: true } }) : []
  const byId = new Map(connections.map((c) => [c.id, c]))
  const withPolicy = Array.from(new Set(activeIds.map((r) => r.connectionId)))
  const defaultPostureConnections = await db.agentConnection.count({
    where: { status: { in: ["ACTIVE", "SUSPENDED", "PENDING"] }, ...(withPolicy.length ? { NOT: { id: { in: withPolicy } } } : {}) },
  })
  return {
    rows: rows.map((r) => ({
      ...toAutonomyAdminView(r as unknown as Record<string, unknown>),
      connectionId: r.connectionId,
      connectionName: byId.get(r.connectionId)?.name ?? r.connectionId,
      connectionStatus: byId.get(r.connectionId)?.status ?? "UNKNOWN",
    })),
    meta: pageMeta(total, filters.page),
    defaultPostureConnections,
  }
}

// ── Approvals (Phase 7) ──────────────────────────────────────────────────

export interface ApprovalFilters {
  status?: (typeof APPROVAL_STATUSES)[number]
  connectionId?: string
  page: number
}

const APPROVAL_LIST_SELECT = {
  publicRef: true,
  status: true,
  capabilityId: true,
  capabilityVersion: true,
  riskTier: true,
  connectionId: true,
  environment: true,
  resourceType: true,
  resourceId: true,
  createdAt: true,
  expiresAt: true,
} as const

function approvalStatusWhere(status: ApprovalFilters["status"], now: Date): Prisma.AgentApprovalRequestWhereInput {
  switch (status) {
    case undefined:
      return {}
    case "PENDING":
    case "APPROVED":
      return { status, expiresAt: { gt: now } }
    case "EXPIRED":
      // Display-time expiry: live rows past their deadline are expired too.
      return { OR: [{ status: "EXPIRED" }, { status: { in: ["PENDING", "APPROVED"] }, expiresAt: { lte: now } }] }
    default:
      return { status }
  }
}

export async function listApprovals(filters: ApprovalFilters, now: Date = new Date()): Promise<Paged<ApprovalListAdminView>> {
  const where: Prisma.AgentApprovalRequestWhereInput = {
    ...approvalStatusWhere(filters.status, now),
    ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
  }
  return paged(
    db.agentApprovalRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE, select: APPROVAL_LIST_SELECT }),
    db.agentApprovalRequest.count({ where }),
    filters.page,
    (row) => toApprovalListAdminView(row as unknown as Record<string, unknown>, now)
  )
}

// ── Tasks (Phase 8) ──────────────────────────────────────────────────────

export interface TaskFilters {
  status?: (typeof AGENT_TASK_STATUSES)[number]
  origin?: (typeof TASK_ORIGINS)[number]
  capabilityId?: string
  connectionId?: string
  page: number
}

export async function listTasks(filters: TaskFilters): Promise<Paged<TaskAdminView>> {
  const where: Prisma.AgentTaskWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.origin === "AGENT" ? { triggerId: null } : {}),
    ...(filters.origin === "TRIGGER" ? { NOT: { triggerId: null } } : {}),
    ...(filters.capabilityId ? { capabilityId: filters.capabilityId } : {}),
    ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
  }
  return paged(
    db.agentTask.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE }),
    db.agentTask.count({ where }),
    filters.page,
    (row) => toTaskAdminView(row as unknown as Record<string, unknown>)
  )
}

export async function getTaskDetail(taskRef: string): Promise<TaskAdminView | null> {
  const row = await db.agentTask.findUnique({ where: { taskRef } })
  if (!row) return null
  const [trigger, approval] = await Promise.all([
    row.triggerId ? db.agentTrigger.findUnique({ where: { id: row.triggerId }, select: { publicRef: true } }) : null,
    row.approvalRequestId ? db.agentApprovalRequest.findUnique({ where: { id: row.approvalRequestId }, select: { publicRef: true } }) : null,
  ])
  return toTaskAdminView(row as unknown as Record<string, unknown>, { triggerRef: trigger?.publicRef ?? null, approvalRef: approval?.publicRef ?? null })
}

// ── Triggers (Phase 9) ───────────────────────────────────────────────────

export interface TriggerFilters {
  type?: (typeof TRIGGER_TYPES)[number]
  status?: (typeof TRIGGER_STATUSES)[number]
  connectionId?: string
  page: number
}

export async function listTriggers(filters: TriggerFilters): Promise<Paged<TriggerView>> {
  const where: Prisma.AgentTriggerWhereInput = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
  }
  return paged(
    db.agentTrigger.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE }),
    db.agentTrigger.count({ where }),
    filters.page,
    (row) => toTriggerView(row as AgentTriggerRow)
  )
}

export interface TriggerRunAdminView extends TriggerRunView {
  taskRef: string | null
  taskStatus: string | null
}

/** The next occurrences of an ACTIVE schedule (display only; Postgres nextRunAt is authoritative). */
export function upcomingOccurrences(trigger: TriggerView, count = 3): string[] {
  const schedule = trigger.schedule
  if (!schedule || trigger.status !== "ACTIVE" || !schedule.nextRunAt) return []
  if (schedule.kind === "ONCE") return [schedule.nextRunAt]
  if (!schedule.cron) return []
  try {
    const first = new Date(schedule.nextRunAt)
    return [first, ...nextOccurrences(schedule.cron, schedule.timezone, first, Math.max(0, count - 1))].map((d) => d.toISOString())
  } catch {
    return []
  }
}

export interface TriggerDetail {
  trigger: TriggerView
  connectionName: string | null
  runs: Paged<TriggerRunAdminView>
  upcoming: string[]
}

export async function getTriggerDetail(triggerRef: string, runsPage: number): Promise<TriggerDetail | null> {
  const row = (await db.agentTrigger.findUnique({ where: { publicRef: triggerRef } })) as AgentTriggerRow | null
  if (!row) return null
  const [runs, total, connection] = await Promise.all([
    db.agentTriggerRun.findMany({ where: { triggerId: row.id }, orderBy: { receivedAt: "desc" }, skip: skipFor(runsPage), take: PAGE_SIZE }),
    db.agentTriggerRun.count({ where: { triggerId: row.id } }),
    db.agentConnection.findUnique({ where: { id: row.connectionId }, select: { name: true } }),
  ])
  const taskIds = runs.map((r) => r.taskId).filter((v): v is string => typeof v === "string")
  const tasks = taskIds.length ? await db.agentTask.findMany({ where: { id: { in: taskIds } }, select: { id: true, taskRef: true, status: true } }) : []
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const trigger = toTriggerView(row)
  return {
    trigger,
    connectionName: connection?.name ?? null,
    runs: {
      rows: runs.map((r) => {
        const task = r.taskId ? taskById.get(r.taskId) : undefined
        return { ...toTriggerRunView(r as AgentTriggerRunRow), taskRef: task?.taskRef ?? null, taskStatus: task?.status ?? null }
      }),
      meta: pageMeta(total, runsPage),
    },
    upcoming: upcomingOccurrences(trigger),
  }
}

export interface ScheduleRow {
  trigger: TriggerView
  upcoming: string[]
}

export async function listSchedules(filters: { status?: (typeof TRIGGER_STATUSES)[number]; page: number }): Promise<Paged<ScheduleRow>> {
  const result = await listTriggers({ type: "SCHEDULE", status: filters.status, page: filters.page })
  return { rows: result.rows.map((trigger) => ({ trigger, upcoming: upcomingOccurrences(trigger) })), meta: result.meta }
}

export interface WebhookRow {
  trigger: TriggerView
  runsLast24h: number
  lastRunAt: string | null
}

export async function listWebhooks(filters: { status?: (typeof TRIGGER_STATUSES)[number]; page: number }, now: Date = new Date()): Promise<Paged<WebhookRow>> {
  const where: Prisma.AgentTriggerWhereInput = { type: "WEBHOOK", ...(filters.status ? { status: filters.status } : {}) }
  const [rows, total] = await Promise.all([
    db.agentTrigger.findMany({ where, orderBy: { createdAt: "desc" }, skip: skipFor(filters.page), take: PAGE_SIZE }),
    db.agentTrigger.count({ where }),
  ])
  const ids = rows.map((r) => r.id)
  const recent = ids.length
    ? await db.agentTriggerRun.findMany({
        where: { triggerId: { in: ids }, receivedAt: { gte: new Date(now.getTime() - DAY) } },
        select: { triggerId: true, receivedAt: true },
        take: 10_000,
      })
    : []
  const stats = new Map<string, { count: number; last: number }>()
  for (const r of recent) {
    const s = stats.get(r.triggerId) ?? { count: 0, last: 0 }
    s.count += 1
    s.last = Math.max(s.last, new Date(r.receivedAt).getTime())
    stats.set(r.triggerId, s)
  }
  return {
    rows: rows.map((row) => {
      const s = stats.get(row.id)
      const trigger = toTriggerView(row as AgentTriggerRow)
      return { trigger, runsLast24h: s?.count ?? 0, lastRunAt: s?.last ? new Date(s.last).toISOString() : trigger.lastTriggeredAt }
    }),
    meta: pageMeta(total, filters.page),
  }
}

// ── Form options ─────────────────────────────────────────────────────────

export interface TriggerFormOptions {
  connections: Array<{ id: string; name: string; environment: string; ownerId: string }>
  capabilities: Array<{ id: string; version: number; riskTier: string; resourceType: string; resourceLocator: string | null }>
  eventTypes: Array<{ eventType: string; resourceType: string; aboutUser: boolean }>
}

export function triggerableCapabilities(): CapabilityDefinition[] {
  return getCapabilityRegistry()
    .list()
    .filter((d) => d.status === "ACTIVE" && d.exposure === "AGENT_AVAILABLE" && d.async.asyncSupported === true && !!d.executionReference)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function getTriggerFormOptions(): Promise<TriggerFormOptions> {
  const connections = await db.agentConnection.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, environment: true, ownerId: true },
  })
  return {
    connections,
    capabilities: triggerableCapabilities().map((d) => ({
      id: d.id,
      version: d.version,
      riskTier: d.operationType,
      resourceType: d.resource.resourceType,
      resourceLocator: d.resource.resourceLocator ?? null,
    })),
    eventTypes: Object.entries(TRIGGER_EVENT_CATALOG).map(([eventType, def]) => ({ eventType, resourceType: def.resourceType, aboutUser: !!def.subjectUserField })),
  }
}
