"use client"

import { useState } from "react"

export function VendorOnboardingClient() {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function submit(formData: FormData) {
    setState("saving")
    setError("")
    const payload = Object.fromEntries(formData.entries())
    const res = await fetch("/api/vendor/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Vendor onboarding failed")
      setState("error")
      return
    }
    setState("done")
    window.location.reload()
  }

  return (
    <form action={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
      <input name="displayName" required placeholder="Seller display name" className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none" />
      <input name="slug" required placeholder="seller-slug" className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none" />
      <select name="type" required className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none">
        <option value="AI_DEVELOPER">AI developer</option>
        <option value="SAAS_CREATOR">SaaS creator</option>
        <option value="AGENCY">Agency</option>
        <option value="API_PROVIDER">API provider</option>
        <option value="AUTOMATION_BUILDER">Automation builder</option>
      </select>
      <input name="supportEmail" placeholder="support@company.com" className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none" />
      <textarea name="description" placeholder="What do you sell?" className="sm:col-span-2 min-h-28 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none" />
      {error && <p className="sm:col-span-2 text-sm text-red-400">{error}</p>}
      <button disabled={state === "saving"} className="sm:col-span-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-60">
        {state === "saving" ? "Creating vendor profile..." : state === "done" ? "Vendor profile created" : "Create Vendor Studio"}
      </button>
    </form>
  )
}
