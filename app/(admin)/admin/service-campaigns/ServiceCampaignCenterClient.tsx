"use client"

import { FormEvent, useEffect, useState, useRef, ChangeEvent, Fragment } from "react"
import Link from "next/link"
import {
  Archive, BarChart3, Copy, Eye, Mail, MapPin, Plus, Send, Shield,
  Tag, Target, Trash2, Users, ChevronDown, ChevronUp, Globe,
  Image as ImageIcon, Video, Sparkles, ExternalLink, Play, Film, Layers, Pencil, X
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
  bannerUrl?: string | null; backgroundUrl?: string | null; videoUrl?: string | null
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
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

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

    const editingId = String(payload.editingId || "")
    delete payload.editingId

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

      // Poster Customization & Overlays
      const posterType = String(payload.posterType || "hero_card")
      const badgeText = String(payload.badgeText || "")
      const badgeColor = String(payload.badgeColor || "amber")
      const buttonStyle = String(payload.buttonStyle || "gradient_gold")
      const buttonPosition = String(payload.buttonPosition || "bottom-right")
      const secondaryLabel = String(payload.secondaryLabel || "")
      const secondaryUrl = String(payload.secondaryUrl || "")
      const videoMode = String(payload.videoMode || "embedded")
      const videoAutoplay = payload.videoAutoplay === "true"
      const videoLoop = payload.videoLoop === "true"

      payload.targetAudience = {
        visitorType,
        pages: selectedPages,
        roles,
        hasPurchased,
        minPurchaseCount,
        emailDelivery: { enabled: emailEnabled, subject: emailSubject, segment: emailSegment },
        posterConfig: {
          posterType, badgeText, badgeColor, buttonStyle, buttonPosition,
          secondaryLabel, secondaryUrl, videoMode, videoAutoplay, videoLoop
        }
      }

      delete payload.visitorType
      delete payload.roles
      delete payload.hasPurchased
      delete payload.minPurchaseCount
      delete payload.emailEnabled
      delete payload.emailSubject
      delete payload.emailSegment
      delete payload.posterType
      delete payload.badgeText
      delete payload.badgeColor
      delete payload.buttonStyle
      delete payload.buttonPosition
      delete payload.secondaryLabel
      delete payload.secondaryUrl
      delete payload.videoMode
      delete payload.videoAutoplay
      delete payload.videoLoop

      // Convert or remove date strings so Zod .datetime().optional() doesn't reject empty ""
      if (typeof payload.startsAt === "string" && payload.startsAt) {
        payload.startsAt = new Date(payload.startsAt).toISOString()
      } else {
        delete payload.startsAt
      }
      if (typeof payload.endsAt === "string" && payload.endsAt) {
        payload.endsAt = new Date(payload.endsAt).toISOString()
      } else {
        delete payload.endsAt
      }
    } else {
      payload.serviceIds = serviceIds(form)
    }

    const method = editingId ? "PUT" : "POST"
    const response = await fetch("/api/admin/service-discovery", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, id: editingId || undefined, data: payload }),
    })
    const result = await response.json().catch(() => null)
    if (!result?.success) { showMsg(result?.error || `Unable to ${editingId ? "update" : "create"} ${entity}`, "error"); return }
    form.reset()
    setEditingCampaign(null)
    showMsg(`${entity[0].toUpperCase()}${entity.slice(1)} ${editingId ? "updated" : "created"} successfully`)
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
    <div className="mx-auto max-w-7xl space-y-10 pb-20 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Service discovery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Service Campaign Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Control service promotions with audience targeting, rich media (images &amp; videos), and targeted delivery.
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Campaigns" value={data.campaigns.length} icon={<Mail className="h-4 w-4 text-amber-700" />} />
        <Metric label="Collections" value={data.collections.length} icon={<Archive className="h-4 w-4 text-amber-700" />} />
        <Metric label="Featured tags" value={data.tags.filter((t) => t.isFeatured).length} icon={<Tag className="h-4 w-4 text-amber-700" />} />
        <Metric label="Active now" value={data.campaigns.filter((c) => c.status === "ACTIVE").length} icon={<Globe className="h-4 w-4 text-green-600" />} />
      </div>

      {/* ── Centered Campaign Create / Edit Panel ─────────────────────────── */}
      <section className="mx-auto max-w-4xl" id="campaign-create-panel">
        <CampaignCreatePanel
          services={data.services}
          products={data.products}
          editingCampaign={editingCampaign}
          onCancelEdit={() => setEditingCampaign(null)}
          onSubmit={(e) => create("campaign", e)}
        />
      </section>

      {/* ── Collections & Tags Create Section ──────────────────────────────── */}
      <section className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        <CreatePanel title="New collection" onSubmit={(e) => create("collection", e)} services={data.services}>
          <div className="space-y-3">
            <div>
              <label className="label">Collection name</label>
              <input name="name" required placeholder="Collection name" className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" placeholder="Collection description" className="input min-h-20" />
            </div>
            <div>
              <label className="label">Priority</label>
              <input name="priority" defaultValue="0" type="number" className="input" placeholder="Priority" />
            </div>
          </div>
        </CreatePanel>

        <CreatePanel title="New service tag" onSubmit={(e) => create("tag", e)} services={data.services}>
          <div className="space-y-3">
            <div>
              <label className="label">Tag name</label>
              <input name="name" required placeholder="Tag name" className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <input name="description" placeholder="Optional description" className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground pt-1 cursor-pointer">
              <input name="isFeatured" value="true" type="checkbox" className="h-4 w-4 rounded border-border text-amber-800 focus:ring-amber-800" /> Feature this tag in discovery
            </label>
          </div>
        </CreatePanel>
      </section>

      {/* Campaigns table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-800" />
          <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
          <span className="ml-auto text-xs text-muted-foreground">Click 👁 to preview assets &amp; rules</span>
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
                <Fragment key={campaign.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">{campaign.slug}</p>
                      {campaign.landingUrl && (
                        <p className="text-xs text-amber-700 mt-0.5 font-mono">{campaign.landingUrl}</p>
                      )}
                      {(campaign.bannerUrl || campaign.videoUrl) && (
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-800">
                          {campaign.bannerUrl && <span className="flex items-center gap-0.5"><ImageIcon className="h-3 w-3" /> Image</span>}
                          {campaign.videoUrl && <span className="flex items-center gap-0.5"><Video className="h-3 w-3" /> Video</span>}
                        </div>
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
                        <button onClick={() => setViewingId(viewingId === campaign.id ? null : campaign.id)} className="btn-secondary" title="View details & media">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingCampaign(campaign)
                            const el = document.getElementById("campaign-create-panel")
                            if (el) el.scrollIntoView({ behavior: "smooth" })
                          }}
                          className="btn-secondary text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100"
                          title="Edit campaign details & settings"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
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
                  {/* Targeting & Media detail panel */}
                  {viewingId === campaign.id && (
                    <tr key={`${campaign.id}-detail`}>
                      <td colSpan={5} className="bg-amber-50/50 border-amber-200/40 border-y px-4 py-4">
                        <AudienceDetailPanel campaign={campaign} />
                      </td>
                    </tr>
                  )}
                </Fragment>
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

      {/* Collections & Tags List */}
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

      <style jsx global>{`
        .label { display: block; font-size: 0.75rem; font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 0.25rem; }
        .input { width: 100%; border: 1px solid hsl(var(--border)); border-radius: 0.75rem; background: hsl(var(--background)); padding: 0.65rem 0.75rem; font-size: 0.875rem; color: hsl(var(--foreground)); transition: all 0.15s ease; }
        .input:focus { outline: 2px solid rgba(161, 98, 7, 0.35); outline-offset: 1px; }
        .btn-secondary { display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid hsl(var(--border)); border-radius: 0.5rem; padding: 0.4rem 0.6rem; font-size: 0.75rem; font-weight: 600; color: hsl(var(--foreground)); background: hsl(var(--card)); cursor: pointer; }
        .btn-secondary:hover { background: hsl(var(--muted)); }
        .btn-danger { display: inline-flex; align-items: center; border: 1px solid rgba(220, 38, 38, 0.25); border-radius: 0.5rem; padding: 0.4rem; color: #b91c1c; background: hsl(var(--card)); cursor: pointer; }
        .btn-danger:hover { background: #fef2f2; }
        .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: hsl(var(--muted-foreground)); cursor: pointer; }
        .checkbox-label:hover { color: hsl(var(--foreground)); }
      `}</style>
    </div>
  )
}

function AutoPlayingVideo({ src, loop = true, className = "" }: { src: string; loop?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
    video.playsInline = true
    const promise = video.play()
    if (promise !== undefined) {
      promise
        .then(() => setIsPlaying(true))
        .catch(() => {
          video.muted = true
          setIsMuted(true)
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        })
    }
  }, [src, isMuted])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  return (
    <div className="relative group w-full h-full overflow-hidden bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop={loop}
        muted={isMuted}
        playsInline
        controls
        className={className || "h-full w-full object-cover"}
      />
      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-semibold border border-white/20">
        <button type="button" onClick={togglePlay} className="hover:text-amber-300 transition-colors">
          {isPlaying ? "⏸ Pause" : "▶️ Play"}
        </button>
        <span className="text-zinc-500">|</span>
        <button type="button" onClick={toggleMute} className="hover:text-amber-300 transition-colors">
          {isMuted ? "🔇 Muted" : "🔊 Sound On"}
        </button>
      </div>
    </div>
  )
}

// ── Campaign Create / Edit Panel (with Direct PC Upload & Live Poster Customizer) ─────
function CampaignCreatePanel({ services, products, editingCampaign, onCancelEdit, onSubmit }: {
  services: Service[]; products: Product[]; editingCampaign: Campaign | null; onCancelEdit: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  const [showTargeting, setShowTargeting] = useState(false)
  const [showEmailDelivery, setShowEmailDelivery] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [selectedPages, setSelectedPages] = useState<string[]>([])

  // Live preview state for media URLs & fields
  const [bannerUrl, setBannerUrl] = useState("")
  const [backgroundUrl, setBackgroundUrl] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")

  // Poster Customization & Overlay States
  const [posterType, setPosterType] = useState<"hero_card" | "glass_overlay" | "split_media" | "poster_hotspot">("hero_card")
  const [badgeText, setBadgeText] = useState("🔥 SPECIAL OFFER")
  const [badgeColor, setBadgeColor] = useState<"amber" | "emerald" | "crimson" | "violet" | "gold" | "cyan">("amber")
  const [buttonStyle, setButtonStyle] = useState<"gradient_gold" | "neon_cyber" | "glass" | "dark_bold" | "emerald_active">("gradient_gold")
  const [buttonPosition, setButtonPosition] = useState<"bottom-right" | "bottom-left" | "center" | "top-right">("bottom-right")
  const [secondaryLabel, setSecondaryLabel] = useState("View Details")
  const [secondaryUrl, setSecondaryUrl] = useState("/services")
  const [videoMode, setVideoMode] = useState<"embedded" | "pip" | "background">("embedded")
  const [videoAutoplay, setVideoAutoplay] = useState(false)
  const [videoLoop, setVideoLoop] = useState(true)

  // Hydrate form when editing an existing campaign
  useEffect(() => {
    if (editingCampaign) {
      setName(editingCampaign.name || "")
      setDescription(editingCampaign.description || "")
      setCtaLabel(editingCampaign.ctaLabel || "")
      setBannerUrl(editingCampaign.bannerUrl || "")
      setBackgroundUrl(editingCampaign.backgroundUrl || "")
      setVideoUrl(editingCampaign.videoUrl || "")

      const ta = (editingCampaign.targetAudience ?? {}) as Record<string, any>
      const pc = (ta.posterConfig ?? {}) as Record<string, any>

      setPosterType(pc.posterType || "hero_card")
      setBadgeText(pc.badgeText ?? "🔥 SPECIAL OFFER")
      setBadgeColor(pc.badgeColor || "amber")
      setButtonStyle(pc.buttonStyle || "gradient_gold")
      setButtonPosition(pc.buttonPosition || "bottom-right")
      setSecondaryLabel(pc.secondaryLabel || "")
      setSecondaryUrl(pc.secondaryUrl || "")
      setVideoMode(pc.videoMode || "embedded")
      setVideoAutoplay(!!pc.videoAutoplay)
      setVideoLoop(pc.videoLoop ?? true)

      if (Array.isArray(ta.pages) && ta.pages.length > 0) {
        setSelectedPages(ta.pages)
        setShowTargeting(true)
      }
      if (ta.emailDelivery?.enabled) {
        setEmailEnabled(true)
        setShowEmailDelivery(true)
      }
    } else {
      setName("")
      setDescription("")
      setCtaLabel("")
      setBannerUrl("")
      setBackgroundUrl("")
      setVideoUrl("")
      setSelectedPages([])
      setEmailEnabled(false)
    }
  }, [editingCampaign])

  // Direct PC File Input Refs
  const bannerFileRef = useRef<HTMLInputElement>(null)
  const bgFileRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>, target: "banner" | "background" | "video") {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB max for local upload
    if (file.size > MAX_SIZE) {
      alert(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 50MB limit. Please choose a smaller file or provide a video URL link.`)
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (target === "banner") setBannerUrl(dataUrl)
      if (target === "background") setBackgroundUrl(dataUrl)
      if (target === "video") setVideoUrl(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function togglePage(value: string) {
    setSelectedPages((prev) => prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value])
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-amber-800/20 bg-card p-6 sm:p-8 shadow-md space-y-6">
      {/* Hidden editingId to trigger PUT update */}
      <input type="hidden" name="editingId" value={editingCampaign?.id || ""} />

      {/* Hidden File Inputs for PC Upload */}
      <input type="file" ref={bannerFileRef} accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "banner")} />
      <input type="file" ref={bgFileRef} accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "background")} />
      <input type="file" ref={videoFileRef} accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, "video")} />

      {/* Hidden inputs to pass poster config via FormData */}
      <input type="hidden" name="posterType" value={posterType} />
      <input type="hidden" name="badgeText" value={badgeText} />
      <input type="hidden" name="badgeColor" value={badgeColor} />
      <input type="hidden" name="buttonStyle" value={buttonStyle} />
      <input type="hidden" name="buttonPosition" value={buttonPosition} />
      <input type="hidden" name="secondaryLabel" value={secondaryLabel} />
      <input type="hidden" name="secondaryUrl" value={secondaryUrl} />
      <input type="hidden" name="videoMode" value={videoMode} />
      <input type="hidden" name="videoAutoplay" value={videoAutoplay ? "true" : "false"} />
      <input type="hidden" name="videoLoop" value={videoLoop ? "true" : "false"} />

      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {editingCampaign ? `Edit Campaign: ${editingCampaign.name}` : "New Service Campaign & Poster Studio"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {editingCampaign ? "Update campaign poster details, media files, and active link settings" : "Upload posters/videos from PC, customize live active buttons, badges & overlay links"}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${editingCampaign ? "bg-amber-800 text-white" : "bg-amber-100 text-amber-900"}`}>
          {editingCampaign ? "Editing Mode" : "Poster Studio"}
        </span>
      </div>

      {/* ── Basic Info Section ────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> 1. Campaign Details
        </h3>
        <div>
          <label className="label">Campaign Name *</label>
          <input
            name="name"
            required
            placeholder="e.g. Summer AI Service Sale 2026"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Description / Subtitle (shown on poster banner)</label>
          <textarea
            name="description"
            placeholder="What should visitors see? (e.g. Get 20% off all custom web development services this week)"
            className="input min-h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Campaign Status</label>
            <select name="status" className="input" defaultValue="ACTIVE">
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ACTIVE">Active (Live)</option>
            </select>
          </div>
          <div>
            <label className="label">Display Priority (higher = shown first)</label>
            <input name="priority" defaultValue="10" type="number" className="input" placeholder="e.g. 10" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date &amp; Time (optional)</label>
            <input name="startsAt" type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">End Date &amp; Time (optional)</label>
            <input name="endsAt" type="datetime-local" className="input" />
          </div>
        </div>
      </div>

      {/* ── Destination & CTA Section ──────────────────────────────────── */}
      <div className="space-y-4 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" /> 2. Destination &amp; Active Link Buttons
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Primary Landing Link URL</label>
            <input name="landingUrl" className="input" placeholder="e.g. /services or /marketplace" />
          </div>
          <div>
            <label className="label">Primary CTA Button Label</label>
            <input
              name="ctaLabel"
              className="input"
              placeholder="e.g. Explore Offer Now"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Secondary Action Link URL (optional)</label>
            <input
              name="secondaryUrl"
              className="input"
              placeholder="e.g. /pricing or /blog"
              value={secondaryUrl}
              onChange={(e) => setSecondaryUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Secondary Link Label</label>
            <input
              name="secondaryLabel"
              className="input"
              placeholder="e.g. View Pricing"
              value={secondaryLabel}
              onChange={(e) => setSecondaryLabel(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Simple Media Upload: Poster Image + Video ─────────────────── */}
      <div className="space-y-4 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" /> 3. Campaign Media
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Poster / Image File */}
          <div className="space-y-2">
            <label className="label flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-amber-700" /> Poster Image
            </label>
            <button
              type="button"
              onClick={() => bannerFileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/60 py-6 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
            >
              <span className="text-3xl">🖼️</span>
              <span>Choose Poster Image from PC</span>
              <span className="text-[11px] font-normal text-amber-700">JPG, PNG, GIF, WebP, or PDF — up to 50MB</span>
            </button>
            {bannerUrl && (
              <div className="relative rounded-xl overflow-hidden border border-amber-200 bg-black aspect-video">
                <img src={bannerUrl} alt="Poster preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setBannerUrl("")}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2.5 py-1 rounded-full"
                >✕ Remove</button>
              </div>
            )}
            <input type="hidden" name="bannerUrl" value={bannerUrl} />
            <input type="hidden" name="backgroundUrl" value={backgroundUrl} />
          </div>

          {/* Video File */}
          <div className="space-y-2">
            <label className="label flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-amber-700" /> Campaign Video (optional)
            </label>
            <button
              type="button"
              onClick={() => videoFileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/60 py-6 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
            >
              <span className="text-3xl">🎬</span>
              <span>Choose Video from PC</span>
              <span className="text-[11px] font-normal text-amber-700">MP4, WebM, MOV — up to 50MB</span>
            </button>
            {videoUrl && (
              <div className="relative rounded-xl overflow-hidden border border-amber-200 bg-black aspect-video">
                <AutoPlayingVideo src={videoUrl} loop={videoLoop} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setVideoUrl("")}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2.5 py-1 rounded-full z-30"
                >✕ Remove</button>
              </div>
            )}
            <input type="hidden" name="videoUrl" value={videoUrl} />
          </div>
        </div>
      </div>

      {/* NOTE: poster config hidden inputs are already declared at top of form (lines above) — do NOT duplicate them here */}

      {/* ── Audience & Targeting Collapsible ─────────────────────────────── */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTargeting((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-amber-900 hover:bg-amber-100/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Audience &amp; Page Targeting Rules
          </span>
          {showTargeting ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showTargeting && (
          <div className="px-5 pb-5 space-y-4 border-t border-amber-200/60 pt-4">
            <div>
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-1.5">
                <Users className="h-3.5 w-3.5" />Who should see this campaign?
              </label>
              <select name="visitorType" defaultValue="all" className="input">
                {VISITOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5" />Which pages should show this banner?
              </label>
              <p className="text-[11px] text-amber-700 mb-2">Leave all unchecked to show on every page automatically.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {PAGE_OPTIONS.map((page) => (
                  <label key={page.value} className="checkbox-label p-1.5 rounded-lg hover:bg-amber-100/60">
                    <input
                      type="checkbox"
                      name="targetPages"
                      value={page.value}
                      checked={selectedPages.includes(page.value)}
                      onChange={() => togglePage(page.value)}
                      className="h-4 w-4 rounded border-border text-amber-800 focus:ring-amber-800"
                    />
                    <span className="font-mono text-xs">{page.value}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-amber-900">Has purchased?</label>
                <select name="hasPurchased" defaultValue="null" className="input text-xs">
                  <option value="null">Any</option>
                  <option value="true">Yes — has purchased</option>
                  <option value="false">No — never purchased</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-amber-900">Min. purchase count</label>
                <input name="minPurchaseCount" type="number" defaultValue="0" min="0" className="input text-xs" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-1">
                <Shield className="h-3.5 w-3.5" />Target roles (optional)
              </label>
              <input name="roles" className="input text-xs" placeholder="e.g. USER, SELLER — comma-separated" />
            </div>
          </div>
        )}
      </div>

      {/* ── Resend Email Delivery Settings ──────────────────────────────── */}
      <div className="rounded-2xl border border-amber-200/80 bg-white/70 p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowEmailDelivery((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-amber-900"
        >
          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email Delivery (Resend Integration)</span>
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
                className="h-4 w-4 rounded border-border text-amber-800 focus:ring-amber-800"
              />
              Enable targeted email delivery for this campaign
            </label>
            {emailEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-amber-900 font-medium">Email subject line</label>
                  <input name="emailSubject" className="input text-xs" placeholder="Subject for campaign emails" />
                </div>
                <div>
                  <label className="text-xs text-amber-900 font-medium">Send to segment</label>
                  <select name="emailSegment" defaultValue="all" className="input text-xs">
                    {SEGMENT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Attach Services & Products (Collapsible Details) ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <details className="rounded-2xl border border-border bg-muted/40 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-amber-800" /> Attach Specific Services ({services.length} available)
          </summary>
          <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <input name="serviceIds" type="checkbox" value={s.id} className="h-3.5 w-3.5 rounded border-border text-amber-800" />
                {s.title}
              </label>
            ))}
          </div>
        </details>

        <details className="rounded-2xl border border-border bg-muted/40 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-800" /> Relate Marketplace Products ({products.length} available)
          </summary>
          <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <input name="productIds" type="checkbox" value={p.id} className="h-3.5 w-3.5 rounded border-border text-amber-800" />
                {p.name}
              </label>
            ))}
          </div>
        </details>
      </div>



      <div className="flex items-center justify-end gap-3 pt-2">
        {editingCampaign && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-muted px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="mr-1.5 h-4 w-4" /> Cancel Edit
          </button>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-amber-800 px-7 py-3.5 text-sm font-semibold text-white hover:bg-amber-900 transition-colors shadow-md hover:shadow-lg"
        >
          {editingCampaign ? (
            <>
              <Pencil className="mr-2 h-4 w-4" /> Save Campaign Changes
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Create &amp; Launch Campaign
            </>
          )}
        </button>
      </div>
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
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Campaign Media Assets Preview */}
      {(campaign.bannerUrl || campaign.videoUrl) && (
        <div className="border-t border-amber-200/60 pt-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" /> Campaign Media Assets:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campaign.bannerUrl && (
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Banner Image</span>
                <div className="overflow-hidden rounded-xl border border-amber-200 bg-black/5 aspect-video">
                  <img src={campaign.bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                </div>
              </div>
            )}
            {campaign.videoUrl && (
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Campaign Video</span>
                <div className="overflow-hidden rounded-xl border border-amber-200 bg-black aspect-video">
                  <video src={campaign.videoUrl} controls className="h-full w-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generic create panel ───────────────────────────────────────────────────────
function CreatePanel({ title, children, services, onSubmit }: {
  title: string; children: React.ReactNode; services: Service[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-bold text-lg text-foreground">{title}</h2>
      {children}
      <details className="rounded-xl border border-border bg-muted/40 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-foreground">Attach services</summary>
        <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              <input name="serviceIds" type="checkbox" value={s.id} className="h-3.5 w-3.5 rounded border-border text-amber-800" />{s.title}
            </label>
          ))}
        </div>
      </details>
      <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-amber-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-900 transition-colors">
        <Plus className="mr-1.5 h-4 w-4" />Create
      </button>
    </form>
  )
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-start gap-3">
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5">{icon}</div>
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

