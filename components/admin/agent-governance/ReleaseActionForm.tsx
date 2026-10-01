"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { describeFailure, sendGovernance } from "./governance-client"

/**
 * Phase 15 — one release-control operation (kill switch, rollout step,
 * attestation, autonomy change): a fixed JSON body plus a mandatory reason
 * typed by the operator. One POST to the operation's own route; the result
 * is announced in a live region and the page is refreshed.
 */
export function ReleaseActionForm({
  url,
  body,
  label,
  destructive = false,
  extraField,
}: {
  url: string
  body: Record<string, unknown>
  label: string
  destructive?: boolean
  /** Optional free-text field merged into the body (e.g. a kill switch target). */
  extraField?: { name: string; label: string; placeholder?: string }
}) {
  const router = useRouter()
  const reasonId = useId()
  const extraId = useId()
  const [reason, setReason] = useState("")
  const [extra, setExtra] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const payload = { ...body, reason, ...(extraField && extra.trim() ? { [extraField.name]: extra.trim() } : {}) }
    const res = await sendGovernance(url, { body: payload })
    setBusy(false)
    if (!res.ok) {
      const failure = describeFailure(res)
      setMessage({ ok: false, text: `${failure.title}: ${failure.description}` })
      return
    }
    setMessage({ ok: true, text: "Done." })
    setReason("")
    setExtra("")
    router.refresh()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-end gap-2">
      {extraField ? (
        <div className="flex flex-col">
          <label htmlFor={extraId} className="text-xs text-muted-foreground">
            {extraField.label}
          </label>
          <input id={extraId} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={extraField.placeholder} className="h-8 rounded border px-2 text-sm" maxLength={100} />
        </div>
      ) : null}
      <div className="flex flex-col">
        <label htmlFor={reasonId} className="text-xs text-muted-foreground">
          Reason (required)
        </label>
        <input id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} className="h-8 w-56 rounded border px-2 text-sm" />
      </div>
      <Button type="submit" size="sm" variant={destructive ? "destructive" : "outline"} disabled={busy || reason.trim().length < 3}>
        {busy ? "Working…" : label}
      </Button>
      <span aria-live="polite" className="text-xs">
        {message ? <span className={message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"} role={message.ok ? undefined : "alert"}>{message.text}</span> : null}
      </span>
    </form>
  )
}
