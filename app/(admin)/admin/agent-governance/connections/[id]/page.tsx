import Link from "next/link"
import { notFound } from "next/navigation"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { getConnectionDetail, type ConnectionDetail } from "@/lib/agent-gateway/governance/queries"
import { ConnectionActions } from "@/components/admin/agent-governance/ConnectionActions"
import { AutonomyEditor } from "@/components/admin/agent-governance/AutonomyEditor"
import { GovTable, KeyValues, Mono, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

export default async function GovernanceConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGovernanceViewer()
  const { id } = await params
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound()
  let detail: ConnectionDetail | null = null
  let unavailable = false
  try {
    detail = await getConnectionDetail(id)
  } catch {
    unavailable = true
  }
  if (unavailable) return <Unavailable what="This connection" />
  if (!detail) notFound()
  const c = detail.connection

  return (
    <section aria-labelledby="connection-heading" className="space-y-6">
      <SectionHeader id="connection-heading" title={c.name} description={`Agent connection ${c.id}`}>
        <ConnectionActions connectionId={c.id} status={c.status} />
      </SectionHeader>
      <KeyValues
        items={[
          { label: "Status", value: <StatusPill status={c.status} /> },
          { label: "Provider", value: c.provider },
          { label: "Owner", value: <Mono>{c.ownerId}</Mono> },
          { label: "Team", value: c.teamId ? <Mono>{c.teamId}</Mono> : "—" },
          { label: "Environment", value: c.environment },
          { label: "Authentication", value: c.authMethod },
          { label: "Created", value: <Time value={c.createdAt} /> },
          { label: "Last authenticated", value: <Time value={c.lastAuthenticatedAt} /> },
          { label: "Expires", value: <Time value={c.expiresAt} /> },
          { label: "Pending approvals", value: <Link className="underline" href={`/admin/agent-governance/approvals?status=PENDING&connectionId=${c.id}`}>{detail.pendingApprovals}</Link> },
        ]}
      />

      <div className="space-y-2">
        <h3 className="font-medium">Credentials</h3>
        <GovTable
          caption="Credentials of this connection (fingerprints only)"
          rows={detail.credentials}
          rowKey={(r) => r.id}
          empty="No credential."
          columns={[
            { header: "Fingerprint", cell: (r) => <Mono>{r.fingerprint ?? "—"}</Mono> },
            { header: "Key id", cell: (r) => <Mono>{r.keyId ?? "—"}</Mono> },
            { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Created", cell: (r) => <Time value={r.createdAt} /> },
            { header: "Last used", cell: (r) => <Time value={r.lastUsedAt} /> },
            { header: "Revoked", cell: (r) => <Time value={r.revokedAt} /> },
          ]}
        />
      </div>

      {c.status === "REVOKED" ? (
        <p className="text-sm text-muted-foreground">This connection is revoked; its autonomy can no longer be changed.</p>
      ) : (
        <AutonomyEditor connectionId={c.id} active={detail.autonomy.active} latestVersion={detail.autonomy.latestVersion} />
      )}

      <div className="space-y-2">
        <h3 className="font-medium">Autonomy history</h3>
        <GovTable
          caption="Autonomy policy versions"
          rows={detail.autonomy.history}
          rowKey={(r) => String(r.version)}
          empty="Never configured: the connection uses the default observe-only posture."
          columns={[
            { header: "Version", cell: (r) => r.version },
            { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Level", cell: (r) => r.autonomyLevel.replace(/_/g, " ") },
            { header: "Max risk", cell: (r) => r.maxRiskTier.replace(/_/g, " ") },
            { header: "Created", cell: (r) => <Time value={r.createdAt} /> },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Triggers</h3>
        <GovTable
          caption="Triggers of this connection"
          rows={detail.triggers}
          rowKey={(r) => r.triggerRef}
          empty="No trigger."
          columns={[
            { header: "Trigger", cell: (r) => <Link className="underline" href={`/admin/agent-governance/triggers/${r.triggerRef}`}>{r.name}</Link> },
            { header: "Type", cell: (r) => r.type },
            { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Capability", cell: (r) => <Mono>{`${r.capabilityId}@v${r.capabilityVersion}`}</Mono> },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Recent tasks</h3>
        <GovTable
          caption="Recent tasks of this connection"
          rows={detail.recentTasks}
          rowKey={(r) => r.taskRef}
          empty="No task."
          columns={[
            { header: "Task", cell: (r) => <Link className="underline font-mono text-xs" href={`/admin/agent-governance/tasks/${r.taskRef}`}>{r.taskRef}</Link> },
            { header: "Capability", cell: (r) => <Mono>{r.capabilityId}</Mono> },
            { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
            { header: "Origin", cell: (r) => r.origin },
            { header: "Created", cell: (r) => <Time value={r.createdAt} /> },
          ]}
        />
      </div>
    </section>
  )
}
