import Link from "next/link"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import AdminCustomServiceRequestControls from "./AdminCustomServiceRequestControls"
import { ClipboardList, Clock, Plus } from "lucide-react"

export const dynamic = "force-dynamic"

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string; ring: string }> = {
  NEW:            { label: "New",            color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500",           ring: "ring-blue-500/30"   },
  UNDER_REVIEW:   { label: "Under Review",   color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20", dot: "bg-violet-500",         ring: "ring-violet-500/30" },
  DISCUSSION:     { label: "Discussion",     color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20",   dot: "bg-amber-500 animate-pulse",  ring: "ring-amber-500/30"  },
  PROPOSAL_SENT:  { label: "Proposal Sent",  color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", dot: "bg-orange-500",         ring: "ring-orange-500/30" },
  APPROVED:       { label: "Approved",       color: "text-emerald-700 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-900/20",dot:"bg-emerald-500",        ring: "ring-emerald-500/30"},
  IN_DEVELOPMENT: { label: "In Development", color: "text-cyan-700 dark:text-cyan-400",     bg: "bg-cyan-50 dark:bg-cyan-900/20",     dot: "bg-cyan-500 animate-pulse",   ring: "ring-cyan-500/30"   },
  COMPLETED:      { label: "Completed",      color: "text-green-700 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-900/20",   dot: "bg-green-500",          ring: "ring-green-500/30"  },
  CLOSED:         { label: "Closed",         color: "text-gray-500 dark:text-gray-400",     bg: "bg-gray-50 dark:bg-gray-800/30",     dot: "bg-gray-400",           ring: "ring-gray-400/30"   },
}

const ALL_STATUSES = ["NEW","UNDER_REVIEW","DISCUSSION","PROPOSAL_SENT","APPROVED","IN_DEVELOPMENT","COMPLETED","CLOSED"]

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.NEW
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${m.color} ${m.bg} ${m.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  )
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime()
  if (diff < 60_000)      return "just now"
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function AdminServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  await requireAdmin()
  const { q = "", status = "ALL" } = await searchParams

  // Fetch all matching requests
  const requests = await db.customServiceRequest.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { requestNumber:   { contains: q, mode: "insensitive" } },
              { projectTitle:    { contains: q, mode: "insensitive" } },
              { fullName:        { contains: q, mode: "insensitive" } },
              { email:           { contains: q, mode: "insensitive" } },
              { serviceCategory: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(status && status !== "ALL"
        ? { status: status as any }
        : {}),
    },
    orderBy: { lastActivityAt: "desc" },
    take: 300,
    select: {
      id:              true,
      requestNumber:   true,
      projectTitle:    true,
      fullName:        true,
      email:           true,
      serviceCategory: true,
      status:          true,
      lastActivityAt:  true,
      createdAt:       true,
      _count:          { select: { messages: true } },
    },
  })

  // Count per status for tab badges
  const counts = await db.customServiceRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  })
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
  const totalAll = counts.reduce((acc, c) => acc + c._count._all, 0)

  const tabs = [
    { key: "ALL", label: "All",            count: totalAll },
    ...ALL_STATUSES.map((s) => ({ key: s, label: STATUS_META[s]?.label ?? s, count: countMap[s] ?? 0 })),
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-700" />
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-800">Client Collaboration</p>
          </div>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">Service Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Review custom development requests, manage client discussions, attachments, and internal notes.
          </p>
        </div>
        <Link
          href="/request-service"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-700/20 hover:bg-amber-800 transition-all"
        >
          <Plus className="w-4 h-4" /> New request
        </Link>
      </div>

      {/* ── Portal settings ── */}
      <AdminCustomServiceRequestControls />

      {/* ── Search + Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <form className="flex gap-2 flex-1 min-w-[240px] max-w-md">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by ID, project, client, or email…"
            className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600/40 transition-all"
          />
          {status && status !== "ALL" && (
            <input name="status" type="hidden" value={status} />
          )}
          <button
            type="submit"
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Status tabs ── */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const isActive = tab.key === status || (!status && tab.key === "ALL")
          const m = tab.key !== "ALL" ? STATUS_META[tab.key] : null
          return (
            <Link
              key={tab.key}
              href={`/admin/service-requests?${q ? `q=${encodeURIComponent(q)}&` : ""}status=${tab.key}`}
              className={`
                inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all
                ${isActive
                  ? "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400 shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"}
              `}
            >
              {m && <span className={`w-1.5 h-1.5 rounded-full ${m.dot.replace(" animate-pulse","")}`} />}
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-amber-700/15 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* ── Request list ── */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
          <p className="font-semibold text-foreground">No requests found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {q ? `No results for "${q}"` : "No service requests in this category yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Request</th>
                <th className="px-5 py-3.5 hidden md:table-cell">Client</th>
                <th className="px-5 py-3.5 hidden sm:table-cell">Category</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 hidden lg:table-cell text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((req) => (
                <tr
                  key={req.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  {/* Request column */}
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/service-requests/${req.id}`}
                      className="block"
                    >
                      <p className="font-semibold text-foreground group-hover:text-amber-700 transition-colors line-clamp-1">
                        {req.projectTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{req.requestNumber}</span>
                        {req._count.messages > 0 && (
                          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground font-medium">
                            {req._count.messages} msg{req._count.messages !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Client column */}
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="font-medium text-foreground">{req.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{req.email}</p>
                  </td>

                  {/* Category column */}
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{req.serviceCategory}</span>
                  </td>

                  {/* Status column */}
                  <td className="px-5 py-4">
                    <StatusBadge status={req.status} />
                  </td>

                  {/* Activity column */}
                  <td className="px-5 py-4 hidden lg:table-cell text-right">
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeAgo(req.lastActivityAt)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 text-right">
                      Submitted {timeAgo(req.createdAt)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Table footer */}
          <div className="border-t border-border px-5 py-3 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{requests.length}</span> request{requests.length !== 1 ? "s" : ""}
              {status && status !== "ALL" && <> with status <span className="font-semibold text-foreground">{STATUS_META[status]?.label}</span></>}
              {q && <> matching <span className="font-semibold text-foreground">&quot;{q}&quot;</span></>}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
