import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { EXPOSURES, RISK_TIERS, listCapabilities } from "@/lib/agent-gateway/governance/queries"
import { firstParam, pickEnum, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import type { CapabilityAdminView } from "@/lib/agent-gateway/governance/views"
import { FilterBar, GovTable, Mono, SectionHeader, StatusPill, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/capabilities"

/**
 * The capability catalog is code (the reviewed Phase 3 manifest) — the single
 * source of truth. It is read-only here: what an agent may do with a
 * capability is governed through policies (Phase 6) and autonomy (Phase 7).
 */
export default async function GovernanceCapabilitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const exposure = pickEnum(firstParam(params, "exposure"), EXPOSURES)
  const riskTier = pickEnum(firstParam(params, "riskTier"), RISK_TIERS)
  const asyncOnly = firstParam(params, "async") === "yes"
  let rows: CapabilityAdminView[] | null = null
  try {
    rows = await listCapabilities({ exposure, riskTier, asyncOnly })
  } catch {
    rows = null
  }

  return (
    <section aria-labelledby="capabilities-heading" className="space-y-4">
      <SectionHeader
        id="capabilities-heading"
        title="Capabilities"
        description="The reviewed capability manifest (read-only). Govern access with policies and autonomy; mandatory approvals cannot be removed."
      />
      <FilterBar
        action={BASE}
        fields={[
          { name: "exposure", label: "Exposure", value: exposure, options: enumOptions(EXPOSURES) },
          { name: "riskTier", label: "Risk tier", value: riskTier, options: enumOptions(RISK_TIERS) },
          { name: "async", label: "Asynchronous", value: asyncOnly ? "yes" : undefined, options: [{ value: "yes", label: "Async-capable only" }] },
        ]}
      />
      {rows === null ? (
        <Unavailable what="The capability catalog" />
      ) : (
        <>
          <GovTable
            caption="Registered capabilities"
            rows={rows}
            rowKey={(r) => `${r.id}@v${r.version}`}
            empty="No capability matches these filters."
            columns={[
              { header: "Capability", cell: (r) => <Mono>{`${r.id}@v${r.version}`}</Mono> },
              { header: "Name", cell: (r) => r.name },
              { header: "Risk", cell: (r) => r.riskTier.replace(/_/g, " ") },
              { header: "Exposure", cell: (r) => <StatusPill status={r.exposure} /> },
              { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
              { header: "Async", cell: (r) => (r.asyncSupported ? `yes (${r.retryClass.replace(/_/g, " ").toLowerCase()})` : "no") },
              { header: "Mandatory approval", cell: (r) => (r.mandatoryApproval ? r.mandatoryApproval.replace(/_/g, " ").toLowerCase() : "—") },
              { header: "Reversibility", cell: (r) => r.reversibility.toLowerCase() },
              { header: "Active policies", cell: (r) => r.references.policies },
              { header: "Live triggers", cell: (r) => r.references.triggers },
            ]}
          />
          <p className="text-sm text-muted-foreground">{rows.length} capabilities</p>
        </>
      )}
    </section>
  )
}
