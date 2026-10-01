import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { getOverview, type GovernanceOverview } from "@/lib/agent-gateway/governance/queries"
import { getGatewayConfig } from "@/lib/agent-gateway/config"
import { getTaskEngineConfig } from "@/lib/agent-gateway/tasks/config"
import { getTriggerConfig } from "@/lib/agent-gateway/triggers/config"
import { FeatureNotice, GovTable, SectionHeader, StatCard, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

export default async function AgentGovernanceOverviewPage() {
  await requireGovernanceViewer()
  let data: GovernanceOverview | null = null
  try {
    data = await getOverview()
  } catch {
    data = null
  }
  const gateway = getGatewayConfig()
  const tasksEnabled = getTaskEngineConfig().enabled
  const triggersEnabled = getTriggerConfig().enabled

  return (
    <section aria-labelledby="overview-heading" className="space-y-6">
      <SectionHeader id="overview-heading" title="Overview" description="Current state of agent access and automation across the platform." />
      {!gateway.AGENT_GATEWAY_ENABLED || !tasksEnabled || !triggersEnabled ? (
        <FeatureNotice>
          {!gateway.AGENT_GATEWAY_ENABLED ? "The agent gateway is switched off (AGENT_GATEWAY_ENABLED). " : ""}
          {!tasksEnabled ? "Asynchronous tasks are off (AGENT_GATEWAY_TASKS_ENABLED). " : ""}
          {!triggersEnabled ? "Triggers are off and will not fire (AGENT_GATEWAY_TRIGGERS_ENABLED and AGENT_GATEWAY_TASKS_ENABLED). " : ""}
          Configuration can still be reviewed and prepared here.
        </FeatureNotice>
      ) : null}
      {data === null ? (
        <Unavailable what="The governance overview" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Active connections" value={data.connections.ACTIVE} href="/admin/agent-governance/connections?status=ACTIVE" hint={`${data.connections.SUSPENDED} suspended · ${data.connections.REVOKED} revoked`} />
            <StatCard label="Pending approvals" value={data.pendingApprovals} href="/admin/agent-governance/approvals?status=PENDING" hint={data.oldestPendingApprovalAt ? `oldest ${data.oldestPendingApprovalAt.slice(0, 16).replace("T", " ")} UTC` : "none waiting"} />
            <StatCard label="Tasks in flight" value={data.tasks.QUEUED + data.tasks.STARTING + data.tasks.RUNNING + data.tasks.RETRY_QUEUED + data.tasks.CANCELLING} href="/admin/agent-governance/tasks" hint={`${data.tasksLast24h} created in the last 24 h`} />
            <StatCard label="Active triggers" value={data.triggers.ACTIVE} href="/admin/agent-governance/triggers?status=ACTIVE" hint={`${data.triggersByType.EVENT} event · ${data.triggersByType.WEBHOOK} webhook · ${data.triggersByType.SCHEDULE} schedule`} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "TIMED_OUT"] as const).map((s) => (
              <StatCard key={s} label={`Tasks ${s.replace(/_/g, " ").toLowerCase()}`} value={data!.tasks[s]} href={`/admin/agent-governance/tasks?status=${s}`} />
            ))}
          </div>
          <div className="space-y-2">
            <SectionHeader level={3} title="Triggers with recent failures" description="Live triggers whose firings failed (denials, unavailable dependencies, invalid configuration)." />
            <GovTable
              caption="Triggers with recent failures"
              rows={data.failingTriggers}
              rowKey={(r) => r.triggerRef}
              empty="No live trigger has failed."
              columns={[
                { header: "Trigger", cell: (r) => <Link className="underline" href={`/admin/agent-governance/triggers/${r.triggerRef}`}>{r.name}</Link> },
                { header: "Type", cell: (r) => <StatusPill status={r.type} /> },
                { header: "Failures", cell: (r) => r.failureCount },
                { header: "Last failure", cell: (r) => <Time value={r.lastFailureAt} /> },
              ]}
            />
          </div>
        </>
      )}
    </section>
  )
}
