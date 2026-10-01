import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { listAutonomy, type AutonomyListRow } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import { AUTONOMY_LEVELS } from "@/lib/agent-gateway/autonomy/types"
import { FilterBar, GovTable, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/autonomy"

export default async function GovernanceAutonomyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const level = pickEnum(firstParam(params, "level"), AUTONOMY_LEVELS)
  const page = parsePage(firstParam(params, "page"))
  let data: (Paged<AutonomyListRow> & { defaultPostureConnections: number }) | null = null
  try {
    data = await listAutonomy({ level, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="autonomy-heading" className="space-y-4">
      <SectionHeader
        id="autonomy-heading"
        title="Autonomy"
        description="Per-connection autonomy (Phase 7). It only narrows what policies allow; edit it on the connection page. Changes apply from the next agent request."
      />
      <FilterBar action={BASE} fields={[{ name: "level", label: "Level", value: level, options: enumOptions(AUTONOMY_LEVELS) }]} />
      {data === null ? (
        <Unavailable what="Autonomy policies" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {data.defaultPostureConnections} live connection(s) have no autonomy policy and use the default observe-only posture.
          </p>
          <GovTable
            caption="Active autonomy policies"
            rows={data.rows}
            rowKey={(r) => `${r.connectionId}:${r.version}`}
            empty="No connection has an autonomy policy."
            columns={[
              { header: "Connection", cell: (r) => <Link className="underline" href={`/admin/agent-governance/connections/${r.connectionId}`}>{r.connectionName}</Link> },
              { header: "Connection status", cell: (r) => <StatusPill status={r.connectionStatus} /> },
              { header: "Level", cell: (r) => r.autonomyLevel.replace(/_/g, " ") },
              { header: "Max risk", cell: (r) => r.maxRiskTier.replace(/_/g, " ") },
              { header: "Allowlist", cell: (r) => (r.allowedCapabilityIds.length ? `${r.allowedCapabilityIds.length} capabilities` : "any") },
              { header: "Approval always", cell: (r) => r.approvalRequiredFor.length },
              { header: "Environments", cell: (r) => (r.environmentScope.length ? r.environmentScope.join(", ") : "all") },
              { header: "Version", cell: (r) => r.version },
              { header: "Expires", cell: (r) => <Time value={r.expiresAt} /> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
    </section>
  )
}
