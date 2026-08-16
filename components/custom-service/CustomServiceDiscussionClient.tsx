"use client"

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Send,
  Shield,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react"
import { getPusherClient } from "@/lib/pusher-client"

// ─── Types ────────────────────────────────────────────────────────────────────
type Attachment = {
  id?: string
  fileName: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  url: string
}

type Message = {
  id: string
  senderId: string
  senderType: "CLIENT" | "ADMIN"
  body: string
  isInternal: boolean
  createdAt: string
  sender: { id: string; name: string; role: string }
  attachments: Attachment[]
}

type Detail = {
  id: string
  requestNumber: string
  projectTitle: string
  serviceCategory: string
  status: string
  fullName: string
  email: string
  phone?: string | null
  companyName?: string | null
  ideaDescription: string
  problemStatement?: string | null
  requestedFeatures?: string | null
  targetUsers?: string | null
  expectedBudget?: string | null
  expectedTimeline?: string | null
  additionalNotes?: string | null
  createdAt: string
  lastActivityAt: string
  attachments: Attachment[]
  client: { id: string; name: string; email: string }
  messages: Message[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip", "application/x-zip-compressed",
])

// Show file attach UI only when the R2 public URL is configured
const uploadsEnabled = Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL)


const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  NEW:            { label: "New",             color: "text-blue-700",   bg: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",   dot: "bg-blue-500"   },
  UNDER_REVIEW:   { label: "Under Review",    color: "text-violet-700", bg: "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800", dot: "bg-violet-500" },
  DISCUSSION:     { label: "Discussion",      color: "text-amber-700",  bg: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",  dot: "bg-amber-500 animate-pulse"  },
  PROPOSAL_SENT:  { label: "Proposal Sent",   color: "text-orange-700", bg: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800", dot: "bg-orange-500" },
  APPROVED:       { label: "Approved",        color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800", dot: "bg-emerald-500" },
  IN_DEVELOPMENT: { label: "In Development",  color: "text-cyan-700",   bg: "bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800",     dot: "bg-cyan-500 animate-pulse"   },
  COMPLETED:      { label: "Completed",       color: "text-green-700",  bg: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",   dot: "bg-green-500"  },
  CLOSED:         { label: "Closed",          color: "text-gray-600",   bg: "bg-gray-50 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700",      dot: "bg-gray-400"   },
}

const STATUSES = ["NEW","UNDER_REVIEW","DISCUSSION","PROPOSAL_SENT","APPROVED","IN_DEVELOPMENT","COMPLETED","CLOSED"]

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadFile(file: File): Promise<Attachment> {
  if (!ALLOWED.has(file.type) || file.size > 10 * 1024 * 1024)
    throw new Error("Attachments must be an image, PDF, Word, or ZIP file up to 10 MB.")
  const res  = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, folder: "service-requests" }),
  })
  const ticket = await res.json()
  if (!res.ok) throw new Error(ticket.error || "Unable to prepare upload")
  const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file })
  if (!put.ok) throw new Error("Unable to upload file")
  return { fileName: file.name, mimeType: file.type, sizeBytes: file.size, storageKey: ticket.key, url: ticket.publicUrl }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)        return "just now"
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function fullTime(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NEW
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  return (
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
      ${isAdmin
        ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30"
        : "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30"}
    `}>
      {initials(name)}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwnMessage }: { msg: Message; isOwnMessage: boolean }) {
  const isAdmin    = msg.senderType === "ADMIN"
  const isInternal = msg.isInternal

  if (isInternal) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 mb-1.5 text-[11px] text-amber-700 font-semibold">
            <Lock className="w-3 h-3" />
            <span>Internal note — {msg.sender.name}</span>
            <span className="ml-auto text-[10px] font-normal text-amber-600/70">{timeAgo(msg.createdAt)}</span>
          </div>
          {msg.body && <p className="text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">{msg.body}</p>}
          {msg.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {msg.attachments.map((f) => (
                <a key={f.id || f.storageKey} href={f.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-amber-700 hover:underline">
                  <FileText className="w-3.5 h-3.5" />{f.fileName}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"} group`}>
      <Avatar name={msg.sender.name} isAdmin={isAdmin} />
      <div className={`flex flex-col max-w-[78%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-2 mb-1 text-[11px] text-muted-foreground`}>
          {!isOwnMessage && <span className="font-semibold text-foreground">{msg.sender.name}</span>}
          <span title={fullTime(msg.createdAt)}>{timeAgo(msg.createdAt)}</span>
        </div>
        <div className={`
          rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs
          ${isOwnMessage
            ? "bg-white text-zinc-900 border border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-sm font-semibold"
            : "bg-zinc-50 border border-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 rounded-tl-sm font-medium"}
        `}>
          {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
          {msg.attachments.length > 0 && (
            <div className={`mt-3 space-y-1.5 ${msg.body ? "border-t border-zinc-200 dark:border-zinc-700 pt-2.5" : ""}`}>
              {msg.attachments.map((f) => (
                <a
                  key={f.id || f.storageKey}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`
                    flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors
                    ${isOwnMessage
                      ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200"
                      : "bg-muted text-foreground hover:bg-muted/70"}
                  `}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{f.fileName}</span>
                  <Download className="w-3 h-3 shrink-0 opacity-60" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Detail Row (sidebar) ─────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</dd>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function CustomServiceDiscussionClient({
  requestId,
  admin = false,
}: {
  requestId: string
  admin?: boolean
}) {
  const [detail,      setDetail]      = useState<Detail | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [message,     setMessage]     = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [internal,    setInternal]    = useState(false)
  const [busy,        setBusy]        = useState(false)
  const [sendError,   setSendError]   = useState<string | null>(null)
  const [statusBusy,  setStatusBusy]  = useState(false)
  const [charCount,   setCharCount]   = useState(0)
  const [sidebarTab,  setSidebarTab]  = useState<"details" | "attachments">("details")

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    const res     = await fetch(`/api/custom-service-requests/${requestId}`, { cache: "no-store" })
    const payload = await res.json().catch(() => null)
    if (payload?.success) {
      setDetail(payload.data.request)
      setError(null)
    } else {
      setError(payload?.error || "Unable to load this request")
    }
    setLoading(false)
  }

  // ── Real-time + polling ───────────────────────────────────────────────────
  useEffect(() => {
    void load()
    const timer = window.setInterval(load, 8000)
    let channel: any; let client: any
    void getPusherClient().then((pusher) => {
      client  = pusher
      channel = client.subscribe(`private-service-request-${requestId}`)
      channel.bind("custom-service.message", load)
      channel.bind("custom-service.request", load)
    })
    return () => {
      window.clearInterval(timer)
      if (channel) channel.unbind_all()
      if (client)  client.unsubscribe(`private-service-request-${requestId}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [detail?.messages.length])

  // ── File upload ───────────────────────────────────────────────────────────
  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 8 - attachments.length)
    if (!files.length) return
    setBusy(true); setSendError(null)
    try {
      const uploaded = await Promise.all(files.map(uploadFile))
      setAttachments((cur) => [...cur, ...uploaded])
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Unable to upload file")
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function send(event: FormEvent) {
    event.preventDefault()
    if (!message.trim() && !attachments.length) return
    setBusy(true); setSendError(null)
    const res     = await fetch(`/api/custom-service-requests/${requestId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: message, isInternal: admin && internal, attachments }),
    })
    const payload = await res.json().catch(() => null)
    setBusy(false)
    if (!payload?.success) { setSendError(payload?.error || "Unable to send message"); return }
    setMessage(""); setAttachments([]); setInternal(false); setCharCount(0)
    await load()
  }

  // ── Status update ─────────────────────────────────────────────────────────
  async function updateStatus(status: string) {
    setStatusBusy(true)
    const res     = await fetch(`/api/custom-service-requests/${requestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const payload = await res.json().catch(() => null)
    setStatusBusy(false)
    if (!payload?.success) { setSendError(payload?.error || "Unable to update status"); return }
    await load()
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-amber-600/30 border-t-amber-600 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading discussion…</p>
        </div>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <X className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Unable to load request</p>
          <p className="text-sm text-muted-foreground mt-1">{error ?? "Request not found"}</p>
        </div>
        <Link
          href={admin ? "/admin/service-requests" : "/dashboard/service-requests"}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to requests
        </Link>
      </div>
    )
  }

  const cfg        = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.NEW
  const msgCount   = detail.messages.filter((m) => !m.isInternal).length
  const noteCount  = detail.messages.filter((m) => m.isInternal).length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href={admin ? "/admin/service-requests" : "/dashboard/service-requests"}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All requests</span>
        </Link>
        <span className="text-border">·</span>
        <span className="text-xs font-mono text-muted-foreground">{detail.requestNumber}</span>
        <div className="ml-auto">
          <StatusBadge status={detail.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* ─────────────────────────── CHAT PANEL ─────────────────────────── */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={{ minHeight: "640px" }}>

          {/* Chat header */}
          <header className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[.15em] text-amber-700">{detail.serviceCategory}</p>
                </div>
                <h1 className="mt-1 text-lg font-bold text-foreground truncate">{detail.projectTitle}</h1>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{msgCount} message{msgCount !== 1 ? "s" : ""}</span>
                  {admin && noteCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{noteCount} internal note{noteCount !== 1 ? "s" : ""}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>Last active {timeAgo(detail.lastActivityAt)}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-muted/10 p-5 space-y-5" style={{ scrollbarWidth: "thin" }}>
            {detail.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {admin
                      ? "Reply to the client to start the discussion."
                      : "Send a message to start your discussion with the NexusAI team."}
                  </p>
                </div>
              </div>
            ) : (
              detail.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwnMessage={
                    admin
                      ? msg.senderType === "ADMIN"
                      : msg.senderType === "CLIENT"
                  }
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Compose bar */}
          <form onSubmit={send} className="shrink-0 border-t border-border bg-card p-4">
            {/* Pending attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((f) => (
                  <div key={f.storageKey} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{f.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((c) => c.filter((x) => x.storageKey !== f.storageKey))}
                      className="text-muted-foreground hover:text-red-500 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setCharCount(e.target.value.length) }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void send(e as any)
                }
              }}
              placeholder={
                admin
                  ? "Reply to the client… (Ctrl+Enter to send)"
                  : "Write a message to the NexusAI team… (Ctrl+Enter to send)"
              }
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600/40 transition-all"
            />

            {/* Admin internal note toggle */}
            {admin && (
              <label className="mt-2.5 flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-amber-600"
                />
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs text-muted-foreground font-medium">
                  Internal note <span className="text-amber-600">(hidden from client)</span>
                </span>
              </label>
            )}

            {sendError && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <X className="w-3.5 h-3.5 shrink-0" /> {sendError}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
              {uploadsEnabled && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || attachments.length >= 8}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-40 transition-all"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    Attach
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.zip"
                    onChange={onFiles}
                  />
                </>
              )}
                {charCount > 0 && (
                  <span className={`text-[10px] font-mono ${charCount > 7500 ? "text-red-500" : "text-muted-foreground"}`}>
                    {charCount}/8000
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={busy || (!message.trim() && !attachments.length)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-700/20 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <><Send className="w-4 h-4" /> Send</>
                }
              </button>
            </div>
          </form>
        </section>

        {/* ─────────────────────────── SIDEBAR ────────────────────────────── */}
        <aside className="space-y-4">

          {/* Status card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</h2>
                <StatusBadge status={detail.status} />
              </div>
            </div>

            {admin ? (
              <div className="p-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Update request status</p>
                <div className="relative">
                  <select
                    value={detail.status}
                    onChange={(e) => updateStatus(e.target.value)}
                    disabled={statusBusy}
                    className="w-full appearance-none rounded-xl border border-border bg-background pl-3 pr-8 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 disabled:opacity-60 transition-all"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    {statusBusy
                      ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-muted-foreground leading-relaxed">
                Your request is currently <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>.
                The NexusAI team will update you as the project progresses.
              </div>
            )}
          </div>

          {/* Detail tabs */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-border">
              {(["details", "attachments"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    sidebarTab === tab
                      ? "text-amber-700 border-b-2 border-amber-700 -mb-px bg-amber-50/50 dark:bg-amber-900/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "details" ? "Details" : `Files (${detail.attachments.length})`}
                </button>
              ))}
            </div>

            {/* Details tab */}
            {sidebarTab === "details" && (
              <dl className="px-5 py-4 space-y-4 max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {/* Client info */}
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <Avatar name={detail.fullName} isAdmin={false} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{detail.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{detail.email}</p>
                    {detail.companyName && (
                      <p className="text-xs text-muted-foreground truncate">{detail.companyName}</p>
                    )}
                  </div>
                </div>

                <DetailRow label="Request ID"    value={detail.requestNumber} />
                <DetailRow label="Category"      value={detail.serviceCategory} />
                {detail.phone && <DetailRow label="Phone"        value={detail.phone} />}
                <DetailRow label="Submitted"     value={new Date(detail.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />

                <div className="border-t border-border pt-4 space-y-4">
                  <DetailRow label="Idea"        value={detail.ideaDescription} />
                  <DetailRow label="Problem"     value={detail.problemStatement} />
                  <DetailRow label="Features"    value={detail.requestedFeatures} />
                  <DetailRow label="Target users" value={detail.targetUsers} />
                  <DetailRow label="Budget"      value={detail.expectedBudget} />
                  <DetailRow label="Timeline"    value={detail.expectedTimeline} />
                  <DetailRow label="Notes"       value={detail.additionalNotes} />
                </div>
              </dl>
            )}

            {/* Attachments tab */}
            {sidebarTab === "attachments" && (
              <div className="p-4 max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {detail.attachments.length === 0 ? (
                  <div className="py-10 text-center">
                    <Paperclip className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">No files attached to this request.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detail.attachments.map((f) => (
                      <a
                        key={f.id || f.storageKey}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3 hover:bg-muted transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{f.fileName}</p>
                          {f.sizeBytes && <p className="text-[10px] text-muted-foreground">{formatBytes(f.sizeBytes)}</p>}
                        </div>
                        <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-700 transition-colors shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin internal notes legend */}
          {admin && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Internal Notes</span>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                Notes marked as internal are only visible to Admin and Sub-Admin users. Clients cannot see them.
              </p>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-foreground">{msgCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Messages</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs font-medium text-foreground mt-0.5">{timeAgo(detail.createdAt)}</p>
              <p className="text-[10px] text-muted-foreground">Submitted</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
