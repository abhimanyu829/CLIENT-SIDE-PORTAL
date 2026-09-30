import { notFound } from "next/navigation"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getApprovalView } from "@/lib/agent-gateway/approvals/query-service"
import { isValidPublicRef } from "@/lib/agent-gateway/approvals/http"
import AgentApprovalDecisionClient from "./AgentApprovalDecisionClient"

export const dynamic = "force-dynamic"

/**
 * Phase 7 — the human approval surface ("Agent approval"). Loading this
 * page NEVER changes approval state; every decision is an explicit POST.
 */
export default async function AgentApprovalPage({ params }: { params: Promise<{ ref: string }> }) {
  await requireSuperAdmin()
  const { ref } = await params
  if (!isValidPublicRef(ref)) notFound()
  const approval = await getApprovalView(ref)
  if (!approval) notFound()

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Agent approval</h1>
        <p className="font-mono text-sm text-muted-foreground" data-approval-ref={approval.publicRef}>
          {approval.publicRef}
        </p>
      </header>

      <section aria-labelledby="summary-heading" className="space-y-2">
        <h2 id="summary-heading" className="text-lg font-medium">Requested operation</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt>Status</dt>
          <dd data-approval-status={approval.effectiveStatus}>{approval.effectiveStatus}</dd>
          <dt>Capability</dt>
          <dd>{approval.capabilityId} (v{approval.capabilityVersion})</dd>
          <dt>Risk</dt>
          <dd>{approval.riskTier}</dd>
          <dt>Environment</dt>
          <dd>{approval.environment}</dd>
          <dt>Resource</dt>
          <dd>{approval.resourceType ? `${approval.resourceType}:${approval.resourceId ?? "-"}` : "-"}</dd>
          <dt>Connection</dt>
          <dd className="font-mono">{approval.connectionId}</dd>
          <dt>Autonomy level</dt>
          <dd>{approval.autonomyLevel}</dd>
          <dt>Expires</dt>
          <dd>{approval.expiresAt.toISOString()}</dd>
        </dl>
        <h3 className="pt-2 text-sm font-medium">Redacted details</h3>
        <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(approval.displaySummary, null, 2)}</pre>
        <h3 className="pt-2 text-sm font-medium">Binding digest</h3>
        <p className="break-all font-mono text-xs">{approval.bindingDigest}</p>
      </section>

      <AgentApprovalDecisionClient
        publicRef={approval.publicRef}
        bindingDigest={approval.bindingDigest}
        status={approval.effectiveStatus}
      />
    </main>
  )
}
