import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { listSchedules, type ScheduleRow } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import { TRIGGER_STATUSES } from "@/lib/agent-gateway/triggers/types"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/schedules"

export default async function GovernanceSchedulesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const status = pickEnum(firstParam(params, "status"), TRIGGER_STATUSES)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<ScheduleRow> | null = null
  try {
    data = await listSchedules({ status, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="schedules-heading" className="space-y-4">
      <SectionHeader
        id="schedules-heading"
        title="Schedules"
        description="Schedule triggers, evaluated in their own timezone by one scheduler tick. Missed runs are skipped or caught up once — never replayed."
      >
        <Link className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href="/admin/agent-governance/triggers?type=SCHEDULE">
          Create or manage
        </Link>
      </SectionHeader>
      <FilterBar action={BASE} fields={[{ name: "status", label: "Status", value: status, options: enumOptions(TRIGGER_STATUSES) }]} />
      {data === null ? (
        <Unavailable what="Schedules" />
      ) : (
        <>
          <GovTable
            caption="Schedule triggers"
            rows={data.rows}
            rowKey={(r) => r.trigger.triggerRef}
            empty="No schedule matches these filters."
            columns={[
              { header: "Schedule", cell: (r) => <Link className="underline" href={`/admin/agent-governance/triggers/${r.trigger.triggerRef}`}>{r.trigger.name}</Link> },
              { header: "Status", cell: (r) => <StatusPill status={r.trigger.status} /> },
              { header: "When", cell: (r) => (r.trigger.schedule?.kind === "ONCE" ? <Time value={r.trigger.schedule.runAt} /> : <Mono>{r.trigger.schedule?.cron ?? "—"}</Mono>) },
              { header: "Timezone", cell: (r) => r.trigger.schedule?.timezone ?? "UTC" },
              { header: "Missed runs", cell: (r) => (r.trigger.schedule?.missedRunPolicy === "CATCH_UP_ONCE" ? "catch up once" : "skip") },
              { header: "Next runs", cell: (r) => (r.upcoming.length ? r.upcoming.map((o) => <div key={o}><Time value={o} /></div>) : "—") },
              { header: "Last scheduled", cell: (r) => <Time value={r.trigger.schedule?.lastScheduledFor ?? null} /> },
              { header: "Capability", cell: (r) => <Mono>{r.trigger.capabilityId}</Mono> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
    </section>
  )
}
