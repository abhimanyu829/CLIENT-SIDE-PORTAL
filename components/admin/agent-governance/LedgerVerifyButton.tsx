"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { describeFailure, sendGovernance } from "./governance-client"

interface Verification {
  ok: boolean
  checked: number
  headSequence: number | null
  lastVerifiedSequence: number | null
  truncated: boolean
  failure?: { sequence: number; reason: string }
}

const REASONS: Record<string, string> = {
  SEQUENCE_GAP: "an event is missing (deleted)",
  BROKEN_LINK: "an event does not link to its predecessor (edited, reordered or substituted)",
  DIGEST_MISMATCH: "an event's content does not match its digest (edited)",
  DUPLICATE_EVENT_ID: "an event was replayed (duplicate event id)",
  UNKNOWN_SCHEMA: "an event has an unknown schema version",
}

/**
 * Runs a read-only verification of the audit ledger's hash chain (one POST
 * to the dedicated route; it never changes anything) and reports the result
 * in a polite live region.
 */
export function LedgerVerifyButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Verification | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    const res = await sendGovernance<{ verification: Verification }>("/api/admin/agent-governance/ledger/verify", { body: {} })
    setBusy(false)
    if (!res.ok || !res.data?.verification) {
      setResult(null)
      setError(describeFailure(res).description)
      return
    }
    setResult(res.data.verification)
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run()}>
        {busy ? "Verifying…" : "Verify chain integrity"}
      </Button>
      <div aria-live="polite" className="text-sm">
        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {result && result.ok ? (
          <p className="text-emerald-700 dark:text-emerald-300">
            Chain intact: {result.checked} events verified{result.truncated ? " (partial: the verification limit was reached)" : ""}. Head sequence{" "}
            {result.headSequence ?? "none"}.
          </p>
        ) : null}
        {result && !result.ok ? (
          <p role="alert" className="text-red-700 dark:text-red-300">
            Integrity failure at event {result.failure?.sequence}: {REASONS[result.failure?.reason ?? ""] ?? result.failure?.reason}. Treat the ledger as
            untrustworthy from this event on and investigate.
          </p>
        ) : null}
      </div>
    </div>
  )
}
