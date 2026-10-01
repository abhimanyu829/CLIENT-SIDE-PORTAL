import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { APPROVAL_STATUSES, listApprovals } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, pickId, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import type { ApprovalListAdminView } from "@/lib/agent-gateway/governance/views"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/approvals"

/**
 * Phase 7 approval requests. Read-only here: deciding an approval always
 * goes through the existing approval page (binding confirmation + SMS
 * step-up). Governance has no shortcut that approves anything.
 */
export default async function GovernanceApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const status = pickEnum(firstParam(params, "status"), APPROVAL_STATUSES)
  const connectionId = pickId(firstParam(params, "connectionId"), /^[A-Za-z0-9_-]{1,64}$/)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<ApprovalListAdminView> | null = null
  try {
    data = await listApprovals({ status, connectionId, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="approvals-heading" className="space-y-4">
      <SectionHeader
        id="approvals-heading"
        title="Approvals"
        description="Operations agents asked to run that need a human decision. Open a request to review its exact binding and decide with an SMS code."
      />
      <FilterBar action={BASE} fields={[{ name: "status", label: "Status", value: status, options: enumOptions(APPROVAL_STATUSES) }]} />
      {connectionId ? (
        <p className="text-sm text-muted-foreground">
          Showing connection <Mono>{connectionId}</Mono> only. <Link className="underline" href={BASE}>Show all</Link>
        </p>
      ) : null}
      {data === null ? (
        <Unavailable what="Approval requests" />
      ) : (
        <>
          <GovTable
            caption="Agent approval requests"
            rows={data.rows}
            rowKey={(r) => r.publicRef}
            empty="No approval request matches these filters."
            columns={[
              { header: "Reference", cell: (r) => <Link className="underline font-mono text-xs" href={`/admin/agent-approvals/${r.publicRef}`}>{r.publicRef}</Link> },
              { header: "Status", cell: (r) => <StatusPill status={r.effectiveStatus} /> },
              { header: "Capability", cell: (r) => <Mono>{`${r.capabilityId}@v${r.capabilityVersion}`}</Mono> },
              { header: "Risk", cell: (r) => r.riskTier.replace(/_/g, " ") },
              { header: "Connection", cell: (r) => <Link className="underline font-mono text-xs" href={`/admin/agent-governance/connections/${r.connectionId}`}>{r.connectionId}</Link> },
              { header: "Environment", cell: (r) => r.environment },
              { header: "Resource", cell: (r) => (r.resourceType ? `${r.resourceType}:${r.resourceId ?? "-"}` : "—") },
              { header: "Requested", cell: (r) => <Time value={r.createdAt} /> },
              { header: "Expires", cell: (r) => <Time value={r.expiresAt} /> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
    </section>
  )
}
