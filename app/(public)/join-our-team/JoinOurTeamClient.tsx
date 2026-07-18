"use client"

import { useState } from "react"

type Status = "idle" | "submitting" | "success" | "error"

export default function JoinOurTeamClient() {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")

  async function submit(formData: FormData) {
    setStatus("submitting")
    setMessage("")

    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      country: String(formData.get("country") ?? ""),
      skills: String(formData.get("skills") ?? ""),
      portfolioUrl: String(formData.get("portfolioUrl") ?? ""),
      githubUrl: String(formData.get("githubUrl") ?? ""),
      linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
      resumeUrl: String(formData.get("resumeUrl") ?? ""),
      motivation: String(formData.get("motivation") ?? ""),
    }

    const res = await fetch("/api/subadmin-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.success) {
      setStatus("error")
      setMessage(data.error ?? "Application could not be submitted.")
      return
    }

    setStatus("success")
    setMessage("Application submitted. A Super Admin will review your request.")
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">NexusAI Workforce</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">Join our admin operations team</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Apply for a subadmin role. Approval does not grant access automatically; every admin account requires Google login plus separate Super Admin-issued credentials.
          </p>
        </div>

        <form action={submit} className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <Field name="name" label="Name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="phone" label="Phone" />
            <Field name="country" label="Country" />
            <Field name="skills" label="Skills" placeholder="Next.js, Prisma, Security, Support" required />
            <Field name="portfolioUrl" label="Portfolio URL" type="url" />
            <Field name="githubUrl" label="GitHub URL" type="url" />
            <Field name="linkedinUrl" label="LinkedIn URL" type="url" />
            <Field name="resumeUrl" label="Resume URL" type="url" className="md:col-span-2" />
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-foreground">Why do you want to join?</span>
              <textarea
                name="motivation"
                required
                minLength={20}
                rows={6}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>

          {message && (
            <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${status === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {status === "submitting" ? "Submitting..." : "Submit application"}
          </button>
        </form>
      </div>
    </main>
  )
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  className,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <label className={className}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  )
}
