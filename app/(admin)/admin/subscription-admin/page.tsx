import { Suspense } from "react"
import { requireAdmin } from "@/lib/admin-auth"
import GovernanceWorkspace from "@/components/admin/GovernanceWorkspace"

export const dynamic = "force-dynamic"

export const metadata = { title: "Subscription Governance" }

export default async function SubscriptionAdminPage() {
  const admin = await requireAdmin()
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading subscription governance…</div>}>
      <GovernanceWorkspace isSuperAdmin={admin.isSuperAdmin} adminId={admin.userId} />
    </Suspense>
  )
}