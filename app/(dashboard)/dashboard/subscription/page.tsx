import { Suspense } from "react"
import SubscriptionOverview from "@/components/dashboard/subscription/SubscriptionOverview"

export const dynamic = "force-dynamic"

export const metadata = { title: "Subscription & Access" }

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading subscription state…</div>}>
      <SubscriptionOverview />
    </Suspense>
  )
}