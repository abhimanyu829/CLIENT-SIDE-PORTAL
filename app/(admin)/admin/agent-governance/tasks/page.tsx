import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { TASK_ORIGINS, listTasks } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, pickId, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import type { TaskAdminView } from "@/lib/agent-gateway/governance/views"
import { AGENT_TASK_STATUSES } from "@/lib/agent-gateway/tasks/types"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/tasks"

export default async function GovernanceTasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const status = pickEnum(firstParam(params, "status"), AGENT_TASK_STATUSES)
  const origin = pickEnum(firstParam(params, "origin"), TASK_ORIGINS)
  const capabilityId = pickId(firstParam(params, "capabilityId"), /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/)
  const connectionId = pickId(firstParam(params, "connectionId"), /^[A-Za-z0-9_-]{1,64}$/)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<TaskAdminView> | null = null
  try {
    data = await listTasks({ status, origin, capabilityId, connectionId, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      <SectionHeader
        id="tasks-heading"
        title="Tasks"
        description="Asynchronous agent tasks (Phase 8), from agents or triggers. Inputs and results are never shown here; only their state."
      />
      <FilterBar
        action={BASE}
        fields={[
          { name: "status", label: "Status", value: status, options: enumOptions(AGENT_TASK_STATUSES) },
          { name: "origin", label: "Origin", value: origin, options: enumOptions(TASK_ORIGINS) },
        ]}
      />
      {capabilityId || connectionId ? (
        <p className="text-sm text-muted-foreground">
          Filtered by {capabilityId ? <Mono>{capabilityId}</Mono> : null} {connectionId ? <Mono>{connectionId}</Mono> : null}.{" "}
          <Link className="underline" href={BASE}>
            Clear
          </Link>
        </p>
      ) : null}
      {data === null ? (
        <Unavailable what="Agent tasks" />
      ) : (
        <>
          <GovTable
            caption="Agent tasks"
            rows={data.rows}
            rowKey={(r) => r.taskRef}
            empty="No task matches these filters."
            columns={[
              { header: "Task", cell: (r) => <Link className="underline font-mono text-xs" href={`${BASE}/${r.taskRef}`}>{r.taskRef}</Link> },
              { header: "Capability", cell: (r) => <Link className="underline font-mono text-xs" href={`${BASE}?capabilityId=${encodeURIComponent(r.capabilityId)}`}>{`${r.capabilityId}@v${r.capabilityVersion}`}</Link> },
              { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
              { header: "Attempts", cell: (r) => `${r.attempts}/${r.maxAttempts}` },
              { header: "Origin", cell: (r) => r.origin },
              { header: "Connection", cell: (r) => <Link className="underline font-mono text-xs" href={`${BASE}?connectionId=${encodeURIComponent(r.connectionId)}`}>{r.connectionId}</Link> },
              { header: "Error", cell: (r) => r.errorCode ?? "—" },
              { header: "Created", cell: (r) => <Time value={r.createdAt} /> },
              { header: "Finished", cell: (r) => <Time value={r.finishedAt} /> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
    </section>
  )
}
