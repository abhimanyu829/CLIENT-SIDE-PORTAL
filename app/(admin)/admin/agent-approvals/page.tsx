import Link from "next/link"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { listPendingApprovals } from "@/lib/agent-gateway/approvals/query-service"

export const dynamic = "force-dynamic"

/** Phase 7 — pending agent approval requests (SUPER_ADMIN only). Read-only list. */
export default async function AgentApprovalsPage() {
  await requireSuperAdmin()
  let approvals: Awaited<ReturnType<typeof listPendingApprovals>> = []
  let unavailable = false
  try {
    approvals = await listPendingApprovals()
  } catch {
    unavailable = true
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Agent approvals</h1>
        <p className="text-sm text-muted-foreground">
          Operations an AI agent has requested that need a human decision. Approving requires an SMS code sent to your verified phone.
        </p>
      </header>

      {unavailable ? (
        <p role="alert" className="text-sm text-destructive">
          Approval storage is unavailable. No agent operation requiring approval can run until it is restored.
        </p>
      ) : approvals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Pending agent approvals</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2">Reference</th>
              <th scope="col">Capability</th>
              <th scope="col">Risk</th>
              <th scope="col">Environment</th>
              <th scope="col">Resource</th>
              <th scope="col">Expires</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((a) => (
              <tr key={a.publicRef} className="border-b">
                <td className="py-2 font-mono">
                  <Link className="underline" href={`/admin/agent-approvals/${a.publicRef}`}>
                    {a.publicRef}
                  </Link>
                </td>
                <td>{a.capabilityId}</td>
                <td>{a.riskTier}</td>
                <td>{a.environment}</td>
                <td>{a.resourceType ? `${a.resourceType}:${a.resourceId ?? "-"}` : "-"}</td>
                <td>{a.expiresAt.toISOString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
