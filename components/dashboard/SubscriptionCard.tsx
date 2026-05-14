"use client"

import { Button } from "@/components/ui/button"

interface Subscription {
  id: string
  status: string
  currentPeriodEnd: string | Date
  cancelAtPeriodEnd: boolean
  trialEndsAt?: string | Date | null
  tier: { name: string; price: number; currency: string; features?: string[] }
  product: { name: string; slug: string; thumbnailUrl?: string | null }
}

interface SubscriptionCardProps {
  subscription: Subscription | null
  onCancel?: () => Promise<void>
  onReactivate?: () => Promise<void>
  onUpgrade?: () => void
  loading?: boolean
}

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIALING: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-zinc-100 text-zinc-600",
  CANCELLED: "bg-rose-100 text-rose-700",
  PAST_DUE: "bg-orange-100 text-orange-700",
}

export function SubscriptionCard({
  subscription,
  onCancel,
  onReactivate,
  onUpgrade,
  loading,
}: SubscriptionCardProps) {
  if (loading) {
    return (
      <div className="border rounded-2xl p-6 bg-card animate-pulse space-y-3">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center text-center gap-4">
        <span className="text-4xl">📦</span>
        <div>
          <p className="font-bold text-lg">No active subscription</p>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a plan to unlock all features.
          </p>
        </div>
        <Button onClick={onUpgrade} className="mt-2">
          Browse Plans
        </Button>
      </div>
    )
  }

  const periodEnd = new Date(subscription.currentPeriodEnd)
  const daysLeft = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isTrialing = subscription.status === "TRIALING"
  const isCancelling = subscription.cancelAtPeriodEnd

  return (
    <div className="border rounded-2xl p-6 bg-card shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
            {subscription.product.name}
          </p>
          <p className="text-2xl font-bold">{subscription.tier.name}</p>
          <p className="text-muted-foreground text-sm">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: subscription.tier.currency,
            }).format(subscription.tier.price)}
            /mo
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor[subscription.status] ?? "bg-zinc-100 text-zinc-600"}`}>
          {subscription.status}
        </span>
      </div>

      {/* Period info */}
      <div className="text-sm text-muted-foreground space-y-1">
        {isTrialing && subscription.trialEndsAt && (
          <p>
            Trial ends <strong className="text-foreground">{new Date(subscription.trialEndsAt).toLocaleDateString()}</strong>
          </p>
        )}
        {isCancelling ? (
          <p className="text-rose-500">
            Cancels on <strong>{periodEnd.toLocaleDateString()}</strong> ({daysLeft}d left)
          </p>
        ) : (
          <p>
            Renews <strong className="text-foreground">{periodEnd.toLocaleDateString()}</strong> ({daysLeft}d)
          </p>
        )}
      </div>

      {/* Features */}
      {subscription.tier.features && subscription.tier.features.length > 0 && (
        <ul className="space-y-1">
          {subscription.tier.features.map((f, i) => (
            <li key={i} className="text-sm flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {isCancelling ? (
          <Button variant="outline" size="sm" onClick={onReactivate}>
            Reactivate
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-rose-500 border-rose-200" onClick={onCancel}>
            Cancel Plan
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onUpgrade}>
          Change Plan
        </Button>
      </div>
    </div>
  )
}
