"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SubscriptionsClient({ initialSubscriptions, availableProducts }: { initialSubscriptions: any[], availableProducts: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  
  const handleUpgrade = async (priceId: string, productId: string, planName: string, amount: number) => {
    setLoading(priceId)
    try {
      const res = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, productId, planName, amount }),
      })
      const { data, error } = await res.json()
      if (error) throw new Error(error)
      if (data?.url) window.location.href = data.url
    } catch (err) {
      alert("Failed to initiate checkout")
    } finally {
      setLoading(null)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this subscription?")) return
    setLoading(id)
    try {
      const res = await fetch(`/api/subscriptions/${id}/cancel`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to cancel")
      router.refresh()
    } catch (err) {
      alert("Failed to cancel subscription")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your active plans and services.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-white/5 pb-2">Your Active Plans</h2>
        {initialSubscriptions.length === 0 ? (
          <div className="dash-glass p-8 rounded-2xl text-center">
            <span className="text-4xl">🚀</span>
            <p className="mt-4 text-zinc-400">You don't have any active subscriptions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {initialSubscriptions.map(sub => (
              <div key={sub.id} className="dash-glass p-6 rounded-2xl border-white/10 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{sub.product?.name ?? "Custom Plan"}</h3>
                    <p className="text-xs text-zinc-500">{sub.status}</p>
                  </div>
                  <span className="text-2xl">⬡</span>
                </div>
                <div className="space-y-1 mb-6">
                  <p className="text-sm"><span className="text-zinc-500">Price:</span> ${Number(sub.price).toFixed(2)}/{sub.billingCycle}</p>
                  <p className="text-sm"><span className="text-zinc-500">Next Billing:</span> {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
                </div>
                {sub.status !== "CANCELED" && (
                  <button 
                    onClick={() => handleCancel(sub.id)}
                    disabled={loading === sub.id}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {loading === sub.id ? "Canceling..." : "Cancel Subscription"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-8">
        <h2 className="text-lg font-semibold border-b border-white/5 pb-2">Available Upgrades</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {availableProducts.map(prod => (
            <div key={prod.id} className="dash-glass p-6 rounded-2xl border-white/5 hover:border-white/20 transition-all flex flex-col">
              <div className="text-3xl mb-4">{prod.iconUrl || "📦"}</div>
              <h3 className="font-bold text-xl mb-2">{prod.name}</h3>
              <p className="text-sm text-zinc-400 mb-6 flex-1">{prod.tagline}</p>
              
              <button 
                onClick={() => handleUpgrade("price_placeholder", prod.id, prod.name, 99)}
                disabled={loading !== null}
                className="w-full py-2.5 rounded-lg dash-btn text-white font-medium text-sm disabled:opacity-50 transition-transform active:scale-95"
              >
                {loading === "price_placeholder" ? "Processing..." : "Upgrade Now"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
