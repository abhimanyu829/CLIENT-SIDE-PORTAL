import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { getRuntimeSnapshot, type RuntimeSnapshot } from "@/lib/agent-gateway/governance/health"
import { FeatureNotice, KeyValues, Mono, SectionHeader, StatCard, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const onOff = (v: boolean) => <StatusPill status={v ? "ACTIVE" : "DISABLED"} />
const minutes = (ms: number) => `${Math.round(ms / 60_000)} min`

export default async function GovernanceRuntimePage() {
  await requireGovernanceViewer()
  let snap: RuntimeSnapshot | null = null
  try {
    snap = await getRuntimeSnapshot()
  } catch {
    snap = null
  }
  if (!snap) return <Unavailable what="The runtime snapshot" />
  const queue = snap.queue

  return (
    <section aria-labelledby="runtime-heading" className="space-y-6">
      <SectionHeader id="runtime-heading" title="Runtime and health" description={`Environment ${snap.environment}. Generated ${snap.generatedAt.slice(0, 19).replace("T", " ")} UTC.`} />
      {snap.redisControls === "not-configured" ? (
        <FeatureNotice>The Redis controls (webhook nonces, rate limits) are not configured, so webhook deliveries are refused (fail closed).</FeatureNotice>
      ) : null}
      <div className="space-y-2">
        <h3 className="font-medium">Switches</h3>
        <KeyValues
          items={[
            { label: "Agent gateway", value: onOff(snap.flags.gateway) },
            { label: "MCP server", value: onOff(snap.flags.mcp) },
            { label: "Signed requests", value: onOff(snap.flags.signedRequests) },
            { label: "Asynchronous tasks", value: onOff(snap.flags.tasks) },
            { label: "Triggers", value: onOff(snap.flags.triggers) },
          ]}
        />
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">Dependencies</h3>
        <KeyValues
          items={[
            { label: "Database", value: snap.health ? <StatusPill status={snap.health.dependencies.backend === "ok" ? "ACTIVE" : "FAILED"} /> : "unknown" },
            { label: "Redis (gateway)", value: snap.health ? snap.health.dependencies.redis : "unknown" },
            { label: "Redis controls", value: snap.redisControls === "configured" ? "configured" : "not configured" },
            {
              label: "Task queue",
              value: queue.state === "ok" ? "reachable" : queue.state === "not-configured" ? "not configured (tasks cannot be queued)" : "unreachable",
            },
          ]}
        />
      </div>
      {queue.counts ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Waiting jobs" value={queue.counts.waiting} />
          <StatCard label="Active jobs" value={queue.counts.active} />
          <StatCard label="Delayed jobs" value={queue.counts.delayed} hint="retries with backoff" />
          <StatCard label="Failed jobs" value={queue.counts.failed} />
          <StatCard label="Completed jobs" value={queue.counts.completed} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Stuck starting" value={snap.tasks.stuckStarting} hint="recovered by maintenance" />
        <StatCard label="Stuck running" value={snap.tasks.stuckRunning} hint="past the execution timeout" />
        <StatCard label="Overdue in queue" value={snap.tasks.overdueQueued} hint="past the queue timeout" />
        <StatCard label="Overdue schedules" value={snap.schedules.overdue} hint={snap.schedules.oldestOverdueAt ? `oldest ${snap.schedules.oldestOverdueAt.slice(0, 16).replace("T", " ")} UTC` : "scheduler on time"} />
        <StatCard label="Pending approvals" value={snap.approvals.pending} href="/admin/agent-governance/approvals?status=PENDING" />
        <StatCard label="Failing triggers" value={snap.triggers.failing} href="/admin/agent-governance/triggers" />
        <StatCard label="Failed runs (24 h)" value={snap.triggers.failedRunsLast24h} />
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">Circuit breakers</h3>
        <p className="text-sm text-muted-foreground">
          Per capability, adapter and connection; process-local, so this shows the server process that rendered this page. Only infrastructure failures count.
        </p>
        {snap.breakers.length === 0 ? (
          <p className="text-sm">All breakers are closed.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {snap.breakers.map((b) => (
              <li key={`${b.scope}:${b.key}`} className="flex flex-wrap items-center gap-2">
                <StatusPill status={b.state === "CLOSED" ? "ACTIVE" : b.state === "OPEN" ? "FAILED" : "PENDING"} />
                <span>{b.scope.toLowerCase()}</span>
                <Mono>{b.key}</Mono>
                <span className="text-muted-foreground">
                  {b.state.replace("_", " ").toLowerCase()} · {b.recentFailures} recent failures
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {snap.tasks.stuckRefs.length ? (
        <div className="space-y-1">
          <h3 className="font-medium">Tasks needing attention</h3>
          <ul className="list-inside list-disc text-sm">
            {snap.tasks.stuckRefs.map((ref) => (
              <li key={ref}>
                <Link className="underline font-mono text-xs" href={`/admin/agent-governance/tasks/${ref}`}>
                  {ref}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="font-medium">Limits</h3>
        <KeyValues
          items={[
            { label: "Queue timeout", value: minutes(snap.limits.taskQueueTimeoutMs) },
            { label: "Execution timeout", value: `${Math.round(snap.limits.taskExecutionTimeoutMs / 1000)} s` },
            { label: "Task deadline", value: minutes(snap.limits.taskDeadlineMs) },
            { label: "Schedule minimum interval", value: minutes(snap.limits.triggerMinIntervalMs) },
            { label: "Late tolerance", value: minutes(snap.limits.triggerLateToleranceMs) },
            { label: "Webhook body limit", value: <Mono>{`${snap.limits.webhookMaxBodyBytes} bytes`}</Mono> },
            { label: "Oldest pending approval", value: <Time value={snap.approvals.oldestPendingAt} /> },
          ]}
        />
      </div>
    </section>
  )
}
