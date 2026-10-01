import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { getReleaseOverview, type ReleaseOverview } from "@/lib/agent-gateway/governance/release"
import { GovTable, Mono, SectionHeader, StatusPill, Time, Unavailable } from "@/components/admin/agent-governance/ui"
import { ReleaseActionForm } from "@/components/admin/agent-governance/ReleaseActionForm"

export const dynamic = "force-dynamic"

const API = "/api/admin/agent-governance"

export default async function GovernanceReleasePage() {
  await requireGovernanceViewer()
  let data: ReleaseOverview | null = null
  try {
    data = await getReleaseOverview()
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="release-heading" className="space-y-6">
      <SectionHeader
        id="release-heading"
        title="Release controls"
        description="Kill switches stop agent operations immediately (checked before every decision and again before execution; queued tasks fail). Rollouts release one capability per environment in stages: disabled, internal cohort, canary, general. Health gates come from the audit ledger; unhealthy internal and canary rollouts are paused automatically. Every change needs a reason and is recorded in the audit log and the ledger."
      />
      {data === null ? (
        <Unavailable what="Release controls" />
      ) : (
        <>
          <p className="text-sm">
            Environment <Mono>{data.environment}</Mono>.{" "}
            {data.enforced ? "Rollout enforcement is on: a capability without a rollout is disabled." : "Rollout enforcement is off: a capability without a rollout keeps its current behaviour."}
          </p>

          <section aria-labelledby="kill-heading" className="space-y-2">
            <h3 id="kill-heading" className="text-base font-semibold">
              Kill switches
            </h3>
            <ReleaseActionForm url={`${API}/kill-switches`} body={{ scope: "GLOBAL" }} label="Stop all agent operations" destructive />
            <ReleaseActionForm url={`${API}/kill-switches`} body={{ scope: "CAPABILITY" }} label="Stop one capability" destructive extraField={{ name: "target", label: "Capability id", placeholder: "tickets.create" }} />
            <ReleaseActionForm url={`${API}/kill-switches`} body={{ scope: "CONNECTION" }} label="Stop one connection" destructive extraField={{ name: "target", label: "Connection id" }} />
            <ReleaseActionForm url={`${API}/kill-switches`} body={{ scope: "RISK_TIER" }} label="Stop a risk tier" destructive extraField={{ name: "target", label: "Risk tier", placeholder: "LOW_RISK_WRITE" }} />
            <GovTable
              caption="Kill switches, newest first"
              rows={data.killSwitches}
              rowKey={(k) => k.ref}
              empty="No kill switch has been used in this environment."
              columns={[
                { header: "Switch", cell: (k) => <Mono>{k.ref}</Mono> },
                { header: "State", cell: (k) => <StatusPill status={k.active ? "ACTIVE" : "INACTIVE"} /> },
                { header: "Scope", cell: (k) => k.scope.replace(/_/g, " ").toLowerCase() },
                { header: "Target", cell: (k) => (k.target ? <Mono>{k.target}</Mono> : "everything") },
                { header: "Reason", cell: (k) => <span className="text-xs">{k.reason}</span> },
                { header: "Activated", cell: (k) => <Time value={k.activatedAt} /> },
                { header: "Deactivated", cell: (k) => <Time value={k.deactivatedAt} /> },
                {
                  header: "Action",
                  cell: (k) => (k.active ? <ReleaseActionForm url={`${API}/kill-switches/${k.ref}/deactivate`} body={{ expectedVersion: k.version }} label="Deactivate" /> : null),
                },
              ]}
            />
          </section>

          <section aria-labelledby="rollout-heading" className="space-y-2">
            <h3 id="rollout-heading" className="text-base font-semibold">
              Rollouts
            </h3>
            <GovTable
              caption="Capability rollouts in this environment"
              rows={data.rollouts}
              rowKey={(r) => r.capabilityId}
              empty="No rollout is configured. Configure one through the rollouts route to start a staged release."
              columns={[
                { header: "Capability", cell: (r) => <Mono>{r.capabilityId}</Mono> },
                { header: "Stage", cell: (r) => <StatusPill status={r.stage} /> },
                { header: "Canary", cell: (r) => `${r.canaryPercent}%` },
                { header: "Cohort", cell: (r) => r.cohort.length },
                {
                  header: "Health",
                  cell: (r) => (
                    <span className="text-xs">
                      <StatusPill status={r.health.verdict} /> {r.health.samples} samples
                      {r.health.failureRate !== null ? `, ${(r.health.failureRate * 100).toFixed(1)}% service failures` : ""}
                      {r.health.reasons.length > 0 ? <span className="block text-muted-foreground">{r.health.reasons.join(", ")}</span> : null}
                    </span>
                  ),
                },
                { header: "Paused", cell: (r) => (r.pausedReason ? <span className="text-xs">{r.pausedReason}</span> : null) },
                { header: "Updated", cell: (r) => <Time value={r.updatedAt} /> },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="space-y-1">
                      {r.stage !== "GENERAL" && r.stage !== "PAUSED" ? <ReleaseActionForm url={`${API}/rollouts/transition`} body={{ capabilityId: r.capabilityId, action: "advance", expectedVersion: r.version }} label="Advance" /> : null}
                      {r.stage !== "DISABLED" && r.stage !== "PAUSED" ? <ReleaseActionForm url={`${API}/rollouts/transition`} body={{ capabilityId: r.capabilityId, action: "pause", expectedVersion: r.version }} label="Pause" destructive /> : null}
                      {r.stage === "PAUSED" ? <ReleaseActionForm url={`${API}/rollouts/transition`} body={{ capabilityId: r.capabilityId, action: "resume", expectedVersion: r.version }} label="Resume" /> : null}
                      {r.stage !== "DISABLED" ? <ReleaseActionForm url={`${API}/rollouts/transition`} body={{ capabilityId: r.capabilityId, action: "rollback", targetStage: "DISABLED", expectedVersion: r.version }} label="Roll back to disabled" destructive /> : null}
                    </div>
                  ),
                },
              ]}
            />
          </section>

          <section aria-labelledby="attest-heading" className="space-y-2">
            <h3 id="attest-heading" className="text-base font-semibold">
              Release attestations
            </h3>
            <p className="text-xs text-muted-foreground">Recorded in the append-only audit ledger. General availability in production needs a passed attestation from the last 7 days.</p>
            <GovTable
              caption="Latest release attestations"
              rows={data.attestations}
              rowKey={(a) => a.eventId}
              empty="No attestation has been recorded in this environment."
              columns={[
                { header: "Capability", cell: (a) => <Mono>{a.capabilityId}</Mono> },
                { header: "Result", cell: (a) => <StatusPill status={a.passed ? "PASSED" : "FAILED"} /> },
                { header: "Failed checks", cell: (a) => <span className="text-xs">{a.failedChecks.join(", ") || "none"}</span> },
                { header: "By", cell: (a) => <Mono>{a.recordedBy ?? "unknown"}</Mono> },
                { header: "Recorded", cell: (a) => <Time value={a.recordedAt} /> },
                { header: "Evidence", cell: (a) => <Mono>{a.eventId}</Mono> },
              ]}
            />
          </section>
        </>
      )}
    </section>
  )
}
