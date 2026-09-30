"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  publicRef: string
  bindingDigest: string
  status: string
}

type Result = { success: boolean; code?: string; error?: string; deliveredTo?: string; status?: string }

async function post(url: string, body?: unknown): Promise<Result> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return (await res.json().catch(() => ({ success: false, error: "Unexpected response." }))) as Result
}

/**
 * Explicit human decision controls. Nothing here runs on load. Approving
 * requires ticking the confirmation box AND entering the SMS code sent to
 * the approver's verified phone (the out-of-band factor an agent driving
 * this desktop cannot see).
 */
export default function AgentApprovalDecisionClient({ publicRef, bindingDigest, status }: Props) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const base = `/api/admin/agent-approvals/${publicRef}`
  const pending = status === "PENDING"

  async function run(action: () => Promise<Result>, ok: (r: Result) => string) {
    setBusy(true)
    setMessage(null)
    try {
      const r = await action()
      setMessage(r.success ? ok(r) : `${r.code ?? "ERROR"}: ${r.error ?? "Request failed."}`)
      if (r.success) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!pending) {
    return (
      <section aria-labelledby="decision-heading" className="space-y-2">
        <h2 id="decision-heading" className="text-lg font-medium">Decision</h2>
        <p className="text-sm">This request is {status} and can no longer be approved.</p>
        {status === "APPROVED" && (
          <button type="button" disabled={busy} className="rounded border px-3 py-1 text-sm"
            onClick={() => run(() => post(`${base}/cancel`), () => "Approval cancelled.")}>
            Cancel unused approval
          </button>
        )}
        {message && <p role="status" className="text-sm">{message}</p>}
      </section>
    )
  }

  return (
    <section aria-labelledby="decision-heading" className="space-y-4">
      <h2 id="decision-heading" className="text-lg font-medium">Decision</h2>

      <div className="flex items-start gap-2">
        <input id="confirm-binding" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <label htmlFor="confirm-binding" className="text-sm">
          I reviewed this exact operation (binding digest {bindingDigest.slice(0, 12)}…) and I am deciding it myself.
        </label>
      </div>

      <div className="space-y-2">
        <button type="button" disabled={busy} className="rounded border px-3 py-1 text-sm"
          onClick={() => run(() => post(`${base}/step-up`), (r) => `Code sent to ${r.deliveredTo}. It expires in 5 minutes.`)}>
          Send approval code to my phone
        </button>
        <div>
          <label htmlFor="step-up-code" className="block text-sm">Approval code</label>
          <input id="step-up-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="rounded border px-2 py-1 font-mono" />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={busy || !confirmed || code.length !== 6} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => run(() => post(`${base}/decision`, { decision: "APPROVE", confirmedBindingDigest: bindingDigest, stepUpCode: code }), () => "Approved. The agent may now retry this exact operation once.")}>
          Approve
        </button>
        <button type="button" disabled={busy || !confirmed} className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          onClick={() => run(() => post(`${base}/decision`, { decision: "REJECT", confirmedBindingDigest: bindingDigest }), () => "Rejected.")}>
          Reject
        </button>
        <button type="button" disabled={busy} className="rounded border px-3 py-1 text-sm"
          onClick={() => run(() => post(`${base}/cancel`), () => "Request cancelled.")}>
          Cancel request
        </button>
      </div>

      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  )
}
