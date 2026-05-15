"use client"

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { name: "Overview",      path: "/dashboard",                icon: "◈", color: "text-violet-400" },
  { name: "Subscriptions", path: "/dashboard/subscriptions", icon: "⬡", color: "text-blue-400" },
  { name: "Projects",      path: "/dashboard/projects",      icon: "◻", color: "text-emerald-400" },
  { name: "Invoices",      path: "/dashboard/invoices",      icon: "◑", color: "text-amber-400" },
  { name: "Support",       path: "/dashboard/tickets",       icon: "◎", color: "text-red-400" },
  { name: "AI Chat",       path: "/dashboard/chat",          icon: "✦", color: "text-purple-400" },
]

const S = `
.dash-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.dash-nav-active{background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3)}
.dash-nav-item{border:1px solid transparent}
.dash-nav-item:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06)}
.dash-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.dash-live{animation:db 2s ease-in-out infinite}
@keyframes dsi{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}.dash-slide{animation:dsi .15s ease-out}
.dash-scroll::-webkit-scrollbar{width:3px}.dash-scroll::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:2px}
`

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o) }
      if (e.key === "Escape") { setCmdOpen(false); setNotifOpen(false) }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const currentPage = NAV.find(n => pathname === n.path || (n.path !== "/dashboard" && pathname.startsWith(n.path)))?.name ?? "Dashboard"

  return (
    <div className="flex h-screen bg-[#080808] text-white overflow-hidden">
      <style>{S}</style>

      {/* ── COMMAND PALETTE ──────────────────────────────────────── */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={() => setCmdOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="dash-glass rounded-2xl w-full max-w-lg z-10 dash-slide overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <span className="text-zinc-500 text-sm">⌕</span>
              <input autoFocus className="flex-1 bg-transparent outline-none text-white placeholder-zinc-600 text-sm" placeholder="Search pages, actions, settings..." />
              <kbd className="dash-glass text-[10px] px-2 py-0.5 rounded text-zinc-600">ESC</kbd>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto dash-scroll">
              <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest">Navigation</p>
              {NAV.map(n => (
                <Link key={n.path} href={n.path} onClick={() => setCmdOpen(false)}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                    <span className={`text-sm ${n.color}`}>{n.icon}</span>
                    <span className="text-sm text-zinc-300">{n.name}</span>
                    <span className="ml-auto text-xs text-zinc-700 font-mono">{n.path}</span>
                  </div>
                </Link>
              ))}
              <p className="text-[10px] text-zinc-700 px-3 py-2 uppercase tracking-widest border-t border-white/5 mt-1">Quick Actions</p>
              {[["✦ Open AI Chat", "/dashboard/chat"],["◎ Create Ticket", "/dashboard/tickets"],["⬡ Browse Plans", "/dashboard/subscriptions"],["↗ Marketplace", "/marketplace"]].map(([l,h])=>(
                <Link key={h} href={h} onClick={() => setCmdOpen(false)}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer">
                    <span className="text-sm text-zinc-400">{l}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside style={{width: collapsed ? "64px" : "232px", transition:"width .25s cubic-bezier(.4,0,.2,1)"}}
        className="dash-glass border-r border-white/5 hidden md:flex flex-col shrink-0 z-30 overflow-hidden">

        {/* Logo */}
        <div className={`flex items-center h-14 border-b border-white/5 shrink-0 ${collapsed ? "justify-center px-3" : "px-4"}`}>
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
        <nav className="flex-1 overflow-y-auto dash-scroll p-2 space-y-0.5">
          {NAV.map(item => {
            const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path))
            return (
              <Link key={item.path} href={item.path}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all dash-nav-item ${active ? "dash-nav-active" : ""}`}>
                  <span className={`text-base shrink-0 ${active ? item.color : "text-zinc-600"}`}>{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className={`text-sm font-medium flex-1 ${active ? "text-white" : "text-zinc-500"}`}>{item.name}</span>
                      {item.name === "Support" && <span className="dash-glass text-[10px] px-1.5 py-0.5 rounded-full text-red-400 font-bold">2</span>}
                      {item.name === "AI Chat" && <span className="w-1.5 h-1.5 bg-purple-400 rounded-full dash-live" />}
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/5 space-y-0.5">
          {[{name:"Settings", path:"/dashboard/profile", icon:"⚙"},{name:"Back to Site", path:"/", icon:"←"}].map(item=>(
            <Link key={item.path} href={item.path}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer dash-nav-item transition-all`}>
                <span className="text-base text-zinc-700 shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm text-zinc-600">{item.name}</span>}
              </div>
            </Link>
          ))}
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Navbar */}
        <header className="h-14 dash-glass border-b border-white/5 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="md:hidden text-lg font-black text-violet-400">⬡</span>
            <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
              Dashboard <span className="text-zinc-700">/</span>
              <span className="text-zinc-300 font-medium">{currentPage}</span>
            </div>
          </div>

          <button onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 dash-glass rounded-lg px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-400 transition-all cursor-pointer">
            <span>⌕</span>
            <span>Search or jump to...</span>
            <kbd className="ml-3 dash-glass text-[10px] px-1.5 py-0.5 rounded text-zinc-700">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 dash-glass rounded-full px-2.5 py-1 text-xs">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full dash-live" />
              <span className="text-zinc-500">Live</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)}
                className="dash-glass w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all relative text-sm">
                🔔
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#080808]" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 dash-glass rounded-2xl dash-slide z-50 overflow-hidden shadow-2xl">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <p className="font-semibold text-sm">Notifications</p>
                    <button className="text-xs text-purple-400 hover:underline">Mark all read</button>
                  </div>
                  {[{i:"💳",t:"Invoice paid",d:"INV-2024-03 for $349 was paid",ts:"2h ago",u:true},
                    {i:"✅",t:"Ticket resolved",d:"Support ticket #T-882 resolved",ts:"1d ago",u:true},
                    {i:"✦",t:"AI response",d:"Your question has been answered",ts:"3d ago",u:false}
                  ].map((n,idx)=>(
                    <div key={idx} className={`px-4 py-3 border-b border-white/5 hover:bg-white/3 transition-all ${n.u?"bg-purple-500/5":""}`}>
                      <div className="flex gap-3">
                        <span className="text-lg shrink-0">{n.i}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.t}</p>
                          <p className="text-xs text-zinc-600 truncate">{n.d}</p>
                        </div>
                        <span className="text-[10px] text-zinc-700 shrink-0">{n.ts}</span>
                      </div>
                    </div>
                  ))}
                  <div className="p-3 text-center">
                    <button className="text-xs text-zinc-600 hover:text-zinc-300">View all</button>
                  </div>
                </div>
              )}
            </div>

            <Link href="/dashboard/profile">
              <div className="flex items-center gap-2 dash-glass rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-white/10 transition-all">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-black">A</div>
                <span className="text-sm font-medium text-zinc-300 hidden sm:block">Acme Corp</span>
                <span className="text-xs text-zinc-600">▾</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto dash-scroll bg-[#080808] p-4 sm:p-6">
          {children}
        </main>

        {/* Mobile nav */}
        <nav className="md:hidden dash-glass border-t border-white/5 flex justify-around p-2 shrink-0">
          {[...NAV.slice(0,4), {name:"More",path:"/dashboard/profile",icon:"⊕",color:"text-zinc-500"}].map(item=>(
            <Link key={item.path} href={item.path}>
              <div className={`flex flex-col items-center gap-0.5 p-2 rounded-xl ${pathname.startsWith(item.path)?"text-violet-400":"text-zinc-600"}`}>
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
