"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

type ServiceOrder = {
  id: string
  orderNumber: string
  status: "DRAFT" | "PENDING_PAYMENT" | "PAID" | "FULFILLING" | "ACTIVE" | "CANCELLED" | "FAILED" | "EXPIRED"
  currency: string
  subtotal: number
  taxTotal: number
  discountTotal: number
  grandTotal: number
  createdAt: string
  servicePage?: { title: string; slug: string } | null
  servicePlan?: { name: string; type: string; billingLabel?: string | null } | null
  user?: { name: string | null; email: string } | null
}

const statusStyle: Record<ServiceOrder["status"], string> = {
  DRAFT: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  PENDING_PAYMENT: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  PAID: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  FULFILLING: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-300 border-red-500/20",
  FAILED: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  EXPIRED: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
}

export default function AdminServiceOrdersClient({ initialOrders }: { initialOrders: ServiceOrder[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [filter, setFilter] = useState<string>("ALL")
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const visibleOrders = useMemo(() => {
    if (filter === "ALL") return orders
    return orders.filter((order) => order.status === filter)
  }, [orders, filter])

  const fulfillOrder = async (orderId: string) => {
    setLoadingId(orderId)
    try {
      const res = await fetch(`/api/admin/services/orders/${orderId}/fulfill`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Unable to fulfill service order")
      }
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "ACTIVE" } : order)))
      toast.success("Service order fulfilled")
    } catch (error: any) {
      toast.error(error.message || "Unable to fulfill service order")
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {["ALL", "PENDING_PAYMENT", "PAID", "ACTIVE", "CANCELLED", "FAILED"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              filter === item
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0f172a]">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-[#1e293b] text-xs font-semibold uppercase text-gray-300">
            <tr>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Plan</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {visibleOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-800/50">
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{order.orderNumber}</div>
                  <div className="text-xs text-zinc-500">{order.user?.email}</div>
                </td>
                <td className="px-6 py-4">{order.servicePage?.title ?? "Service"}</td>
                <td className="px-6 py-4">{order.servicePlan?.name ?? "Plan"}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${statusStyle[order.status]}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-white">${Number(order.grandTotal).toLocaleString()}</td>
                <td className="px-6 py-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  {order.status === "ACTIVE" ? (
                    <span className="text-xs text-emerald-300">Fulfilled</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fulfillOrder(order.id)}
                      disabled={loadingId === order.id || order.status === "CANCELLED" || order.status === "FAILED"}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingId === order.id ? "Working..." : "Fulfill"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visibleOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                  No service orders found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
