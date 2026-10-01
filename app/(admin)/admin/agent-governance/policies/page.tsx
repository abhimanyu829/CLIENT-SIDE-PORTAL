import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { allCapabilityIds, listPolicies } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import type { PolicyAdminView } from "@/lib/agent-gateway/governance/views"
import { PolicyForm } from "@/components/admin/agent-governance/PolicyForm"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/policies"

export default async function GovernancePoliciesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const enabledParam = firstParam(params, "enabled")
  const enabled = enabledParam === "yes" ? true : enabledParam === "no" ? false : undefined
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<PolicyAdminView> | null = null
  try {
    data = await listPolicies({ enabled, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="policies-heading" className="space-y-4">
      <SectionHeader
        id="policies-heading"
        title="Authorization policies"
        description="Phase 6 policies. Without a matching allow, every agent operation is denied; an explicit deny always wins. Versions are immutable."
      />
      <FilterBar
        action={BASE}
        fields={[{ name: "enabled", label: "Kill switch", value: enabledParam === "yes" || enabledParam === "no" ? enabledParam : undefined, options: [{ value: "yes", label: "Enabled" }, { value: "no", label: "Disabled" }] }]}
      />
      {data === null ? (
        <Unavailable what="Authorization policies" />
      ) : (
        <>
          <GovTable
            caption="Authorization policies"
            rows={data.rows}
            rowKey={(r) => r.id}
            empty="No policy yet: every agent operation is denied by default."
            columns={[
              { header: "Policy", cell: (r) => <Link className="underline" href={`${BASE}/${r.id}`}>{r.name}</Link> },
              { header: "State", cell: (r) => <StatusPill status={r.enabled ? "ACTIVE" : "DISABLED"} /> },
              { header: "Version", cell: (r) => r.latestVersion || "—" },
              { header: "Effect", cell: (r) => (r.current ? <StatusPill status={r.current.effect} /> : "—") },
              { header: "Scope", cell: (r) => (r.current ? `${r.current.scope}${r.current.scopeValue ? `: ${r.current.scopeValue}` : ""}` : "—") },
              { header: "Capability", cell: (r) => <Mono>{r.current?.capabilityId ?? "any"}</Mono> },
              { header: "Priority", cell: (r) => r.priority },
              { header: "Updated", cell: (r) => <Time value={r.updatedAt} /> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
      <PolicyForm mode="create" capabilityIds={allCapabilityIds()} />
    </section>
  )
}
