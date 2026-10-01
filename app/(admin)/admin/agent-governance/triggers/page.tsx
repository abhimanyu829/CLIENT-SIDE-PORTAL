import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { TRIGGER_TYPES, getTriggerFormOptions, listTriggers, type TriggerFormOptions } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, pickId, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import { TRIGGER_STATUSES, type TriggerView } from "@/lib/agent-gateway/triggers/types"
import { getTriggerConfig } from "@/lib/agent-gateway/triggers/config"
import { CreateTriggerForm } from "@/components/admin/agent-governance/CreateTriggerForm"
import { FeatureNotice, FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/triggers"

export default async function GovernanceTriggersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const type = pickEnum(firstParam(params, "type"), TRIGGER_TYPES)
  const status = pickEnum(firstParam(params, "status"), TRIGGER_STATUSES)
  const connectionId = pickId(firstParam(params, "connectionId"), /^[A-Za-z0-9_-]{1,64}$/)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<TriggerView> | null = null
  let options: TriggerFormOptions | null = null
  try {
    ;[data, options] = await Promise.all([listTriggers({ type, status, connectionId, page }), getTriggerFormOptions()])
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="triggers-heading" className="space-y-4">
      <SectionHeader
        id="triggers-heading"
        title="Triggers"
        description="Event, webhook and schedule triggers (Phase 9). A trigger grants nothing: each firing creates a task only if the live policies allow it."
      />
      {!getTriggerConfig().enabled ? <FeatureNotice>Triggers are switched off: they can be prepared here but will not fire.</FeatureNotice> : null}
      <FilterBar
        action={BASE}
        fields={[
          { name: "type", label: "Type", value: type, options: enumOptions(TRIGGER_TYPES) },
          { name: "status", label: "Status", value: status, options: enumOptions(TRIGGER_STATUSES) },
        ]}
      />
      {data === null ? (
        <Unavailable what="Triggers" />
      ) : (
        <>
          <GovTable
            caption="Agent triggers"
            rows={data.rows}
            rowKey={(r) => r.triggerRef}
            empty="No trigger matches these filters."
            columns={[
              { header: "Trigger", cell: (r) => <Link className="underline" href={`${BASE}/${r.triggerRef}`}>{r.name}</Link> },
              { header: "Type", cell: (r) => r.type },
              { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
              { header: "Capability", cell: (r) => <Mono>{`${r.capabilityId}@v${r.capabilityVersion}`}</Mono> },
              { header: "Connection", cell: (r) => <Link className="underline font-mono text-xs" href={`/admin/agent-governance/connections/${r.connectionId}`}>{r.connectionId}</Link> },
              { header: "Concurrency", cell: (r) => r.concurrency.replace(/_/g, " ").toLowerCase() },
              { header: "Last fired", cell: (r) => <Time value={r.lastTriggeredAt} /> },
              { header: "Failures", cell: (r) => r.failureCount },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
      {options ? <CreateTriggerForm connections={options.connections} capabilities={options.capabilities} eventTypes={options.eventTypes} /> : null}
    </section>
  )
}
