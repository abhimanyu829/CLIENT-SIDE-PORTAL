"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

type ServiceRequest = {
  id: string
  type: "CANCELLATION" | "REFUND"
  status: "OPEN" | "APPROVED" | "REJECTED" | "CLOSED"
  name: string
  email: string
  orderRef?: string | null
  serviceOrderId?: string | null
  reason: string
  adminNotes?: string | null
  reviewedAt?: string | null
  createdAt: string
  servicePage?: { title: string; slug: string } | null
}

function StatusBadge({ status }: { status: ServiceRequest["status"] }) {
  const styles: Record<ServiceRequest["status"], string> = {
    OPEN: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    REJECTED: "bg-red-500/10 text-red-300 border-red-500/20",
    CLOSED: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  }
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${styles[status]}`}>{status}</span>
}

export default function AdminServiceRequestsClient({ initialRequests }: { initialRequests: ServiceRequest[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [selectedId, setSelectedId] = useState(initialRequests[0]?.id ?? "")
  const [adminNotes, setAdminNotes] = useState("")

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  )

  const updateRequest = async (action: "APPROVE" | "REJECT" | "CLOSE") => {
    if (!selectedRequest) return
    const res = await fetch(`/api/admin/services/requests/${selectedRequest.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNotes }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Unable to update request")
    setRequests((prev) => prev.map((item) => (item.id === selectedRequest.id ? { ...item, ...json.data } : item)))
    toast.success(`Request ${action.toLowerCase()}d`)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex h-[720px] flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#0f172a] lg:col-span-1">
        <div className="border-b border-gray-800 bg-[#1e293b] px-4 py-3">
          <h2 className="font-semibold text-white">Service Requests</h2>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {requests.map((request) => (
            <button
              key={request.id}
              onClick={() => {
                setSelectedId(request.id)
                setAdminNotes(request.adminNotes ?? "")
              }}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selectedRequest?.id === request.id
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-transparent bg-[#1e293b]/50 hover:bg-[#1e293b]"
              }`}
            >
              <div className="mb-1 flex items-start justify-between gap-3">
                <span className="truncate pr-2 font-medium text-white">{request.name}</span>
                <StatusBadge status={request.status} />
              </div>
              <p className="truncate text-sm text-gray-400">{request.email}</p>
              <p className="mt-2 text-xs text-gray-500">
                {request.type}
                {request.servicePage?.title ? ` - ${request.servicePage.title}` : ""}
              </p>
            </button>
          ))}
          {requests.length === 0 && <div className="p-6 text-center text-gray-500">No service requests found.</div>}
        </div>
      </div>

      <div className="flex h-[720px] flex-col rounded-2xl border border-gray-800 bg-[#0f172a] lg:col-span-2">
        {selectedRequest ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 pb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">{selectedRequest.type}</p>
                <h2 className="mt-2 text-2xl font-bold text-white">{selectedRequest.name}</h2>
                <div className="mt-2 space-y-1 text-sm text-gray-400">
                  <p>
                    <a href={`mailto:${selectedRequest.email}`} className="text-indigo-400 hover:underline">
                      {selectedRequest.email}
                    </a>
                  </p>
                  {selectedRequest.servicePage?.title && <p>Service: {selectedRequest.servicePage.title}</p>}
                  {selectedRequest.orderRef && <p>Order ref: {selectedRequest.orderRef}</p>}
                  {selectedRequest.serviceOrderId && <p>Service order ID: {selectedRequest.serviceOrderId}</p>}
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={selectedRequest.status} />
                <p className="mt-2 text-xs text-gray-500">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-3 font-semibold text-white">Reason</h3>
                <div className="whitespace-pre-wrap rounded-xl bg-[#1e293b] p-4 text-sm leading-relaxed text-gray-300">
                  {selectedRequest.reason}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Admin notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-gray-700 bg-[#1e293b] px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                  placeholder="Add the decision notes for the customer and audit trail..."
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={selectedRequest.status !== "OPEN"}
                onClick={async () => {
                  try {
                    await updateRequest("APPROVE")
                  } catch (error: any) {
                    toast.error(error.message || "Unable to approve request")
                  }
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={selectedRequest.status !== "OPEN"}
                onClick={async () => {
                  try {
                    await updateRequest("REJECT")
                  } catch (error: any) {
                    toast.error(error.message || "Unable to reject request")
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={selectedRequest.status !== "OPEN"}
                onClick={async () => {
                  try {
                    await updateRequest("CLOSE")
                  } catch (error: any) {
                    toast.error(error.message || "Unable to close request")
                  }
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">Select a request to review</div>
        )}
      </div>
    </div>
  )
}
