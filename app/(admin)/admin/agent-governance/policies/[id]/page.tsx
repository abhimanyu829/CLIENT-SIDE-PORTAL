import { notFound } from "next/navigation"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { allCapabilityIds, getPolicyDetail, type PolicyDetail } from "@/lib/agent-gateway/governance/queries"
import { PolicyActions } from "@/components/admin/agent-governance/PolicyActions"
import { PolicyForm } from "@/components/admin/agent-governance/PolicyForm"
import { GovTable, KeyValues, Mono, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

export default async function GovernancePolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGovernanceViewer()
  const { id } = await params
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound()
  let detail: PolicyDetail | null = null
  let unavailable = false
  try {
    detail = await getPolicyDetail(id)
  } catch {
    unavailable = true
  }
  if (unavailable) return <Unavailable what="This policy" />
  if (!detail) notFound()
  const { policy, versions } = detail
  const cur = policy.current

  return (
    <section aria-labelledby="policy-heading" className="space-y-6">
      <SectionHeader id="policy-heading" title={policy.name} description={policy.description ?? "Phase 6 authorization policy"}>
        <PolicyActions policyId={policy.id} enabled={policy.enabled} latestVersion={policy.latestVersion} versions={versions.map((v) => v.version)} />
      </SectionHeader>
      <KeyValues
        items={[
          { label: "Kill switch", value: <StatusPill status={policy.enabled ? "ACTIVE" : "DISABLED"} /> },
          { label: "Current version", value: cur ? cur.version : "—" },
          { label: "Effect", value: cur ? <StatusPill status={cur.effect} /> : "—" },
          { label: "Scope", value: cur ? `${cur.scope}${cur.scopeValue ? `: ${cur.scopeValue}` : ""}` : "—" },
          { label: "Capability", value: <Mono>{cur?.capabilityId ?? "any"}</Mono> },
          { label: "Risk ceiling", value: cur?.riskConstraint ?? "none" },
          { label: "Requires approval", value: cur?.approvalRequirement ? "yes" : "no" },
          { label: "Priority", value: policy.priority },
          { label: "Updated", value: <Time value={policy.updatedAt} /> },
        ]}
      />
      {cur?.conditions ? (
        <div className="space-y-1">
          <h3 className="font-medium">Conditions</h3>
          <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{JSON.stringify(cur.conditions, null, 2)}</pre>
        </div>
      ) : null}
      <PolicyForm mode="version" policyId={policy.id} latestVersion={policy.latestVersion} capabilityIds={allCapabilityIds()} defaults={cur} />
      <div className="space-y-2">
        <h3 className="font-medium">Version history</h3>
        <GovTable
          caption="Policy versions (newest first)"
          rows={versions}
          rowKey={(r) => r.id}
          empty="No version."
          columns={[
            { header: "Version", cell: (r) => r.version },
            { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Effect", cell: (r) => r.effect },
            { header: "Scope", cell: (r) => `${r.scope}${r.scopeValue ? `: ${r.scopeValue}` : ""}` },
            { header: "Capability", cell: (r) => <Mono>{r.capabilityId ?? "any"}</Mono> },
            { header: "Note", cell: (r) => r.note ?? "—" },
            { header: "Created", cell: (r) => <Time value={r.createdAt} /> },
            { header: "By", cell: (r) => <Mono>{r.createdById}</Mono> },
          ]}
        />
      </div>
    </section>
  )
}
