import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { AUTH_METHODS, CONNECTION_ENVIRONMENTS, CONNECTION_STATUSES, listConnections } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import type { ConnectionAdminView } from "@/lib/agent-gateway/governance/views"
import { CreateConnectionForm } from "@/components/admin/agent-governance/CreateConnectionForm"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/connections"

export default async function GovernanceConnectionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const status = pickEnum(firstParam(params, "status"), CONNECTION_STATUSES)
  const environment = pickEnum(firstParam(params, "environment"), CONNECTION_ENVIRONMENTS)
  const authMethod = pickEnum(firstParam(params, "authMethod"), AUTH_METHODS)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<ConnectionAdminView> | null = null
  try {
    data = await listConnections({ status, environment, authMethod, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="connections-heading" className="space-y-4">
      <SectionHeader id="connections-heading" title="Connections" description="Machine identities of AI agents (Phase 2). Credentials are shown once at creation or rotation and never again." />
      <FilterBar
        action={BASE}
        fields={[
          { name: "status", label: "Status", value: status, options: enumOptions(CONNECTION_STATUSES) },
          { name: "environment", label: "Environment", value: environment, options: enumOptions(CONNECTION_ENVIRONMENTS) },
          { name: "authMethod", label: "Authentication", value: authMethod, options: enumOptions(AUTH_METHODS) },
        ]}
      />
      {data === null ? (
        <Unavailable what="Agent connections" />
      ) : (
        <>
          <GovTable
            caption="Agent connections"
            rows={data.rows}
            rowKey={(r) => r.id}
            empty="No connection matches these filters."
            columns={[
              { header: "Connection", cell: (r) => <Link className="underline" href={`${BASE}/${r.id}`}>{r.name}</Link> },
              { header: "Id", cell: (r) => <Mono>{r.id}</Mono> },
              { header: "Provider", cell: (r) => r.provider },
              { header: "Owner", cell: (r) => <Mono>{r.ownerId}</Mono> },
              { header: "Environment", cell: (r) => r.environment },
              { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
              { header: "Auth", cell: (r) => r.authMethod },
              { header: "Last seen", cell: (r) => <Time value={r.lastSeenAt} /> },
              { header: "Expires", cell: (r) => <Time value={r.expiresAt} /> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
      <CreateConnectionForm />
    </section>
  )
}
