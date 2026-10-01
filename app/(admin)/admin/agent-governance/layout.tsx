import type { ReactNode } from "react"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { GovernanceNav } from "@/components/admin/agent-governance/GovernanceNav"

export const dynamic = "force-dynamic"

/**
 * Phase 10 — Agent Governance (SUPER_ADMIN only). Lives inside the existing
 * admin panel and layout. Every page below also calls requireGovernanceViewer()
 * itself, because layouts are not re-run on client-side navigation.
 */
export default async function AgentGovernanceLayout({ children }: { children: ReactNode }) {
  await requireGovernanceViewer()
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Agent Governance</h1>
        <p className="text-sm text-muted-foreground">
          Super administrators only. Agent connections, capabilities, authorization policies, autonomy, approvals, tasks and triggers of the
          Abhibhi Agent Gateway.
        </p>
      </header>
      <GovernanceNav />
      <div className="space-y-6">{children}</div>
    </div>
  )
}
