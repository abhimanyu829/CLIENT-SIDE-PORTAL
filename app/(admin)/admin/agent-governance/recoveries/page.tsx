import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { listRecoveryViews } from "@/lib/agent-gateway/governance/evidence"
import { firstParam, parsePage, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import type { RecoveryView } from "@/lib/agent-gateway/recovery"
import { iso } from "@/lib/agent-gateway/governance/views"
import { GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/recoveries"

export default async function GovernanceRecoveriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<RecoveryView> | null = null
  try {
    data = await listRecoveryViews(page)
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="recoveries-heading" className="space-y-4">
      <SectionHeader
        id="recoveries-heading"
        title="Recoveries"
        description="Capability-aware rollback of recorded agent executions. A recovery runs only the capability's declared reverse or compensation, as the original connection, through the same authorization, autonomy and approval checks; irreversible operations are recorded for manual recovery, never faked. Request one from a successful write in the audit ledger."
      />
      {data === null ? (
        <Unavailable what="Recoveries" />
      ) : (
        <>
          <GovTable
            caption="Recovery requests, newest first"
            rows={data.rows}
            rowKey={(r) => r.recoveryRef}
            empty="No recovery has been requested."
            columns={[
              { header: "Recovery", cell: (r) => <Mono>{r.recoveryRef}</Mono> },
              { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
              { header: "Class", cell: (r) => r.recoveryClass.replace(/_/g, " ").toLowerCase() },
              {
                header: "Execution",
                cell: (r) => (
                  <Link className="underline font-mono text-xs" href={`/admin/agent-governance/ledger?capabilityId=${encodeURIComponent(r.capabilityId)}`}>
                    {`${r.capabilityId}@v${r.capabilityVersion}`}
                  </Link>
                ),
              },
              { header: "Recovered by", cell: (r) => (r.recoveryCapabilityId ? <Mono>{r.recoveryCapabilityId}</Mono> : "manual") },
              { header: "Connection", cell: (r) => <Mono>{r.connectionId}</Mono> },
              { header: "Attempts", cell: (r) => r.attempts },
              {
                header: "Outcome",
                cell: (r) => (
                  <span className="text-xs">
                    {r.errorCode ? <Mono>{r.errorCode}</Mono> : null}
                    {r.approvalRef ? (
                      <>
                        {" "}
                        <Link className="underline" href={`/admin/agent-approvals/${r.approvalRef}`}>
                          approval
                        </Link>
                      </>
                    ) : null}
                    {r.status === "MANUAL_RECOVERY_REQUIRED" || r.residualEffects ? <span className="block text-muted-foreground">{r.residualEffects ?? r.recommendation}</span> : null}
                  </span>
                ),
              },
              { header: "Requested", cell: (r) => <Time value={iso(r.requestedAt)} /> },
              { header: "Completed", cell: (r) => <Time value={iso(r.completedAt)} /> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
    </section>
  )
}
