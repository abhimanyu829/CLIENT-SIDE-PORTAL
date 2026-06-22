"use client"

import Link from "next/link"
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs"
import { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { usePathname } from "next/navigation"
import { useCart } from "@/providers/CartProvider"
import { useInternalUser } from "@/hooks/useInternalUser"

const SearchModal = lazy(() => import("@/components/marketplace/SearchModal"))
import { ThemeToggle } from "@/components/theme/ThemeToggle"

const MEGA_MENU = {
  Products: {
    icon: "🛒",
    items: [
      { href: "/marketplace", label: "Marketplace", desc: "Browse all products & tools", icon: "🏪" },
      { href: "/ai-agents", label: "AI Agents", desc: "Deploy intelligent AI agents", icon: "🤖", badge: "Live" },
      { href: "/services", label: "Services", desc: "Enterprise delivery and consulting", icon: "🏢" },
      { href: "/marketplace?type=SAAS", label: "SaaS Tools", desc: "Cloud software solutions", icon: "⚡" },
      { href: "/marketplace?type=API", label: "API Tools", desc: "Developer APIs & integrations", icon: "🔗" },
      { href: "/marketplace?type=AUTOMATION", label: "Automation", desc: "Workflow automation tools", icon: "⚙️" },
      { href: "/marketplace?type=ENTERPRISE", label: "Enterprise", desc: "Scale-ready solutions", icon: "🏢" },
    ],
  },
  Solutions: {
    icon: "💡",
    items: [
      { href: "/solutions/enterprise", label: "Enterprise", desc: "For large organizations", icon: "🏢" },
      { href: "/solutions/developers", label: "Developers", desc: "APIs, SDKs & integrations", icon: "💻" },
      { href: "/solutions/creators", label: "Creators", desc: "Sell your AI products", icon: "✨" },
      { href: "/solutions/startups", label: "Startups", desc: "Scale fast with AI", icon: "🚀" },
    ],
  },
  Resources: {
    icon: "📚",
    items: [
      { href: "/blog", label: "Blog", desc: "AI insights & tutorials", icon: "📝" },
      { href: "/demo", label: "Live Demos", desc: "Try products hands-on", icon: "▶️" },
      { href: "/compare", label: "Compare", desc: "Side-by-side comparison", icon: "⚖️" },
      { href: "/docs", label: "Documentation", desc: "Guides & API reference", icon: "📖" },
    ],
  },
}

interface AnnouncementData {
  text: string
  ctaText?: string | null
  ctaUrl?: string | null
}

export default function Navbar({ announcement }: { announcement?: AnnouncementData | null }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { user: internalUser, isLoading: internalUserLoading } = useInternalUser()

  const isAuthenticated = !!clerkUser
  const isLoading = !clerkLoaded || (isAuthenticated && internalUserLoading)
  const userRole = internalUser?.role
  const canAccessAdmin = userRole === "SUPER_ADMIN" || userRole === "SUB_ADMIN"
  const pathname = usePathname()
  const { itemCount } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeMega, setActiveMega] = useState<string | null>(null)
  const [agentCount, setAgentCount] = useState<number | null>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => { setMobileOpen(false); setActiveMega(null) }, [pathname])

  // Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Fetch live agent count
  useEffect(() => {
    fetch("/api/platform-stats").then(r => r.json()).then(d => {
      if (d?.agents) setAgentCount(d.agents)
    }).catch(() => {})
  }, [])

  const closeMenu = useCallback(() => setActiveMega(null), [])

  return (
    <>

      {/* Announcement bar */}
      {announcement?.text && (
        <div className="bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-indigo-500/15 border-b border-purple-500/20 backdrop-blur-md py-2 px-4 text-center">
          <p className="text-xs text-zinc-300">
            {announcement.text}
            {announcement.ctaUrl && announcement.ctaText && (
              <a href={announcement.ctaUrl} className="ml-2 text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                {announcement.ctaText} →
              </a>
            )}
          </p>
        </div>
      )}

      <header className={`sticky top-0 z-50 w-full bg-[#050505]/90 backdrop-blur-xl border-b border-white/[0.06] transition-all ${scrolled ? "shadow-lg shadow-black/30" : ""}`}
        onMouseLeave={closeMenu}>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-black"
              style={{ background: "linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              ⬡ NexusAI
            </span>
          </Link>

          {/* Desktop Nav with Mega Menu */}
          <nav className="hidden lg:flex items-center gap-1">
            {Object.entries(MEGA_MENU).map(([key, menu]) => (
              <div key={key} className="relative">
                <button
                  className={`group relative px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors ${activeMega === key ? "text-white/95" : "text-white/55 hover:text-white/95"}`}
                  onMouseEnter={() => setActiveMega(key)}
                >
                  {key}
                  <svg className={`w-3 h-3 text-zinc-600 transition-transform ${activeMega === key ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className={`absolute bottom-[-4px] left-0 h-[1.5px] bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ${activeMega === key ? "w-full" : "w-0 group-hover:w-full"}`} />
                </button>

                {activeMega === key && (
                  <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[#080808]/95 backdrop-blur-2xl border border-white/10 rounded-[1.25rem] p-5 min-w-[520px] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)] z-[200] animate-in fade-in slide-in-from-top-2 duration-150" onMouseEnter={() => setActiveMega(key)}>
                    <div className="grid grid-cols-2 gap-1">
                      {menu.items.map(item => (
                        <Link key={item.href} href={item.href} className="flex items-start gap-3 p-3 rounded-xl transition-all duration-150 border border-transparent hover:bg-white/5 hover:border-white/10" onClick={closeMenu}>
                          <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{item.label}</span>
                              {"badge" in item && item.badge && (
                                <span className="bg-green-500/20 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1">
                                  <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 mt-0.5">{item.desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Link href="/pricing" className={`group relative px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors ${pathname === "/pricing" ? "text-white/95" : "text-white/55 hover:text-white/95"}`}>
              Pricing
              <span className={`absolute bottom-[-4px] left-0 h-[1.5px] bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ${pathname === "/pricing" ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
            <Link href="/services" className={`group relative px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors ${pathname.startsWith("/services") ? "text-white/95" : "text-white/55 hover:text-white/95"}`}>
              Services
              <span className={`absolute bottom-[-4px] left-0 h-[1.5px] bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ${pathname.startsWith("/services") ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
            <Link href="/cart" className={`group relative px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors ${pathname === "/cart" ? "text-white/95" : "text-white/55 hover:text-white/95"}`}>
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center leading-none">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
              <span className={`absolute bottom-[-4px] left-0 h-[1.5px] bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ${pathname === "/cart" ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
          </nav>

          {/* Right section */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Search bar */}
            <button className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3.5 py-1.5 cursor-pointer transition-all hover:bg-purple-500/5 hover:border-purple-500/40" onClick={() => setSearchOpen(true)}>
              <span className="text-zinc-600 text-sm">🔍</span>
              <span className="text-zinc-600 text-sm">Search...</span>
              <kbd className="ml-2 text-[10px] text-zinc-700 glass px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
            <ThemeToggle />

            {isLoading ? (
              <div className="flex gap-2">
                <div className="h-8 w-20 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-8 w-24 rounded-xl bg-white/5 animate-pulse" />
              </div>
            ) : isAuthenticated ? (
              <>
                {canAccessAdmin && (
                  <Link href="/admin">
                    <button className="text-amber-400/80 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:text-amber-400 hover:bg-amber-400/10">
                      Admin Panel
                    </button>
                  </Link>
                )}
                <Link href="/dashboard"><button className="text-white/60 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:text-white hover:bg-white/5">Dashboard</button></Link>
                <UserButton showName />
              </>
            ) : (
              <>
                <Link href="/login"><button className="text-white/60 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:text-white hover:bg-white/5">Log in</button></Link>
                <Link href="/register"><button className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-xl px-5 py-2 text-sm font-bold transition-all border border-purple-500/30 hover:scale-105 hover:shadow-[0_0_24px_rgba(139,92,246,0.4)]">Get started →</button></Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="lg:hidden flex items-center gap-2">
            <button className="flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10" onClick={() => setSearchOpen(true)}>
              <span className="text-zinc-600">🔍</span>
            </button>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
              <div className="space-y-1.5 w-6">
                <span className={`block h-0.5 bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block h-0.5 bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-[#040404]/98 backdrop-blur-2xl z-[100] flex flex-col p-6 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-200 lg:hidden">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xl font-black"
              style={{ background: "linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              ⬡ NexusAI
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={() => setMobileOpen(false)} className="text-zinc-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">✕</button>
            </div>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {Object.entries(MEGA_MENU).map(([key, menu]) => (
              <div key={key}>
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest px-3 py-2">{key}</p>
                {menu.items.map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-all">
                    <span>{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
            <Link href="/pricing" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-all">
              <span>💰</span><span className="text-sm font-medium">Pricing</span>
            </Link>
            <Link href="/services" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-all">
              <span>🏢</span><span className="text-sm font-medium">Services</span>
            </Link>
            <Link href="/cart" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-all">
              <span>🛒</span><span className="text-sm font-medium">Cart{itemCount > 0 ? ` (${itemCount})` : ""}</span>
            </Link>
          </nav>

          <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
            {isAuthenticated ? (
              <>
                {canAccessAdmin && (
                  <Link href="/admin">
                    <button className="w-full py-3 rounded-xl font-bold text-amber-400 bg-amber-400/10">
                      Admin Panel
                    </button>
                  </Link>
                )}
                <Link href="/dashboard"><button className="w-full py-3 rounded-xl font-bold text-zinc-300 bg-white/5">Dashboard</button></Link>
                <SignOutButton redirectUrl="/">
                  <button className="w-full py-3 rounded-xl font-bold text-red-400 bg-red-500/10">Sign out</button>
                </SignOutButton>
              </>
            ) : (
              <>
                <Link href="/login"><button className="w-full py-3 rounded-xl font-bold text-zinc-300 bg-white/5">Log in</button></Link>
                <Link href="/register"><button className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-xl px-5 py-3 text-sm font-bold transition-all border border-purple-500/30 w-full text-center block">Get started free →</button></Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Search modal */}
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchModal onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
