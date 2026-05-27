"use client"

import { ReactNode, useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useNotifications } from "@/hooks/useNotifications"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"

const NAV = [
  { name: "Overview",      path: "/dashboard",                icon: "◈", color: "text-violet-400" },
  { name: "Subscriptions", path: "/dashboard/subscriptions", icon: "⬡", color: "text-blue-400" },
  { name: "Projects",      path: "/dashboard/projects",      icon: "◻", color: "text-emerald-400" },
  { name: "Vendor Studio", path: "/dashboard/vendor",        icon: "Store", color: "text-fuchsia-400" },
  { name: "Invoices",      path: "/dashboard/invoices",      icon: "◑", color: "text-amber-400" },
  { name: "Support",       path: "/dashboard/tickets",       icon: "◎", color: "text-red-400",    badge: true },
  { name: "AI Chat",       path: "/dashboard/chat",          icon: "✦", color: "text-purple-400", live: true },
]

type SearchResult = {
  projects: any[]
  tickets: any[]
  invoices: any[]
  products: any[]
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null!)

  const search = useCallback((query: string) => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults(null); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const { data } = await res.json()
        setResults(data)
      } catch { setResults(null) }
      finally { setLoading(false) }
    }, 250)
  }, [])

  useEffect(() => { search(q) }, [q, search])

  const hasResults = results && (
    results.projects.length + results.tickets.length + results.invoices.length + results.products.length > 0
  )

  const go = (href: string) => { router.push(href); onClose() }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-zinc-500 text-sm">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent outline-none text-white placeholder-zinc-600 text-sm"
            placeholder="Search projects, tickets, invoices, products…"
          />
          {loading && <span className="w-4 h-4 border-2 border-purple-500/50 border-t-purple-500 rounded-full animate-spin" />}
          <kbd className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-600">ESC</kbd>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {!q && (
            <>
              <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest">Navigation</p>
              {NAV.map((n) => (
                <button key={n.path} onClick={() => go(n.path)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                  <span className={`text-sm ${n.color}`}>{n.icon}</span>
                  <span className="text-sm text-zinc-300">{n.name}</span>
                  <span className="ml-auto text-xs text-zinc-700 font-mono">{n.path}</span>
                </button>
              ))}
              <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest border-t border-white/5 mt-1">Quick Actions</p>
              {[["✦ Open AI Chat", "/dashboard/chat"],["◎ New Ticket", "/dashboard/tickets"],["⬡ Browse Plans", "/dashboard/subscriptions"],["↗ Marketplace", "/marketplace"]].map(([l,h])=>(
                <button key={h} onClick={() => go(h)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                  <span className="text-sm text-zinc-400">{l}</span>
                </button>
              ))}
            </>
          )}

          {q.length >= 2 && !loading && !hasResults && (
            <div className="px-4 py-8 text-center text-zinc-600 text-sm">No results for "{q}"</div>
          )}

          {hasResults && (
            <>
              {results!.projects.length > 0 && (
                <>
                  <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest">Projects</p>
                  {results!.projects.map((p) => (
                    <button key={p.id} onClick={() => go(`/dashboard/projects/${p.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                      <span className="text-emerald-400 text-sm">◻</span>
                      <span className="text-sm text-zinc-300 flex-1 truncate">{p.title}</span>
                      <span className="text-[10px] text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded">{p.status}</span>
                    </button>
                  ))}
                </>
              )}
              {results!.tickets.length > 0 && (
                <>
                  <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest border-t border-white/5">Tickets</p>
                  {results!.tickets.map((t) => (
                    <button key={t.id} onClick={() => go(`/dashboard/tickets/${t.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                      <span className="text-red-400 text-sm">◎</span>
                      <span className="text-sm text-zinc-300 flex-1 truncate">{t.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.priority === 'HIGH' || t.priority === 'CRITICAL' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 bg-white/5'}`}>{t.priority}</span>
                    </button>
                  ))}
                </>
              )}
              {results!.invoices.length > 0 && (
                <>
                  <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest border-t border-white/5">Invoices</p>
                  {results!.invoices.map((inv) => (
                    <button key={inv.id} onClick={() => go(`/dashboard/invoices`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                      <span className="text-amber-400 text-sm">◑</span>
                      <span className="text-sm text-zinc-300 font-mono flex-1">{inv.number}</span>
                      <span className="text-xs text-zinc-400">${Number(inv.totalAmount).toFixed(2)}</span>
                    </button>
                  ))}
                </>
              )}
              {results!.products.length > 0 && (
                <>
                  <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest border-t border-white/5">Marketplace</p>
                  {results!.products.map((p) => (
                    <button key={p.id} onClick={() => go(`/marketplace/${p.slug}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                      <span className="text-sm">◈</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300 truncate">{p.name}</p>
                        <p className="text-[11px] text-zinc-600 truncate">{p.tagline}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { notifications, markRead, markAllRead } = useNotifications()

  const handleClick = (n: any) => {
    markRead(n.id)
    if (n.actionUrl) { router.push(n.actionUrl); onClose() }
  }

  const relTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }

  return (
    <div className="absolute right-0 top-10 w-80 bg-[#0e0e0e] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <p className="font-semibold text-sm">Notifications</p>
        <button onClick={markAllRead} className="text-xs text-purple-400 hover:underline">Mark all read</button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">No notifications yet</div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-all text-left ${!n.isRead ? "bg-purple-500/[0.05]" : ""}`}
            >
              <div className="flex gap-3">
                <span className="text-lg shrink-0">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-white">{n.title}</p>
                    {!n.isRead && <span className="w-1.5 h-1.5 bg-purple-400 rounded-full shrink-0" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{n.body}</p>
                </div>
                <span className="text-[10px] text-zinc-700 shrink-0">{relTime(n.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-3 text-center border-t border-white/[0.06]">
        <Link href="/dashboard" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">View all activity →</Link>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children, userId, userName, isVerified }: { children: ReactNode; userId: string; userName: string; isVerified?: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const { data: session } = useSession()

  // Real notifications
  const { notifications, unreadCount } = useNotifications(userId)

  // Real-time Pusher channel
  useRealtimeChannel(userId)

  // Open tickets count from notifications (badge)
  const openTicketCount = notifications.filter((n) => n.type === "TICKET" && !n.isRead).length

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen((o) => !o) }
      if (e.key === "Escape") { setCmdOpen(false); setNotifOpen(false); setUserOpen(false) }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const currentPage = NAV.find((n) => pathname === n.path || (n.path !== "/dashboard" && pathname.startsWith(n.path)))?.name ?? "Dashboard"
  const displayName = session?.user?.name ?? userName ?? "You"
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="flex h-screen bg-[#080808] text-white overflow-hidden">
      {/* Command Palette */}
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}

      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? "64px" : "232px", transition: "width .25s cubic-bezier(.4,0,.2,1)" }}
        className="bg-[#0a0a0a] border-r border-white/[0.05] hidden md:flex flex-col shrink-0 z-30 overflow-hidden"
      >
        {/* Logo */}
        <div className={`flex items-center h-14 border-b border-white/[0.05] shrink-0 ${collapsed ? "justify-center px-3" : "px-4"}`}>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="text-violet-400 text-xl font-black">⬡</button>
          ) : (
            <>
              <span className="text-violet-400 text-lg font-black mr-2.5">⬡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white leading-none">NexusAI</p>
                <p className="text-[10px] text-zinc-600 leading-none mt-0.5">Client Portal</p>
              </div>
              <button onClick={() => setCollapsed(true)} className="text-zinc-700 hover:text-zinc-400 transition-colors text-xs ml-2 shrink-0">◀</button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "thin" }}>
          {NAV.map((item) => {
            const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path))
            return (
              <Link key={item.path} href={item.path}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${active ? "bg-violet-500/15 border-violet-500/30" : "border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]"}`}>
                  <span className={`text-base shrink-0 ${active ? item.color : "text-zinc-600"}`}>{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className={`text-sm font-medium flex-1 ${active ? "text-white" : "text-zinc-500"}`}>{item.name}</span>
                      {item.badge && unreadCount > 0 && (
                        <span className="bg-red-500/20 text-[10px] px-1.5 py-0.5 rounded-full text-red-400 font-bold border border-red-500/30">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                      {item.live && (
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                      )}
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/[0.05] space-y-0.5">
          {[{ name: "Settings", path: "/dashboard/profile", icon: "⚙" }, { name: "Back to Site", path: "/", icon: "←" }].map((item) => (
            <Link key={item.path} href={item.path}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06] transition-all">
                <span className="text-base text-zinc-700 shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm text-zinc-600">{item.name}</span>}
              </div>
            </Link>
          ))}
          <button 
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border border-transparent hover:bg-red-500/10 hover:border-red-500/20 transition-all text-left text-red-400 group"
          >
            <span className="text-base text-red-400/70 group-hover:text-red-400 shrink-0">↪</span>
            {!collapsed && <span className="text-sm font-medium">Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.05] flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="md:hidden text-lg font-black text-violet-400">⬡</span>
            <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
              Dashboard <span className="text-zinc-700">/</span>
              <span className="text-zinc-300 font-medium">{currentPage}</span>
            </div>
          </div>

          {/* Search */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-400 hover:border-white/[0.12] transition-all cursor-pointer"
          >
            <span>⌕</span>
            <span>Search or jump to...</span>
            <kbd className="ml-3 bg-white/[0.04] border border-white/[0.08] text-[10px] px-1.5 py-0.5 rounded text-zinc-700">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1 text-xs">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-zinc-500">Live</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="bg-white/[0.04] border border-white/[0.06] w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all relative text-sm"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-[#080808] flex items-center justify-center text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            {/* User */}
            <div className="relative">
              <div 
                onClick={() => setUserOpen(!userOpen)}
                className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-white/[0.12] transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-black">
                  {initials}
                </div>
                <span className="text-sm font-medium text-zinc-300 hidden sm:block truncate max-w-24">{displayName}</span>
                <span className="text-xs text-zinc-600">▾</span>
              </div>
              
              {userOpen && (
                <div className="absolute right-0 top-12 w-48 bg-[#0e0e0e] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-1.5">
                    <Link href="/dashboard/profile" onClick={() => setUserOpen(false)}>
                      <div className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded-lg transition-colors">
                        Profile Settings
                      </div>
                    </Link>
                    <button 
                      onClick={() => signOut({ callbackUrl: '/' })} 
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-0.5"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Verification Banner */}
        {isVerified === false && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-amber-400 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-200">Email not verified</p>
                <p className="text-xs text-amber-400/70">Verify your email to unlock subscriptions, AI tools, and premium features.</p>
              </div>
            </div>
            <Link
              href="/verify-required"
              className="shrink-0 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-colors"
            >
              Verify Now
            </Link>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-[#080808] p-4 sm:p-6">
          {children}
        </main>

        {/* Mobile nav */}
        <nav className="md:hidden bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/[0.05] flex justify-around p-2 shrink-0">
          {[...NAV.slice(0, 4), { name: "More", path: "/dashboard/profile", icon: "⊕", color: "text-zinc-500" }].map((item) => (
            <Link key={item.path} href={item.path}>
              <div className={`flex flex-col items-center gap-0.5 p-2 rounded-xl ${pathname.startsWith(item.path) ? "text-violet-400" : "text-zinc-600"}`}>
                <span className="text-lg">{item.icon}</span>
                <span className="text-[9px]">{item.name}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
