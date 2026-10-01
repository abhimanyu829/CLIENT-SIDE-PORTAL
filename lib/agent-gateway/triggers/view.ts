/**
 * lib/agent-gateway/triggers/view.ts — admin-facing projections. Never the
 * webhook secret or its ciphertext; never internal ids of tasks.
 */
import type { AgentTriggerRow, AgentTriggerRunRow, TriggerRunView, TriggerView } from "./types"

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null)

export function toTriggerView(row: AgentTriggerRow): TriggerView {
  return {
    triggerRef: row.publicRef,
    name: row.name,
    type: row.type,
    status: row.status,
    version: row.version,
    connectionId: row.connectionId,
    ownerId: row.ownerId,
    teamId: row.teamId ?? null,
    environment: row.environment,
    capabilityId: row.capabilityId,
    capabilityVersion: row.capabilityVersion,
    input: row.input,
    bindResource: row.bindResource,
    concurrency: row.concurrency,
    event: row.type === "EVENT" ? { eventType: row.eventType ?? "", resourceId: row.eventResourceId ?? null, actorScope: row.eventActorScope ?? "OWNER" } : null,
    webhook: row.type === "WEBHOOK" ? { path: `/api/agent-webhooks/${row.publicRef}`, secretVersion: row.webhookSecretVersion ?? null } : null,
    schedule:
      row.type === "SCHEDULE"
        ? {
            kind: row.scheduleKind ?? "CRON",
            cron: row.cronExpression ?? null,
            timezone: row.timezone ?? "UTC",
            runAt: iso(row.runAt),
            missedRunPolicy: row.missedRunPolicy ?? "SKIP",
            nextRunAt: iso(row.nextRunAt),
            lastScheduledFor: iso(row.lastScheduledFor),
          }
        : null,
    expiresAt: iso(row.expiresAt),
    lastTriggeredAt: iso(row.lastTriggeredAt),
    lastSuccessAt: iso(row.lastSuccessAt),
    lastFailureAt: iso(row.lastFailureAt),
    failureCount: row.failureCount,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt ?? row.createdAt).toISOString(),
  }
}

export function toTriggerRunView(row: AgentTriggerRunRow): TriggerRunView {
  return {
    runRef: row.publicRef,
    source: row.source,
    status: row.status,
    errorCode: row.errorCode ?? null,
    hasTask: !!row.taskId,
    scheduledFor: iso(row.scheduledFor),
    receivedAt: new Date(row.receivedAt).toISOString(),
    completedAt: iso(row.completedAt),
  }
}
