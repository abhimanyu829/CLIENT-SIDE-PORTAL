"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminAccessClient() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(formData: FormData) {
    setLoading(true)
    setError("")

    const res = await fetch("/api/admin/subadmins/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
      }),
    })
    const data = await res.json().catch(() => ({}))

    setLoading(false)
    if (!res.ok || !data.success) {
      setError(data.error ?? "Admin credentials failed.")
      return
    }

    router.replace(typeof data.redirectUrl === "string" ? data.redirectUrl : "/admin")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      <form action={submit} className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Admin Access</p>
        <h1 className="mt-3 text-3xl font-semibold">Enter admin credentials</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Google login is complete. Enter your unique subadmin username and password to unlock the admin panel.
        </p>

        <label className="mt-6 block">
          <span className="text-sm font-medium">Username</span>
          <input
            name="username"
            required
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <button
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Validating..." : "Unlock admin panel"}
        </button>
      </form>
    </main>
  )
}
