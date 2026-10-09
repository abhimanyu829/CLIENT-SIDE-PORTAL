import { Suspense } from "react"
import PlansCatalog from "@/components/dashboard/subscription/PlansCatalog"

export const dynamic = "force-dynamic"

export const metadata = { title: "Plans & Pricing" }

export default function SubscriptionPlansPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading plans…</div>}>
      <PlansCatalog />
    </Suspense>
  )
}