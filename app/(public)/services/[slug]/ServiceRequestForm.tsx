"use client"

import { useState } from "react"
import { toast } from "sonner"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return "Something went wrong"
}

type RequestType = "CANCELLATION" | "REFUND"

export default function ServiceRequestForm({
  servicePageId,
  serviceTitle,
}: {
  servicePageId: string
  serviceTitle: string
}) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [requestType, setRequestType] = useState<RequestType>("REFUND")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const payload = {
      servicePageId,
      requestType,
      serviceOrderId: formData.get("serviceOrderId") ? String(formData.get("serviceOrderId")) : undefined,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      orderRef: formData.get("orderRef") ? String(formData.get("orderRef")) : undefined,
      reason: String(formData.get("reason") ?? ""),
    }

    try {
      const res = await fetch("/api/public/services/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || "Failed to submit request")

      setSuccess(true)
      toast.success("Service request submitted")
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      console.error("[ServiceRequestForm] submit failed:", error)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-lg font-semibold">
          OK
        </div>
        <h3 className="mb-2 text-lg font-semibold text-white">Request received</h3>
        <p className="text-sm text-emerald-100/80">
          We logged your {requestType.toLowerCase()} request for {serviceTitle}. The admin team has been notified.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-800 bg-[#0f172a] p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-400">Service request</p>
        <h3 className="mt-2 text-2xl font-bold text-white">Cancellation or refund</h3>
        <p className="mt-2 text-sm text-gray-400">
          Submit a backend-tracked service request. The admin team reviews every request from the service center.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setRequestType("REFUND")}
          className={`rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
            requestType === "REFUND" ? "bg-indigo-600 text-white" : "bg-black/20 text-zinc-300 hover:bg-white/5"
          }`}
        >
          Refund request
        </button>
        <button
          type="button"
          onClick={() => setRequestType("CANCELLATION")}
          className={`rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
            requestType === "CANCELLATION" ? "bg-indigo-600 text-white" : "bg-black/20 text-zinc-300 hover:bg-white/5"
          }`}
        >
          Cancellation request
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Full Name</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-2.5 text-white outline-none transition focus:border-indigo-500"
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-2.5 text-white outline-none transition focus:border-indigo-500"
            placeholder="john@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Order Reference</label>
          <input
            name="orderRef"
            className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-2.5 text-white outline-none transition focus:border-indigo-500"
            placeholder="Optional order or invoice ID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Service Order ID</label>
          <input
            name="serviceOrderId"
            className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-2.5 text-white outline-none transition focus:border-indigo-500"
            placeholder="Optional internal service order ID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Reason</label>
          <textarea
            name="reason"
            required
            minLength={10}
            rows={5}
            className="w-full resize-y rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-3 text-white outline-none transition focus:border-indigo-500"
            placeholder="Explain why you need this cancellation or refund..."
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Request"}
      </button>

      <p className="text-center text-xs text-gray-500">
        Every request is stored server-side and routed to the admin review queue.
      </p>
    </form>
  )
}
