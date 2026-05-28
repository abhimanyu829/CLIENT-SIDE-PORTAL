"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useSession, signOut } from "next-auth/react"

const S = `
.ds-glass{background:rgba(8,8,12,.95);backdrop-filter:blur(24px);border-right:1px solid rgba(255,255,255,.06)}
.ds-item{display:flex;align-items:center;gap:.75rem;padding:.6rem .875rem;border-radius:.875rem;transition:all .2s;cursor:pointer;margin-bottom:.125rem}
.ds-item:hover{background:rgba(255,255,255,.05);color:#fff}
.ds-item-active{background:rgba(139,92,246,.12)!important;border:1px solid rgba(139,92,246,.25)!important;color:#c4b5fd}
.ds-section{font-size:.625rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.2);padding:.75rem .875rem .375rem;margin-top:.5rem}
.ds-badge{margin-left:auto;font-size:.625rem;padding:.2rem .5rem;border-radius:9999px;font-weight:900;background:rgba(139,92,246,.2);color:#a78bfa}
@keyframes dsslide{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}.ds-slide{animation:dsslide .25s ease-out}
`

const NAV = [
  {
    section: "Overview",
    items: [
      { href:"/dashboard",               icon:"◈", label:"Overview" },
      { href:"/dashboard/subscriptions", icon:"⬡", label:"Subscriptions" },
      { href:"/dashboard/my-products",   icon:"📦", label:"My Products" },
    ]
  },
  {
    section: "Workspace",
    items: [
      { href:"/dashboard/projects",      icon:"◻", label:"Projects" },
      { href:"/dashboard/tickets",       icon:"◑", label:"Tickets",  badge:"" },
      { href:"/dashboard/chat",          icon:"✦", label:"AI Chat" },
    ]
  },
  {
    section: "Billing",
    items: [
      { href:"/dashboard/invoices",      icon:"◐", label:"Invoices" },
    ]
  },
  {
    section: "Account",
    items: [
      { href:"/dashboard/profile",       icon:"◎", label:"Profile" },
    ]
  },
]

export default function DashboardSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      className={`ds-glass ds-slide hidden md:flex flex-col shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
      style={{height:"100vh",position:"sticky",top:0}}>
      <style>{S}</style>

      {/* Logo + collapse button */}
      <div className="flex items-center justify-between px-3 pt-4 pb-3 border-b border-white/5">
        {!collapsed && (
          <span className="text-sm font-black"
            style={{background:"linear-gradient(135deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
            ⬡ NexusAI
          </span>
        )}
        <button onClick={() => setCollapsed(c => !c)}
          className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-white/5"
          aria-label="Toggle sidebar">
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV.map(group => (
          <div key={group.section}>
            {!collapsed && <p className="ds-section">{group.section}</p>}
            {group.items.map(item => (
              <Link key={item.href} href={item.href}>
                <div className={`ds-item ${isActive(item.href) ? "ds-item-active" : "text-zinc-500"}`}
                  title={collapsed ? item.label : undefined}>
                  <span className={`text-base shrink-0 ${isActive(item.href) ? "text-purple-400" : ""}`}>{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="text-sm font-semibold">{item.label}</span>
                      {item.badge !== undefined && item.badge && (
                        <span className="ds-badge">{item.badge}</span>
                      )}
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-2 pb-3 border-t border-white/5 pt-3">
        <div className={`ds-item ${collapsed ? "justify-center" : ""}`}>
          <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black"
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-300 truncate">{session?.user?.name ?? "User"}</p>
              <p className="text-[10px] text-zinc-700 truncate">{session?.user?.email ?? ""}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={() => signOut()}
            className="ds-item w-full text-zinc-700 hover:text-red-400 hover:bg-red-500/5 mt-1 text-xs">
            <span>→</span>
            <span>Sign out</span>
          </button>
        )}
      </div>
    </aside>
  )
}
