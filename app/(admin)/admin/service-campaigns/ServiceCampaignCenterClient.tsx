"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import {
  Archive, BarChart3, Copy, Eye, Mail, MapPin, Plus, Send, Shield,
  Tag, Target, Trash2, Users, ChevronDown, ChevronUp, Globe,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────
type Service = { id: string; title: string; slug: string; category?: { name: string; slug: string } | null }
type TargetAudience = {
  visitorType: string
  pages: string[]
  roles: string[]
  hasPurchased: boolean | null
  minPurchaseCount: number
  emailDelivery: { enabled: boolean; subject: string; segment: string }
}
type Campaign = {
  id: string; name: string; slug: string; description?: string | null; status: string
  placement: string; priority: number; startsAt?: string | null; endsAt?: string | null
  landingUrl?: string | null; ctaLabel?: string | null; targetAudience?: TargetAudience | Record<string, unknown>; tags: string[]
}
type Collection = { id: string; name: string; slug: string; description?: string | null; placement: string; isActive: boolean; priority: number; items: { servicePageId: string; sortOrder: number }[] }
type TagItem = { id: string; name: string; slug: string; description?: string | null; isFeatured: boolean; assignments: { servicePageId: string }[] }
type Product = { id: string; name: string; slug: string }

const empty = { campaigns: [], collections: [], tags: [], services: [], products: [] } as {
  campaigns: Campaign[]; collections: Collection[]; tags: TagItem[]; services: Service[]; products: Product[]
}

// ── Page options for targeting ──────────────────────────────────────────────────
const PAGE_OPTIONS = [
  { label: "Home (/)", value: "/" },
  { label: "Marketplace (/marketplace)", value: "/marketplace" },
  { label: "Services (/services)", value: "/services" },
  { label: "Pricing (/pricing)", value: "/pricing" },
  { label: "Blog (/blog)", value: "/blog" },
  { label: "About (/about)", value: "/about" },
  { label: "Register (/register)", value: "/register" },
  { label: "Login (/login)", value: "/login" },
  { label: "Dashboard (/dashboard)", value: "/dashboard" },
]

const VISITOR_OPTIONS = [
  { value: "all", label: "All Visitors", icon: "🌐" },
  { value: "guest", label: "Guests only (not logged in)", icon: "👤" },
  { value: "logged_in", label: "Logged-in users", icon: "✅" },
  { value: "paid_customer", label: "Paid customers (has purchases)", icon: "⭐" },
  { value: "free_user", label: "Free users (logged in, no purchases)", icon: "🔓" },
]

const SEGMENT_OPTIONS = [
  { value: "all", label: "All users" },
  { value: "paid", label: "Paid customers" },
  { value: "free", label: "Free / unpaid users" },
  { value: "inactive", label: "Inactive users (30+ days)" },
  { value: "new", label: "New users (< 7 days)" },
]

function serviceIds(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLInputElement>("input[name=serviceIds]:checked")).map((i) => i.value)
}

function getAudienceSummary(ta: TargetAudience | Record<string, unknown> | undefined): string {
  if (!ta) return "All visitors · All pages"
  const audience = ta as TargetAudience
  const vt = VISITOR_OPTIONS.find((o) => o.value === audience.visitorType)
  const pages = Array.isArray(audience.pages) && audience.pages.length > 0
    ? audience.pages.join(", ")
    : "All pages"
  return `${vt?.icon ?? "🌐"} ${vt?.label ?? "All Visitors"} · ${pages}`
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function ServiceCampaignCenterClient() {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [viewingId, setViewingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const response = await fetch("/api/admin/service-discovery")
    const payload = await response.json().catch(() => null)
    if (payload?.success) setData(payload.data)
    else showMsg(payload?.error || "Unable to load discovery controls", "error")
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text); setMessageType(type)
    setTimeout(() => setMessage(null), 4000)
  }

  async function create(entity: "campaign" | "collection" | "tag", event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const payload: Record<string, unknown> = Object.fromEntries(fields.entries())
    payload.priority = Number(payload.priority || 0)

    if (entity === "campaign") {
      payload.tags = String(payload.tags || "").split(",").map((t) => t.trim()).filter(Boolean)
      payload.categorySlugs = String(payload.categorySlugs || "").split(",").map((t) => t.trim()).filter(Boolean)
      payload.relatedServiceIds = serviceIds(form)
      payload.relatedProductIds = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=productIds]:checked")).map((i) => i.value)

      // ── Build targetAudience from the targeting form fields ──────────
      const visitorType = String(payload.visitorType || "all")
      const selectedPages = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=targetPages]:checked")).map((i) => i.value)
      const roles = String(payload.roles || "").split(",").map((r) => r.trim()).filter(Boolean)
      const hasPurchasedRaw = String(payload.hasPurchased || "null")
      const hasPurchased = hasPurchasedRaw === "true" ? true : hasPurchasedRaw === "false" ? false : null
      const minPurchaseCount = Number(payload.minPurchaseCount || 0)
      const emailEnabled = payload.emailEnabled === "true"
      const emailSubject = String(payload.emailSubject || payload.name || "")
      const emailSegment = String(payload.emailSegment || "all")

      payload.targetAudience = {
        visitorType,
        pages: selectedPages,
        roles,
        hasPurchased,
        minPurchaseCount,
        emailDelivery: { enabled: emailEnabled, subject: emailSubject, segment: emailSegment },
      }

      // Clean up individual targeting fields from payload (they're now in targetAudience)
      delete payload.visitorType
      delete payload.roles
      delete payload.hasPurchased
      delete payload.minPurchaseCount
      delete payload.emailEnabled
      delete payload.emailSubject
      delete payload.emailSegment

      if (typeof payload.startsAt === "string" && payload.startsAt) payload.startsAt = new Date(payload.startsAt).toISOString()
      if (typeof payload.endsAt === "string" && payload.endsAt) payload.endsAt = new Date(payload.endsAt).toISOString()
    } else {
      payload.serviceIds = serviceIds(form)
    }

    const response = await fetch("/api/admin/service-discovery", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, data: payload }),
    })
    const result = await response.json().catch(() => null)
    if (!result?.success) { showMsg(result?.error || `Unable to create ${entity}`, "error"); return }
    form.reset()
    showMsg(`${entity[0].toUpperCase()}${entity.slice(1)} created successfully`)
    await load()
  }

  async function action(entity: "campaign" | "collection" | "tag", id: string, act: "delete" | "clone" | "deliver" | "toggle") {
    const endpoint = `/api/admin/service-discovery/${id}${act === "delete" ? `?entity=${entity}` : ""}`
    const response = await fetch(endpoint,
      act === "delete"
        ? { method: "DELETE" }
        : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(act === "toggle" ? { entity, data: { isActive: false } } : { entity, action: act }) }
    )
    const result = await response.json().catch(() => null)
    showMsg(result?.success
      ? (act === "deliver" ? `Campaign queued for ${result.data?.recipientCount ?? 0} matching users` : "Saved")
      : (result?.error || "Action failed"),
      result?.success ? "success" : "error"
    )
    if (result?.success) await load()
  }

  async function setCampaignStatus(id: string, status: string) {
    const response = await fetch(`/api/admin/service-discovery/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "campaign", data: { status } }),
    })
    const result = await response.json().catch(() => null)
    showMsg(result?.success ? `Campaign ${status.toLowerCase()}` : (result?.error || "Status update failed"),
      result?.success ? "success" : "error")
    if (result?.success) await load()
  }

  const viewingCampaign = viewingId ? data.campaigns.find((c) => c.id === viewingId) : null

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Service discovery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Service Campaign Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Control service promotions with audience targeting — show the right campaign to the right visitor on the right page. Backed by Resend email delivery.
          </p>
        </div>
        <Link href="/admin/service-campaigns/analytics" className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted">
          <BarChart3 className="mr-2 h-4 w-4" />Analytics
        </Link>
      </div>

      {/* Notification toast */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm transition-all ${messageType === "error" ? "border-red-300/40 bg-red-50 text-red-900" : "border-amber-700/20 bg-amber-50 text-amber-950"}`}>
          {messageType === "error" ? "⚠️ " : "✅ "}{message}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Campaigns" value={data.campaigns.length} icon={<Mail className="h-4 w-4 text-amber-700" />} />
        <Metric label="Collections" value={data.collections.length} icon={<Archive className="h-4 w-4 text-amber-700" />} />
        <Metric label="Featured tags" value={data.tags.filter((t) => t.isFeatured).length} icon={<Tag className="h-4 w-4 text-amber-700" />} />
        <Metric label="Active now" value={data.campaigns.filter((c) => c.status === "ACTIVE").length} icon={<Globe className="h-4 w-4 text-green-600" />} />
      </div>

      {/* Create panels */}
      <section className="grid gap-6 xl:grid-cols-3">
        {/* Campaign create form */}
        <CampaignCreatePanel
          services={data.services}
          products={data.products}
          onSubmit={(e) => create("campaign", e)}
        />
        {/* Collection create form */}
        <CreatePanel title="New collection" onSubmit={(e) => create("collection", e)} services={data.services}>
          <input name="name" required placeholder="Collection name" className="input" />
          <textarea name="description" placeholder="Collection description" className="input min-h-20" />
          <input name="priority" defaultValue="0" type="number" className="input" placeholder="Priority" />
        </CreatePanel>
        {/* Tag create form */}
        <CreatePanel title="New service tag" onSubmit={(e) => create("tag", e)} services={data.services}>
          <input name="name" required placeholder="Tag name" className="input" />
          <input name="description" placeholder="Optional description" className="input" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input name="isFeatured" value="true" type="checkbox" /> Feature this tag in discovery
          </label>
        </CreatePanel>
      </section>

      {/* Campaigns table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-800" />
          <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
          <span className="ml-auto text-xs text-muted-foreground">Click 👁 to preview targeting rules</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">
                  <span className="flex items-center gap-1"><Target className="h-3 w-3" />Audience Targeting</span>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.campaigns.map((campaign) => (
                <>
                  <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">{campaign.slug}</p>
                      {campaign.landingUrl && (
                        <p className="text-xs text-amber-700 mt-0.5 font-mono">{campaign.landingUrl}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-1.5">
                        <Target className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {getAudienceSummary(campaign.targetAudience)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        aria-label={`Status for ${campaign.name}`}
                        value={campaign.status}
                        onChange={(e) => setCampaignStatus(campaign.id, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                      >
                        <option>DRAFT</option>
                        <option>SCHEDULED</option>
                        <option>ACTIVE</option>
                        <option>PAUSED</option>
                        <option>ARCHIVED</option>
                        <option>COMPLETED</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground font-mono text-xs">{campaign.priority}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setViewingId(viewingId === campaign.id ? null : campaign.id)} className="btn-secondary" title="View targeting">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => action("campaign", campaign.id, "deliver")} className="btn-secondary">
                          <Send className="h-3.5 w-3.5" />Deliver
                        </button>
                        <button onClick={() => action("campaign", campaign.id, "clone")} className="btn-secondary">
                          <Copy className="h-3.5 w-3.5" />Clone
                        </button>
                        <button onClick={() => action("campaign", campaign.id, "delete")} className="btn-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Targeting detail panel */}
                  {viewingId === campaign.id && (
                    <tr key={`${campaign.id}-detail`}>
                      <td colSpan={5} className="bg-amber-50/50 border-amber-200/40 border-y px-4 py-4">
                        <AudienceDetailPanel campaign={campaign} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!loading && data.campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Create your first service campaign to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Collections & Tags */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ListPanel
          title="Active collections"
          icon={<Archive className="h-5 w-5 text-amber-800" />}
          items={data.collections.map((c) => ({ id: c.id, name: c.name, details: `${c.items.length} services · ${c.isActive ? "visible" : "hidden"}` }))}
          onDelete={(id) => action("collection", id, "delete")}
        />
        <ListPanel
          title="Service tagging"
          icon={<Tag className="h-5 w-5 text-amber-800" />}
          items={data.tags.map((t) => ({ id: t.id, name: t.name, details: `${t.assignments.length} services${t.isFeatured ? " · featured" : ""}` }))}
          onDelete={(id) => action("tag", id, "delete")}
        />
      </section>

      <style jsx>{`
        .input{width:100%;border:1px solid hsl(var(--border));border-radius:.75rem;background:hsl(var(--background));padding:.65rem .75rem;font-size:.875rem;color:hsl(var(--foreground))}
        .input:focus{outline:2px solid rgba(161,98,7,.35);outline-offset:1px}
        .btn-secondary{display:inline-flex;align-items:center;gap:.35rem;border:1px solid hsl(var(--border));border-radius:.5rem;padding:.4rem .55rem;font-size:.75rem;font-weight:600;color:hsl(var(--foreground))}
        .btn-secondary:hover{background:hsl(var(--muted))}
        .btn-danger{display:inline-flex;align-items:center;border:1px solid rgba(220,38,38,.25);border-radius:.5rem;padding:.4rem;color:#b91c1c}
        .btn-danger:hover{background:#fef2f2}
        .checkbox-label{display:flex;align-items:center;gap:.5rem;font-size:.8rem;color:hsl(var(--muted-foreground));cursor:pointer}
        .checkbox-label:hover{color:hsl(var(--foreground))}
      `}</style>
    </div>
  )
}

// ── Campaign Create Panel (with full targeting) ─────────────────────────────────
function CampaignCreatePanel({ services, products, onSubmit }: {
  services: Service[]; products: Product[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  const [showTargeting, setShowTargeting] = useState(false)
  const [showEmailDelivery, setShowEmailDelivery] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [selectedPages, setSelectedPages] = useState<string[]>([])

  function togglePage(value: string) {
    setSelectedPages((prev) => prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value])
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-amber-700" />
        <h2 className="font-bold text-foreground">New service campaign</h2>
      </div>

      {/* Basic fields */}
      <input name="name" required placeholder="Campaign name" className="input" />
      <textarea name="description" placeholder="What should visitors see? (shown in banner)" className="input min-h-16" />
      <div className="grid grid-cols-2 gap-3">
        <select name="status" className="input">
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="ACTIVE">Active</option>
        </select>
        <input name="priority" defaultValue="0" type="number" className="input" placeholder="Priority" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">Start<input name="startsAt" type="datetime-local" className="input mt-1" /></label>
        <label className="text-xs text-muted-foreground">End<input name="endsAt" type="datetime-local" className="input mt-1" /></label>
      </div>
      <input name="landingUrl" className="input" placeholder="Landing URL, e.g. /services" />
      <input name="ctaLabel" className="input" placeholder="CTA label, e.g. Explore Now" />
      <input name="bannerUrl" className="input" placeholder="Banner image URL (optional)" />
      <input name="backgroundUrl" className="input" placeholder="Background image URL (optional)" />
      <input name="videoUrl" className="input" placeholder="Video URL (optional)" />
      <input name="categorySlugs" className="input" placeholder="Category slugs, comma-separated" />
      <input name="tags" className="input" placeholder="Campaign tags, comma-separated" />

      {/* ── AUDIENCE & TARGETING panel ─────────────────────────────────── */}
      <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTargeting((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Audience &amp; Targeting
          </span>
          {showTargeting ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showTargeting && (
          <div className="px-4 pb-4 space-y-4 border-t border-amber-200/40">
            {/* Visitor type */}
            <div className="space-y-1.5 pt-3">
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />Who should see this campaign?
              </label>
              <select name="visitorType" defaultValue="all" className="input">
                {VISITOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                ))}
              </select>
            </div>

            {/* Page targeting */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />Which pages should show this banner?
              </label>
              <p className="text-[11px] text-amber-700">Leave all unchecked to show on every page.</p>
              <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {PAGE_OPTIONS.map((page) => (
                  <label key={page.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      name="targetPages"
                      value={page.value}
                      checked={selectedPages.includes(page.value)}
                      onChange={() => togglePage(page.value)}
                    />
                    <span className="font-mono text-[11px]">{page.value}</span>
                    <span className="text-[11px] text-muted-foreground">{page.label.split("(")[0].trim()}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Advanced targeting */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-900">Has purchased?</label>
                <select name="hasPurchased" defaultValue="null" className="input text-xs">
                  <option value="null">Any</option>
                  <option value="true">Yes — has purchased</option>
                  <option value="false">No — never purchased</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-900">Min. purchase count</label>
                <input name="minPurchaseCount" type="number" defaultValue="0" min="0" className="input text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />Target roles (optional)
              </label>
              <input name="roles" className="input text-xs" placeholder="e.g. USER, SELLER — comma-separated" />
            </div>

            {/* Email delivery */}
            <div className="rounded-lg border border-amber-200/50 bg-white/60 p-3 space-y-3">
              <button
                type="button"
                onClick={() => setShowEmailDelivery((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-semibold text-amber-900"
              >
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email Delivery Settings</span>
                {showEmailDelivery ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showEmailDelivery && (
                <div className="space-y-3 border-t border-amber-100 pt-3">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="emailEnabled"
                      value="true"
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                    />
                    Enable email delivery for this campaign
                  </label>
                  {emailEnabled && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-amber-900 font-medium">Email subject line</label>
                        <input name="emailSubject" className="input text-xs" placeholder="Subject for campaign emails" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-amber-900 font-medium">Send to segment</label>
                        <select name="emailSegment" defaultValue="all" className="input text-xs">
                          {SEGMENT_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Services */}
      <details className="rounded-lg bg-muted/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Attach services</summary>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {services.map((s) => (
            <label key={s.id} className="flex gap-2 text-xs text-muted-foreground">
              <input name="serviceIds" type="checkbox" value={s.id} />{s.title}
            </label>
          ))}
        </div>
      </details>

      {/* Products */}
      <details className="rounded-lg bg-muted/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Relate marketplace products</summary>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {products.map((p) => (
            <label key={p.id} className="flex gap-2 text-xs text-muted-foreground">
              <input name="productIds" type="checkbox" value={p.id} />{p.name}
            </label>
          ))}
        </div>
      </details>

      <button type="submit" className="inline-flex items-center rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900">
        <Plus className="mr-1.5 h-4 w-4" />Create Campaign
      </button>
    </form>
  )
}

// ── Audience detail read-only view ─────────────────────────────────────────────
function AudienceDetailPanel({ campaign }: { campaign: Campaign }) {
  const ta = (campaign.targetAudience ?? {}) as TargetAudience
  const vt = VISITOR_OPTIONS.find((o) => o.value === (ta.visitorType ?? "all"))
  const pages: string[] = Array.isArray(ta.pages) ? ta.pages : []
  const roles: string[] = Array.isArray(ta.roles) ? ta.roles : []
  const email = ta.emailDelivery

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1.5 flex items-center gap-1">
          <Users className="h-3 w-3" />Audience
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200/60 px-2.5 py-1 text-xs font-medium text-amber-900">
          {vt?.icon} {vt?.label ?? "All Visitors"}
        </span>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1.5 flex items-center gap-1">
          <MapPin className="h-3 w-3" />Pages
        </p>
        {pages.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">All pages</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {pages.map((p) => (
              <span key={p} className="rounded bg-muted border border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground">{p}</span>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1.5 flex items-center gap-1">
          <Shield className="h-3 w-3" />Rules
        </p>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {ta.hasPurchased === true && <p>✅ Must have purchased</p>}
          {ta.hasPurchased === false && <p>🚫 Must NOT have purchased</p>}
          {(ta.minPurchaseCount ?? 0) > 0 && <p>🛒 Min {ta.minPurchaseCount} orders</p>}
          {roles.length > 0 && <p>🎭 Roles: {roles.join(", ")}</p>}
          {ta.hasPurchased === null && (ta.minPurchaseCount ?? 0) === 0 && roles.length === 0 && (
            <p className="italic">No restrictions</p>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1.5 flex items-center gap-1">
          <Mail className="h-3 w-3" />Email Delivery
        </p>
        {email?.enabled ? (
          <div className="space-y-0.5 text-xs">
            <p className="text-green-700 font-medium">✅ Enabled</p>
            <p className="text-muted-foreground">Segment: <strong>{email.segment}</strong></p>
            {email.subject && <p className="text-muted-foreground truncate" title={email.subject}>Subject: {email.subject}</p>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not configured</span>
        )}
      </div>
    </div>
  )
}

// ── Generic create panel ───────────────────────────────────────────────────────
function CreatePanel({ title, children, services, onSubmit }: {
  title: string; children: React.ReactNode; services: Service[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-bold text-foreground">{title}</h2>
      {children}
      <details className="rounded-lg bg-muted/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Attach services</summary>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {services.map((s) => (
            <label key={s.id} className="flex gap-2 text-xs text-muted-foreground">
              <input name="serviceIds" type="checkbox" value={s.id} />{s.title}
            </label>
          ))}
        </div>
      </details>
      <button type="submit" className="inline-flex items-center rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900">
        <Plus className="mr-1.5 h-4 w-4" />Create
      </button>
    </form>
  )
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-start gap-3">
      <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function ListPanel({ title, icon, items, onDelete }: {
  title: string; icon: React.ReactNode; items: { id: string; name: string; details: string }[]; onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">{icon}<h2 className="font-bold text-foreground">{title}</h2></div>
      <div className="mt-4 divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.details}</p>
            </div>
            <button onClick={() => onDelete(item.id)} className="btn-danger"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="py-5 text-sm text-muted-foreground">Nothing configured yet.</p>}
      </div>
    </div>
  )
}
