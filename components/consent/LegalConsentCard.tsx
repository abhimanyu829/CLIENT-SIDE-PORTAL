"use client"
import Link from "next/link"
import { useState, useTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export function LegalConsentCard({ onAccepted }: { onAccepted?: () => void }) {
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function accept() {
    if (!checked) { setError("Please check the box to accept Terms and Privacy Policy."); return }
    setError(null)
    start(async () => {
      const res = await fetch("/api/legal/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accepted: true }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? "Failed to record acceptance."); return }
      onAccepted?.()
      location.reload()
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm" role="region" aria-label="Legal consent">
      <h2 className="text-sm font-semibold text-foreground">Terms & Privacy acceptance required</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Access to the marketplace requires accepting the current{" "}
        <Link href="/terms" target="_blank" className="text-primary underline underline-offset-4">Terms & Conditions</Link>
        {" "}and{" "}
        <Link href="/privacy" target="_blank" className="text-primary underline underline-offset-4">Privacy Policy</Link>
        {" "}and{" "}
        <Link href="/cookies" target="_blank" className="text-primary underline underline-offset-4">Cookie Policy</Link>.
        You can review them before accepting.
      </p>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 cursor-pointer">
        <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} aria-label="I have read and agree to the Terms and Privacy Policy" className="mt-0.5" />
        <span className="text-sm text-foreground">I have read and agree to the Terms & Conditions and Privacy Policy.</span>
      </label>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      <Button onClick={accept} disabled={pending} className="mt-4 w-full">Accept and continue</Button>
      <p className="mt-2 text-xs text-muted-foreground">Acceptance is recorded with your user ID, policy versions, and timestamp. Cookie preferences are separate and do not affect this gate.</p>
    </div>
  )
}
