"use client"

/**
 * components/public/EnquiryForm.tsx
 * Shared, accessible enquiry form used by /contact, /solutions/enterprise,
 * /affiliates and /press. Posts to /api/enquiries (server-validated,
 * honeypot-protected). Distinct support vs sales routing via category.
 */
import { useState } from "react"
import Link from "next/link"
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

export type EnquiryCategory =
  | "product-pricing"
  | "custom-software-ai"
  | "enterprise"
  | "technical-support"
  | "billing-subscription"
  | "affiliate-partnership"
  | "privacy-legal"
  | "press-media"

const CATEGORY_LABELS: Record<EnquiryCategory, string> = {
  "product-pricing": "Product & pricing",
  "custom-software-ai": "Custom software / AI automation",
  enterprise: "Enterprise requirements",
  "technical-support": "Technical support",
  "billing-subscription": "Billing & subscription",
  "affiliate-partnership": "Affiliate / partnership",
  "privacy-legal": "Privacy & legal request",
  "press-media": "Press & media",
}

export function EnquiryForm({
  categories,
  defaultCategory,
  compact = false,
  showOrganization = true,
}: {
  categories: EnquiryCategory[]
  defaultCategory?: EnquiryCategory
  compact?: boolean
  showOrganization?: boolean
}) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (state === "submitting") return
    const form = e.currentTarget
    const data = new FormData(form)
    setState("submitting")
    setError(null)
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          organization: data.get("organization"),
          category: data.get("category"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(typeof json.error === "string" ? json.error : "Submission failed.")
      setState("success")
      form.reset()
    } catch (err) {
      setError((err as Error).message ?? "Submission failed. Please try again.")
      setState("error")
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-100">
        <p className="flex items-center gap-2 text-base font-semibold">
          <CheckCircle2 className="h-5 w-5" /> Enquiry recorded
        </p>
        <p className="mt-2 text-sm leading-6">
          Thank you — your enquiry has been submitted to Abhibhideveloper. A monitored mailbox is reviewed
          periodically; please allow reasonable time for a reply. Do not send passwords, OTPs, or payment
          credentials in any follow-up.
        </p>
        <button type="button" onClick={() => setState("idle")} className="mt-4 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-accent/10">
          Send another enquiry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Your name *</span>
          <input name="name" required maxLength={120} autoComplete="name"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Business email *</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        {showOrganization && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Organization</span>
            <input name="organization" maxLength={160} autoComplete="organization"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Enquiry type *</span>
          <select name="category" defaultValue={defaultCategory ?? categories[0]} required
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">How can we help? *</span>
        <textarea name="message" required minLength={10} maxLength={4000} rows={compact ? 4 : 6}
          placeholder="Describe your requirement, the problem you want to solve, or the task you want to automate."
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Please do not include passwords, card details, OTPs, or confidential third-party information.
        </span>
      </label>

      {/* Honeypot — hidden from users, filled only by bots. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state === "error" && error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "submitting"}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60">
          {state === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {state === "submitting" ? "Submitting…" : "Submit enquiry"}
        </button>
        <p className="text-xs text-muted-foreground">
          By submitting, you agree to our{" "}
          <Link href="/privacy" className="text-indigo-400 hover:underline underline-offset-4">Privacy Policy</Link>.
          Enquiries are recorded for follow-up purposes only.
        </p>
      </div>
    </form>
  )
}