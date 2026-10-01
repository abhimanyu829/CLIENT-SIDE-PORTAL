import Link from "next/link"
import { notFound } from "next/navigation"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { getTriggerDetail, type TriggerDetail } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import { TriggerActions } from "@/components/admin/agent-governance/TriggerActions"
import { GovTable, KeyValues, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

export default async function GovernanceTriggerDetailPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const { ref } = await params
  const query = await searchParams
  if (!/^trg_[0-9a-f]{32}$/.test(ref)) notFound()
  const runsPage = parsePage(firstParam(query, "runsPage"))
  let detail: TriggerDetail | null = null
  let unavailable = false
  try {
    detail = await getTriggerDetail(ref, runsPage)
  } catch {
    unavailable = true
  }
  if (unavailable) return <Unavailable what="This trigger" />
  if (!detail) notFound()
  const t = detail.trigger

  return (
    <section aria-labelledby="trigger-heading" className="space-y-6">
      <SectionHeader id="trigger-heading" title={t.name} description={`${t.type.toLowerCase()} trigger ${t.triggerRef} · version ${t.version}`} />
      <KeyValues
        items={[
          { label: "Status", value: <StatusPill status={t.status} /> },
          { label: "Capability", value: <Mono>{`${t.capabilityId}@v${t.capabilityVersion}`}</Mono> },
          { label: "Connection", value: <Link className="underline" href={`/admin/agent-governance/connections/${t.connectionId}`}>{detail.connectionName ?? t.connectionId}</Link> },
          { label: "Owner", value: <Mono>{t.ownerId}</Mono> },
          { label: "Environment", value: t.environment },
          { label: "Concurrency", value: t.concurrency.replace(/_/g, " ").toLowerCase() },
          { label: "Binds resource", value: t.bindResource ? "yes" : "no" },
          { label: "Expires", value: <Time value={t.expiresAt} /> },
          { label: "Last fired", value: <Time value={t.lastTriggeredAt} /> },
          { label: "Last success", value: <Time value={t.lastSuccessAt} /> },
          { label: "Last failure", value: <Time value={t.lastFailureAt} /> },
          { label: "Failures", value: t.failureCount },
          ...(t.event
            ? [
                { label: "Event", value: t.event.eventType },
                { label: "Resource filter", value: t.event.resourceId ?? "any" },
                { label: "Caused by", value: t.event.actorScope === "OWNER" ? "the owner only" : "anyone" },
              ]
            : []),
          ...(t.schedule
            ? [
                { label: "Schedule", value: t.schedule.kind === "CRON" ? <Mono>{t.schedule.cron}</Mono> : <Time value={t.schedule.runAt} /> },
                { label: "Timezone", value: t.schedule.timezone },
                { label: "Missed runs", value: t.schedule.missedRunPolicy === "CATCH_UP_ONCE" ? "catch up once" : "skip" },
                { label: "Next run", value: <Time value={t.schedule.nextRunAt} /> },
              ]
            : []),
          ...(t.webhook
            ? [
                { label: "Endpoint", value: <Mono>{`POST ${t.webhook.path}`}</Mono> },
                { label: "Secret version", value: t.webhook.secretVersion ?? "—" },
              ]
            : []),
        ]}
      />
      {detail.upcoming.length ? (
        <div className="space-y-1">
          <h3 className="font-medium">Upcoming occurrences</h3>
          <ul className="list-inside list-disc text-sm">
            {detail.upcoming.map((o) => (
              <li key={o}>
                <Time value={o} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="font-medium">Capability input</h3>
        <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{JSON.stringify(t.input ?? {}, null, 2)}</pre>
      </div>
      <TriggerActions
        trigger={{
          triggerRef: t.triggerRef,
          name: t.name,
          type: t.type,
          status: t.status,
          version: t.version,
          concurrency: t.concurrency,
          input: t.input,
          expiresAt: t.expiresAt,
          schedule: t.schedule ? { kind: t.schedule.kind, cron: t.schedule.cron, timezone: t.schedule.timezone, runAt: t.schedule.runAt, missedRunPolicy: t.schedule.missedRunPolicy } : null,
          webhook: t.webhook,
        }}
      />
      <div className="space-y-2">
        <h3 className="font-medium">Runs</h3>
        <GovTable
          caption="Trigger runs (newest first)"
          rows={detail.runs.rows}
          rowKey={(r) => r.runRef}
          empty="No delivery yet."
          columns={[
            { header: "Run", cell: (r) => <Mono>{r.runRef}</Mono> },
            { header: "Source", cell: (r) => r.source },
            { header: "Outcome", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Reason", cell: (r) => r.errorCode ?? "—" },
            { header: "Task", cell: (r) => (r.taskRef ? <Link className="underline font-mono text-xs" href={`/admin/agent-governance/tasks/${r.taskRef}`}>{r.taskStatus ?? r.taskRef}</Link> : "—") },
            { header: "Scheduled for", cell: (r) => <Time value={r.scheduledFor} /> },
            { header: "Received", cell: (r) => <Time value={r.receivedAt} /> },
          ]}
        />
        <Pagination basePath={`/admin/agent-governance/triggers/${t.triggerRef}`} meta={detail.runs.meta} params={query} pageParam="runsPage" label="Run pages" />
      </div>
    </section>
  )
}
