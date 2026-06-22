"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type ServicePlan = {
  id: string
  type: "SUBSCRIPTION" | "ONE_TIME"
  name: string
  billingLabel?: string | null
  price: number
  currency?: string | null
  description?: string | null
  features?: string[]
  isPopular?: boolean
  isActive?: boolean
}

type ServiceAddon = {
  id: string
  name: string
  description?: string | null
  price: number
  currency?: string | null
  enabled?: boolean
  bundleOnly?: boolean
  restricted?: boolean
  isPopular?: boolean
}

type Service = {
  id: string
  slug: string
  title: string
  heroHeading: string
  heroSubheading: string
  plans: ServicePlan[]
  addOns: ServiceAddon[]
}

export default function ServiceCheckoutClient({ service }: { service: Service }) {
  const router = useRouter()
  const plans = useMemo(() => service.plans.filter((plan) => plan.isActive !== false), [service.plans])
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "")
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<any | null>(null)

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null
  const visibleAddOns = service.addOns.filter((addon) => addon.enabled !== false && !addon.restricted)

  const subtotal = (selectedPlan?.price ?? 0) + visibleAddOns.filter((addon) => selectedAddOns.includes(addon.id)).reduce((sum, addon) => sum + addon.price, 0)

  const handleSubmit = async () => {
    if (!selectedPlanId) {
      toast.error("Choose a plan to continue")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/public/services/${service.slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicePlanId: selectedPlanId, addonIds: selectedAddOns }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Unable to create service order")

      setCreatedOrder(json.data)
      toast.success("Service order created")
    } catch (error: any) {
      toast.error(error.message || "Unable to create order")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-white/10 bg-[#0f172a] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-400">Service checkout</p>
        <h1 className="mt-2 text-3xl font-black text-white">{service.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{service.heroSubheading}</p>

        <div className="mt-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Choose a plan</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedPlanId === plan.id
                      ? "border-indigo-500/50 bg-indigo-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{plan.name}</p>
                      {plan.billingLabel && <p className="mt-1 text-xs text-zinc-400">{plan.billingLabel}</p>}
                    </div>
                    <span className="text-sm font-semibold text-white">${Number(plan.price).toLocaleString()}</span>
                  </div>
                  {plan.description && <p className="mt-3 text-sm text-zinc-400">{plan.description}</p>}
                </button>
              ))}
            </div>
          </div>

          {visibleAddOns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white">Optional add-ons</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {visibleAddOns.map((addon) => {
                  const checked = selectedAddOns.includes(addon.id)
                  return (
                    <label
                      key={addon.id}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        checked ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedAddOns((prev) =>
                              e.target.checked ? [...prev, addon.id] : prev.filter((id) => id !== addon.id)
                            )
                          }}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-white">{addon.name}</p>
                            <span className="text-sm font-semibold text-white">${Number(addon.price).toLocaleString()}</span>
                          </div>
                          {addon.description && <p className="mt-2 text-sm text-zinc-400">{addon.description}</p>}
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                            {addon.bundleOnly && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">Bundle</span>}
                            {addon.restricted && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300">Restricted</span>}
                          </div>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !selectedPlanId}
            className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating order..." : "Create service order"}
          </button>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Quote summary</p>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <Row label="Plan" value={selectedPlan ? `${selectedPlan.name} - $${Number(selectedPlan.price).toLocaleString()}` : "Select a plan"} />
            <Row
              label="Add-ons"
              value={
                selectedAddOns.length > 0
                  ? `${selectedAddOns.length} selected`
                  : "None selected"
              }
            />
            <Row label="Subtotal" value={`$${subtotal.toLocaleString()}`} />
            <Row label="Tax" value="$0.00" />
            <Row label="Discount" value="$0.00" />
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <Row label="Estimated total" value={`$${subtotal.toLocaleString()}`} strong />
          </div>
        </div>

        {createdOrder && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Order created</p>
            <p className="mt-3 text-lg font-semibold text-white">{createdOrder.orderNumber}</p>
            <p className="mt-2 text-sm text-emerald-100/80">
              Your service order is now pending payment and ready for the next payment step.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/services/${service.slug}`)}
              className="mt-4 inline-flex rounded-lg border border-emerald-400/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Back to service
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className={strong ? "text-base font-bold text-white" : "text-white"}>{value}</span>
    </div>
  )
}
