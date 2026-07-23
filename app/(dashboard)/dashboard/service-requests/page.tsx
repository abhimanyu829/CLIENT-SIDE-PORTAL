import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { ArrowRight, Clock, ClipboardList, Plus, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  NEW:            { label: "New",            color: "text-blue-700",    bg: "bg-blue-50 ring-blue-200",    dot: "bg-blue-500"   },
  UNDER_REVIEW:   { label: "Under Review",   color: "text-violet-700",  bg: "bg-violet-50 ring-violet-200", dot: "bg-violet-500" },
  DISCUSSION:     { label: "Discussion",     color: "text-amber-700",   bg: "bg-amber-50 ring-amber-200",   dot: "bg-amber-500 animate-pulse"  },
  PROPOSAL_SENT:  { label: "Proposal Sent",  color: "text-orange-700",  bg: "bg-orange-50 ring-orange-200", dot: "bg-orange-500" },
  APPROVED:       { label: "Approved",       color: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-200",dot:"bg-emerald-500" },
  IN_DEVELOPMENT: { label: "In Development", color: "text-cyan-700",    bg: "bg-cyan-50 ring-cyan-200",     dot: "bg-cyan-500 animate-pulse"   },
  COMPLETED:      { label: "Completed",      color: "text-green-700",   bg: "bg-green-50 ring-green-200",   dot: "bg-green-500"  },
  CLOSED:         { label: "Closed",         color: "text-gray-500",    bg: "bg-gray-50 ring-gray-200",     dot: "bg-gray-400"   },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.NEW
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${m.color} ${m.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  )
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime()
  if (diff < 60_000)        return "just now"
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function MyServiceRequestsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/service-requests")

  const requests = await db.customServiceRequest.findMany({
    where:   { clientId: session.user.id },
    orderBy: { lastActivityAt: "desc" },
    select: {
      id:              true,
      requestNumber:   true,
      projectTitle:    true,
      serviceCategory: true,
      status:          true,
      lastActivityAt:  true,
      createdAt:       true,
      _count:          { select: { messages: true } },
    },
  })

  const activeCount   = requests.filter((r) => !["COMPLETED","CLOSED"].includes(r.status)).length
  const completedCount= requests.filter((r) => r.status === "COMPLETED").length

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-700" />
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Custom Development</p>
          </div>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">My Service Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and discuss your custom software projects with the NexusAI team.
          </p>
        </div>
        <Link
          href="/request-service"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-700/20 hover:bg-amber-800 transition-all"
        >
          <Plus className="w-4 h-4" /> New Request
        </Link>
      </div>

      {/* ── Stats row ── */}
      {requests.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total",     value: requests.length,  icon: ClipboardList, color: "text-foreground",  bg: "bg-muted/50" },
            { label: "Active",    value: activeCount,      icon: Sparkles,       color: "text-amber-700",  bg: "bg-amber-50 dark:bg-amber-900/20" },
            { label: "Completed", value: completedCount,   icon: Clock,          color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border border-border ${stat.bg} p-4 text-center shadow-sm`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Have an idea? Let&apos;s build it.</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            Submit a service request to discuss your custom software, AI tool, or business solution with the NexusAI team.
          </p>
          <Link
            href="/request-service"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-700/25 hover:bg-amber-800 transition-all"
          >
            Submit your first request <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* ── Request cards ── */
        <div className="space-y-3">
          {requests.map((req) => {
            const isActive = !["COMPLETED","CLOSED"].includes(req.status)
            return (
              <Link
                key={req.id}
                href={`/dashboard/service-requests/${req.id}`}
                className="group block"
              >
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm hover:shadow-md hover:border-amber-600/30 transition-all">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted"}`}>
                    <ClipboardList className={`w-5 h-5 ${isActive ? "text-amber-700" : "text-muted-foreground"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-amber-700 transition-colors truncate">
                      {req.projectTitle}
                    </p>
                    <div className="flex items-center flex-wrap gap-2 mt-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{req.requestNumber}</span>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <span className="text-xs text-muted-foreground">{req.serviceCategory}</span>
                      {req._count.messages > 0 && (
                        <>
                          <span className="text-muted-foreground/40 text-xs">·</span>
                          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground font-medium">
                            {req._count.messages} message{req._count.messages !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status & time */}
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={req.status} />
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {timeAgo(req.lastActivityAt)}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── CTA banner ── */}
      {requests.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">Have another project in mind?</p>
            <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-0.5">
              Submit a new service request and our team will get in touch.
            </p>
          </div>
          <Link
            href="/request-service"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 transition-all"
          >
            <Plus className="w-4 h-4" /> New request
          </Link>
        </div>
      )}
    </div>
  )
}
