"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

type Campaign = {
  id: string
  name: string
  subject: string
  templateName: string
  audienceType: string
  status: string
  createdAt: string
  scheduledAt?: string | null
  sentAt?: string | null
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  unsubscribeCount: number
  createdByAdmin?: { id: string; name: string | null; email: string } | null
  queueItems?: Array<{ id: string; status: string; recipient: string; emailType: string; createdAt: string }>
}

type Props = {
  campaigns: Campaign[]
  stats: { total: number; sending: number; sent: number; draft: number }
}

const audienceOptions = [
  "ALL_USERS",
  "ACTIVE_SUBSCRIBERS",
  "EXPIRED_SUBSCRIBERS",
  "BY_PRODUCT",
  "BY_PLAN",
  "BY_ROLE",
  "INDIVIDUAL",
]

export default function EmailCenterClient({ campaigns: initialCampaigns, stats }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [loading, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [templateName, setTemplateName] = useState("NEWSLETTER_CAMPAIGN")
  const [audienceType, setAudienceType] = useState("ALL_USERS")
  const [payload, setPayload] = useState('{"title":"NexusAI Update","body":"Hello from NexusAI"}')
  const [audienceFilter, setAudienceFilter] = useState('{"roles":["CLIENT"]}')
  const [scheduledAt, setScheduledAt] = useState("")
  const [sendNow, setSendNow] = useState(false)
  const [testRecipient, setTestRecipient] = useState("")
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const counters = useMemo(() => stats, [stats])

  const refreshCampaigns = async () => {
    const res = await fetch("/api/admin/emails")
    const json = await res.json()
    if (json.success) setCampaigns(json.data)
  }

  const handleCreate = async () => {
    setMessage(null)
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          templateName,
          audienceType,
          payload: JSON.parse(payload || "{}"),
          audienceFilter: JSON.parse(audienceFilter || "{}"),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          sendNow,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Failed to create campaign")
      setMessage("Campaign saved")
      setName("")
      setSubject("")
      await refreshCampaigns()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const handlePreview = async () => {
    setPreviewBusy(true)
    try {
      const res = await fetch("/api/admin/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName, payload: JSON.parse(payload || "{}") }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Unable to preview email")
      setPreviewHtml(json.html)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setPreviewBusy(false)
    }
  }

  const handleTest = async () => {
    setMessage(null)
    try {
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: testRecipient,
          templateName,
          subject,
          payload: JSON.parse(payload || "{}"),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Unable to send test email")
      setMessage("Test email queued")
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const handleSendCampaign = async (campaignId: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/emails/${campaignId}/send`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Unable to send campaign")
      setMessage("Campaign queued for delivery")
      await refreshCampaigns()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Campaigns" value={counters.total} />
        <Stat label="Sending" value={counters.sending} />
        <Stat label="Sent" value={counters.sent} />
        <Stat label="Drafts" value={counters.draft} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-black text-white">Create Email Campaign</h2>
          <p className="mt-1 text-sm text-zinc-500">Backend-only audience selection, queue fanout, retries, and audit logs.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="border-white/10 bg-zinc-950" />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="border-white/10 bg-zinc-950" />
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template key" className="border-white/10 bg-zinc-950" />
            <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)} className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
              {audienceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="border-white/10 bg-zinc-950" />
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
              Send immediately
            </label>
          </div>

          <div className="mt-4 grid gap-4">
            <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={6} className="border-white/10 bg-zinc-950 font-mono text-xs" placeholder="Payload JSON" />
            <Textarea value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)} rows={4} className="border-white/10 bg-zinc-950 font-mono text-xs" placeholder="Audience filter JSON" />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleCreate} disabled={loading || !name || !subject} className="bg-violet-600 hover:bg-violet-500">Save Campaign</Button>
            <Button variant="outline" onClick={handlePreview} disabled={previewBusy} className="border-white/10 bg-transparent text-white">Preview</Button>
            <Input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="test@company.com" className="max-w-56 border-white/10 bg-zinc-950" />
            <Button variant="outline" onClick={handleTest} disabled={!testRecipient} className="border-white/10 bg-transparent text-white">Send Test</Button>
          </div>

          {message && <p className="mt-3 text-sm text-amber-300">{message}</p>}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-black text-white">Campaign Preview</h2>
          <p className="mt-1 text-sm text-zinc-500">Rendered HTML from the React Email template registry.</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950 p-3">
            {previewHtml ? (
              <iframe title="Email Preview" srcDoc={previewHtml} className="min-h-[540px] w-full rounded-xl bg-white" />
            ) : (
              <div className="flex min-h-[540px] items-center justify-center text-sm text-zinc-500">
                Click Preview to render the current template.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-black text-white">Recent Campaigns</h2>
        <div className="mt-4 space-y-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{campaign.name}</h3>
                    <Badge variant="outline" className="border-white/10 text-zinc-300">{campaign.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{campaign.subject}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <Metric label="Recipients" value={campaign.totalRecipients} />
                  <Metric label="Opened" value={campaign.openedCount} />
                  <Metric label="Clicked" value={campaign.clickedCount} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                <span>Template: {campaign.templateName}</span>
                <span>Audience: {campaign.audienceType}</span>
                <span>Sent: {campaign.sentCount}</span>
                <span>Bounced: {campaign.bouncedCount}</span>
              </div>

              {campaign.status === "DRAFT" && (
                <div className="mt-3">
                  <Button variant="outline" onClick={() => handleSendCampaign(campaign.id)} className="border-white/10 bg-transparent text-white">
                    Send Campaign
                  </Button>
                </div>
              )}

              <div className="mt-3 text-xs text-zinc-600">
                Created by {campaign.createdByAdmin?.name ?? campaign.createdByAdmin?.email ?? "Admin"} · {new Date(campaign.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <p className="text-sm text-zinc-500">No campaigns yet.</p>}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-zinc-500">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  )
}
