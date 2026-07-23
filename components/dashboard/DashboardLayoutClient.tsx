"use client"

import { ReactNode, useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import { useNotifications } from "@/hooks/useNotifications"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"
import { usePaymentSync } from "@/hooks/usePaymentSync"

const NAV = [
  { name: "Overview",          path: "/dashboard",                   icon: "◈", color: "text-violet-400" },
  { name: "My Products",       path: "/dashboard/my-products",       icon: "◆", color: "text-green-400" },
  { name: "Subscriptions",     path: "/dashboard/subscriptions",     icon: "⬡", color: "text-blue-400" },
  { name: "Projects",          path: "/dashboard/projects",          icon: "◻", color: "text-emerald-400" },
  { name: "Vendor Studio",     path: "/dashboard/vendor",            icon: "Store", color: "text-fuchsia-400" },
  { name: "Invoices",          path: "/dashboard/invoices",          icon: "◑", color: "text-amber-400" },
  { name: "Service Requests",  path: "/dashboard/service-requests",  icon: "◐", color: "text-orange-400" },
  { name: "Support",           path: "/dashboard/tickets",           icon: "◎", color: "text-red-400",    badge: true },
  { name: "AI Chat",           path: "/dashboard/chat",              icon: "✦", color: "text-purple-400", live: true },
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
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-muted-foreground text-sm">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground text-sm"
            placeholder="Search projects, tickets, invoices, products…"
          />
          {loading && <span className="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin" />}
          <kbd className="text-[10px] bg-accent/5 border border-border px-2 py-0.5 rounded text-muted-foreground">ESC</kbd>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {!q && (
            <>
              <p className="text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-widest">Navigation</p>
              {NAV.map((n) => (
                <button key={n.path} onClick={() => go(n.path)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left">
                  <span className={`text-sm ${n.color}`}>{n.icon}</span>
                  <span className="text-sm text-foreground">{n.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">{n.path}</span>
                </button>
              ))}
              <p className="text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-widest border-t border-border mt-1">Quick Actions</p>
              {[["✦ Open AI Chat", "/dashboard/chat"],["◎ New Ticket", "/dashboard/tickets"],["⬡ Browse Plans", "/dashboard/subscriptions"],["↗ Marketplace", "/marketplace"],["◐ Service Request", "/request-service"]].map(([l,h])=>(
                <button key={h} onClick={() => go(h)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left">
                  <span className="text-sm text-muted-foreground">{l}</span>
                </button>
              ))}
            </>
          )}

          {q.length >= 2 && !loading && !hasResults && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No results for &quot;{q}&quot;</div>
          )}

          {hasResults && (
            <>
              {results!.projects.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-widest">Projects</p>
                  {results!.projects.map((p) => (
                    <button key={p.id} onClick={() => go(`/dashboard/projects/${p.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left">
                      <span className="text-emerald-400 text-sm">◻</span>
                      <span className="text-sm text-foreground flex-1 truncate">{p.title}</span>
                      <span className="text-[10px] text-muted-foreground bg-accent/5 px-1.5 py-0.5 rounded">{p.status}</span>
                    </button>
                  ))}
                </>
              )}
              {results!.tickets.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-widest border-t border-border">Tickets</p>
                  {results!.tickets.map((t) => (
                    <button key={t.id} onClick={() => go(`/dashboard/tickets/${t.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left">
                      <span className="text-red-400 text-sm">◎</span>
                      <span className="text-sm text-foreground flex-1 truncate">{t.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.priority === 'HIGH' || t.priority === 'CRITICAL' ? 'text-red-400 bg-red-500/10' : 'text-muted-foreground bg-accent/5'}`}>{t.priority}</span>
                    </button>
                  ))}
                </>
              )}
              {results!.invoices.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-widest border-t border-border">Invoices</p>
                  {results!.invoices.map((inv) => (
                    <button key={inv.id} onClick={() => go(`/dashboard/invoices`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left">
                      <span className="text-amber-400 text-sm">◑</span>
                      <span className="text-sm text-foreground font-mono flex-1">{inv.number}</span>
                      <span className="text-xs text-muted-foreground">${Number(inv.totalAmount).toFixed(2)}</span>
                    </button>
                  ))}
                </>
              )}
              {results!.products.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground px-3 py-2 uppercase tracking-widest border-t border-border">Marketplace</p>
                  {results!.products.map((p) => (
                    <button key={p.id} onClick={() => go(`/marketplace/${p.slug}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left">
                      <span className="text-sm">◈</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.tagline}</p>
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
    <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-2xl z-50 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="font-semibold text-sm">Notifications</p>
        <button onClick={markAllRead} className="text-xs text-purple-400 hover:underline">Mark all read</button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">No notifications yet</div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full px-4 py-3 border-b border-border hover:bg-accent/5 transition-all text-left ${!n.isRead ? "bg-primary/5" : ""}`}
            >
              <div className="flex gap-3">
                <span className="text-lg shrink-0">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground">{n.title}</p>
                    {!n.isRead && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{relTime(n.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-3 text-center border-t border-border">
        <Link href="/dashboard" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">View all activity →</Link>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
  userId,
  userName,
  userRole,
  canAccessAdmin,
  adminPanelHref = "/admin",
  isVerified,
}: {
  children: ReactNode
  userId: string
  userName: string
  userRole?: string
  canAccessAdmin?: boolean
  adminPanelHref?: string
  isVerified?: boolean
}) {
  const { signOut: clerkSignOut } = useClerk()
  const { user: clerkUser } = useUser()

  // Unified logout: always signs out from Clerk (primary), and also clears
  const handleLogout = async () => {
    try {
      await clerkSignOut({ redirectUrl: '/' })
    } catch {
    }
  }

  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  // Real notifications
  const { notifications, unreadCount } = useNotifications(userId)

  // Real-time Pusher channel
  useRealtimeChannel(userId)

  // Payment sync — auto-refresh dashboard on billing events
  usePaymentSync(userId)

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
  const displayName =
    clerkUser?.fullName ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    userName ||
    "You"
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
  const showAdminPanel = Boolean(canAccessAdmin)

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Command Palette */}
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}

      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? "64px" : "232px", transition: "width .25s cubic-bezier(.4,0,.2,1)" }}
        className="bg-card border-r border-border hidden md:flex flex-col shrink-0 z-30 overflow-hidden"
      >
        {/* Logo */}
        <div className={`flex items-center h-14 border-b border-border shrink-0 ${collapsed ? "justify-center px-3" : "px-4"}`}>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="text-primary text-xl font-black">⬡</button>
          ) : (
            <>
              <span className="text-primary text-lg font-black mr-2.5">⬡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-none">Auralis Neural</p>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-mono uppercase">Client Portal</p>
              </div>
              <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors text-xs ml-2 shrink-0">◀</button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" style={{ scrollbarWidth: "thin" }}>
          {NAV.map((item) => {
            const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path))
            return (
              <Link key={item.path} href={item.path}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${active ? "bg-accent/10 border-accent/20" : "border-transparent hover:bg-accent/5 hover:border-border/50"}`}>
                  <span className={`text-base shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}>{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className={`text-sm flex-1 ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{item.name}</span>
                      {item.badge && unreadCount > 0 && (
                        <span className="bg-red-500/10 text-[10px] px-1.5 py-0.5 rounded-full text-red-600 font-bold border border-red-500/20">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                      {item.live && (
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      )}
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border space-y-1">
          {[{ name: "Settings", path: "/dashboard/profile", icon: "⚙" }, { name: "Back to Site", path: "/", icon: "←" }].map((item) => (
            <Link key={item.path} href={item.path}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border border-transparent hover:bg-accent/5 hover:border-border/50 transition-all">
                <span className="text-base text-muted-foreground shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm text-muted-foreground">{item.name}</span>}
              </div>
            </Link>
          ))}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border border-transparent hover:bg-red-500/10 hover:border-red-500/20 transition-all text-left text-red-600 group"
          >
            <span className="text-base text-red-600/70 group-hover:text-red-600 shrink-0">↪</span>
            {!collapsed && <span className="text-sm font-medium">Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Topbar */}
        <header className="h-14 bg-background/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="md:hidden text-lg font-black text-primary">⬡</span>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-mono">
              Dashboard <span className="text-border">/</span>
              <span className="text-foreground font-medium">{currentPage}</span>
            </div>
          </div>

          {/* Search */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer shadow-sm"
          >
            <span>⌕</span>
            <span>Search or jump to...</span>
            <kbd className="ml-3 bg-background border border-border text-[10px] px-1.5 py-0.5 rounded text-muted-foreground font-mono">⌘K</kbd>
          </button>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-1.5 bg-card border border-border rounded-full px-2.5 py-1 text-xs shadow-sm">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground font-mono">Live</span>
            </div>

            {showAdminPanel && (
              <Link
                href={adminPanelHref}
                className="hidden sm:flex items-center bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors font-mono"
              >
                Admin Panel
              </Link>
            )}

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="bg-card border border-border w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all relative text-sm shadow-sm"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[9px] font-bold text-primary-foreground">
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
                className="flex items-center gap-2 bg-card border border-border rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-primary/30 transition-all shadow-sm"
              >
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {initials}
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:block truncate max-w-24">{displayName}</span>
                <span className="text-xs text-muted-foreground">▾</span>
              </div>
              
              {userOpen && (
                <div className="absolute right-0 top-12 w-48 bg-card border border-border rounded-xl z-50 overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-1.5">
                    {showAdminPanel && (
                      <Link href={adminPanelHref} onClick={() => setUserOpen(false)}>
                        <div className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-mono">
                          Admin Panel
                        </div>
                      </Link>
                    )}
                    <Link href="/dashboard/profile" onClick={() => setUserOpen(false)}>
                      <div className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-lg transition-colors">
                        Profile Settings
                      </div>
                    </Link>
                    <button 
                      onClick={handleLogout} 
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 rounded-lg transition-colors mt-0.5"
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
          <div className="bg-primary/5 border-b border-primary/20 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-primary text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-foreground">Email not verified</p>
                <p className="text-xs text-muted-foreground">Verify your email to unlock subscriptions, AI tools, and premium features.</p>
              </div>
            </div>
            <Link
              href="/verify-required"
              className="shrink-0 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg border border-primary/30 transition-colors font-mono"
            >
              Verify Now
            </Link>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">
          {children}
        </main>

        {/* Mobile nav */}
        <nav className="md:hidden bg-card/90 backdrop-blur-xl border-t border-border flex justify-around p-2 shrink-0">
          {[...NAV.slice(0, 4), { name: "More", path: "/dashboard/profile", icon: "⊕" }].map((item) => (
            <Link key={item.path} href={item.path}>
              <div className={`flex flex-col items-center gap-0.5 p-2 rounded-xl ${pathname.startsWith(item.path) ? "text-primary" : "text-muted-foreground"}`}>
                <span className="text-lg">{item.icon}</span>
                <span className="text-[9px] font-medium">{item.name}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
