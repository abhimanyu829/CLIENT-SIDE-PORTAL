"use client"

import type React from "react"
import { useMemo, useState } from "react"

const RESOURCES = [
  "Products",
  "Services",
  "Users",
  "Orders",
  "Payments",
  "Refunds",
  "Analytics",
  "Email Center",
  "Support",
  "Media",
  "Blogs",
  "Marketing",
  "CRM",
  "Documentation",
]

const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "PUBLISH"]
const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "DISABLED", "REVOKED"]
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: true,
  timeZone: "Asia/Kolkata",
})

function formatDateTime(value: string | Date) {
  return DATE_TIME_FORMATTER.format(new Date(value))
}

export default function SubadminManagementClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData)
  const [selectedApplicationId, setSelectedApplicationId] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [message, setMessage] = useState("")

  const selectedApplication = useMemo(
    () => data.applications.find((item: any) => item.id === selectedApplicationId),
    [data.applications, selectedApplicationId]
  )
  const selectedAccount = useMemo(
    () => data.accounts.find((item: any) => item.id === selectedAccountId) ?? data.accounts[0],
    [data.accounts, selectedAccountId]
  )

  async function refresh() {
    const res = await fetch("/api/admin/subadmins")
    if (res.ok) setData(await res.json())
  }

  async function reviewApplication(id: string, status: "APPROVED" | "REJECTED" | "SHORTLISTED") {
    const adminNotes = window.prompt("Admin notes") ?? ""
    const res = await fetch(`/api/admin/subadmins/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNotes }),
    })
    setMessage(res.ok ? `Application ${status.toLowerCase()}.` : "Application review failed.")
    await refresh()
  }

  async function createAccount(formData: FormData) {
    const permissions = RESOURCES.flatMap((resource) =>
      ACTIONS.filter((action) => formData.get(`perm:${resource}:${action}`) === "on").map((action) => ({ resource, action }))
    )
    const payload = {
      applicationId: String(formData.get("applicationId") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      permissions,
    }
    const res = await fetch("/api/admin/subadmins/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const response = await res.json().catch(() => ({}))
    setMessage(res.ok ? `Subadmin created. One-time access token: ${response.accessToken}` : response.error ?? "Subadmin create failed.")
    await refresh()
  }

  async function updateAccount(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/subadmins/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setMessage(res.ok ? "Subadmin account updated." : "Subadmin update failed.")
    await refresh()
  }

  async function savePermissions(formData: FormData) {
    if (!selectedAccount) return
    const permissions = RESOURCES.flatMap((resource) =>
      ACTIONS.filter((action) => formData.get(`matrix:${resource}:${action}`) === "on").map((action) => ({ resource, action }))
    )
    await updateAccount(selectedAccount.id, { permissions })
  }

  async function saveSettings(formData: FormData) {
    const res = await fetch("/api/admin/subadmins/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: formData.get("enabled") === "on",
        applicationsOpen: formData.get("applicationsOpen") === "on",
        portalPath: String(formData.get("portalPath") ?? "/join-our-team"),
      }),
    })
    setMessage(res.ok ? "Portal settings saved." : "Portal settings failed.")
    await refresh()
  }

  async function reviewApproval(id: string, status: "APPROVED" | "REJECTED") {
    const reviewNotes = window.prompt("Review notes") ?? ""
    const res = await fetch(`/api/admin/subadmins/approval-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNotes }),
    })
    setMessage(res.ok ? `Approval request ${status.toLowerCase()}.` : "Approval review failed.")
    await refresh()
  }

  const activeCount = data.accounts.filter((account: any) => account.status === "ACTIVE").length
  const suspendedCount = data.accounts.filter((account: any) => account.status === "SUSPENDED").length
  const pendingCount = data.applications.filter((application: any) => application.status === "PENDING").length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Enterprise IAM</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Subadmin Management</h1>
        <p className="mt-2 text-muted-foreground">Recruitment, credentials, permissions, sessions, approval workflow, and revocation controls.</p>
      </div>

      {message && <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="All Subadmins" value={data.accounts.length} />
        <Metric label="Active" value={activeCount} />
        <Metric label="Suspended" value={suspendedCount} />
        <Metric label="Pending Requests" value={pendingCount} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Portal Settings</h2>
        <form action={saveSettings} className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={data.portalSetting.enabled} /> Portal enabled</label>
          <label className="flex items-center gap-2 text-sm"><input name="applicationsOpen" type="checkbox" defaultChecked={data.portalSetting.applicationsOpen} /> Applications open</label>
          <input name="portalPath" defaultValue={data.portalSetting.portalPath} className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-1" />
          <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save settings</button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Pending Applications">
          <div className="space-y-3">
            {data.applications.map((application: any) => (
              <div key={application.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{application.name}</p>
                    <p className="text-sm text-muted-foreground">{application.email} · {application.country || "No country"}</p>
                    {application.status === "APPROVED" && application.account?.username && (
                      <p className="mt-1 text-sm font-medium text-foreground">Username: {application.account.username}</p>
                    )}
                    <p className="mt-2 text-sm">{application.skills?.join(", ")}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{application.motivation}</p>
                  </div>
                  <Badge>{application.status}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setSelectedApplicationId(application.id)} className="btn-lite">Use for account</button>
                  <button onClick={() => reviewApplication(application.id, "SHORTLISTED")} className="btn-lite">Shortlist</button>
                  <button onClick={() => reviewApplication(application.id, "APPROVED")} className="btn-lite">Approve</button>
                  <button onClick={() => reviewApplication(application.id, "REJECTED")} className="btn-danger">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Create / Reset Subadmin Credentials">
          <form action={createAccount} className="space-y-4">
            <input type="hidden" name="applicationId" value={selectedApplication?.id ?? ""} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="name" label="Name" defaultValue={selectedApplication?.name ?? ""} />
              <Input name="email" label="Email" type="email" defaultValue={selectedApplication?.email ?? ""} />
              <Input name="username" label="Secure Username" />
              <Input name="password" label="Secure Password" type="password" />
            </div>
            <PermissionGrid prefix="perm" />
            <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create credentials</button>
          </form>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="All Subadmins">
          <div className="space-y-3">
            {data.accounts.map((account: any) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${selectedAccount?.id === account.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-sm text-muted-foreground">{account.username} · {account.email}</p>
                  </div>
                  <Badge>{account.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Permission Matrix & Account Controls">
          {selectedAccount ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((status) => (
                  <button key={status} onClick={() => updateAccount(selectedAccount.id, { status })} className="btn-lite">{status}</button>
                ))}
                <button onClick={() => updateAccount(selectedAccount.id, { password: window.prompt("New password") || "" })} className="btn-lite">Reset password</button>
              </div>
              <form action={savePermissions} className="space-y-4">
                <PermissionGrid prefix="matrix" current={selectedAccount.permissions ?? []} />
                <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save permissions</button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a subadmin account.</p>
          )}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Approval Requests">
          <div className="space-y-3">
            {data.approvalRequests.map((request: any) => (
              <div key={request.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{request.title}</p>
                    <p className="text-sm text-muted-foreground">{request.resource} · {request.action} · {request.subadmin?.email}</p>
                  </div>
                  <Badge>{request.status}</Badge>
                </div>
                {request.status === "PENDING_APPROVAL" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => reviewApproval(request.id, "APPROVED")} className="btn-lite">Approve</button>
                    <button onClick={() => reviewApproval(request.id, "REJECTED")} className="btn-danger">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Activity Logs">
          <div className="max-h-[520px] space-y-3 overflow-auto">
            {data.activityLogs.map((log: any) => (
              <div key={log.id} className="rounded-xl border border-border bg-background p-4 text-sm">
                <p className="font-medium">{log.action}</p>
                <p className="text-muted-foreground">{log.actor?.email ?? "System"} · {formatDateTime(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span className="text-sm font-medium">{label}</span>
      <input {...props} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">{children}</span>
}

function PermissionGrid({ prefix, current = [] }: { prefix: string; current?: any[] }) {
  const allowed = new Set(current.map((permission: any) => `${permission.resource}:${permission.action}`))
  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="p-3 text-left">Resource</th>
            {ACTIONS.map((action) => <th key={action} className="p-3 text-center">{action}</th>)}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => (
            <tr key={resource} className="border-t border-border">
              <td className="p-3 font-medium">{resource}</td>
              {ACTIONS.map((action) => (
                <td key={action} className="p-3 text-center">
                  <input name={`${prefix}:${resource}:${action}`} type="checkbox" defaultChecked={allowed.has(`${resource}:${action}`)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
