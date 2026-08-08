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
  const canSeeAdminPanel =
    userRole === "SUPER_ADMIN" ||
    (userRole === "SUB_ADMIN" && internalUser?.adminAccess?.panelEligible === true)
  const adminPanelHref = internalUser?.adminAccess?.allowed
    ? internalUser.adminAccess.landingPath ?? "/admin"
    : "/admin-access"
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

      {/* Floating Pill Top Navbar Container */}
      <header
        suppressHydrationWarning
        className="sticky top-3 z-50 w-full px-2 sm:px-4 max-w-7xl mx-auto transition-all duration-300"
        onMouseLeave={closeMenu}
      >
        <div
          className={`relative w-full rounded-full bg-background/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-sky-400/35 dark:border-sky-500/35 shadow-[0_8px_32px_rgba(56,189,248,0.22),0_0_20px_rgba(14,165,233,0.15)] px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2 xl:gap-3 transition-all duration-300 ${
            scrolled ? "shadow-[0_12px_40px_rgba(56,189,248,0.32)] border-sky-400/50 bg-background/95 dark:bg-zinc-900/95 ring-1 ring-sky-400/25" : ""
          }`}
        >
          {/* Sky Light Billowing Background Effect */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-sky-400/30 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute -bottom-12 left-1/3 w-56 h-56 bg-cyan-400/25 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1.5s' }} />
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/25 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '3s' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-sky-400/10 via-cyan-400/15 to-indigo-400/10 backdrop-blur-xl" />
          </div>

          {/* Logo */}
          <Link href="/" className="relative z-10 flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full hover:bg-muted/40 transition-colors">
            <span className="brand-gradient text-sm sm:text-base xl:text-lg font-black tracking-tight whitespace-nowrap">
              ⬡ ABHIBHIDEVELOPERS
            </span>
          </Link>

          {/* Desktop Nav with Pill Items & Glass Mega Menu */}
          <nav className="relative z-10 hidden lg:flex items-center gap-0.5 xl:gap-1 bg-muted/40 dark:bg-zinc-800/40 p-1 rounded-full border border-border/40 shrink-0">
            {Object.entries(MEGA_MENU).map(([key, menu]) => (
              <div key={key} className="relative">
                <button
                  className={`group relative px-2.5 xl:px-3.5 py-1 rounded-full flex items-center gap-1 text-xs xl:text-sm font-medium transition-all duration-200 ${
                    activeMega === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}
                  onMouseEnter={() => setActiveMega(key)}
                >
                  {key}
                  <svg
                    className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${
                      activeMega === key ? "rotate-180 text-foreground" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {activeMega === key && (
                  <div
                    className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-2xl border border-border/80 rounded-3xl p-5 min-w-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.25)] z-[200] animate-in fade-in slide-in-from-top-2 duration-200"
                    onMouseEnter={() => setActiveMega(key)}
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {menu.items.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-start gap-3 p-3 rounded-2xl transition-all duration-150 border border-transparent hover:bg-muted/70 hover:border-border/50"
                          onClick={closeMenu}
                        >
                          <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{item.label}</span>
                              {"badge" in item && item.badge && (
                                <span className="bg-green-500/20 text-green-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1">
                                  <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Link
              href="/pricing"
              className={`px-2.5 xl:px-3.5 py-1 rounded-full text-xs xl:text-sm font-medium transition-all duration-200 ${
                pathname === "/pricing"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              Pricing
            </Link>

            <Link
              href="/services"
              className={`px-2.5 xl:px-3.5 py-1 rounded-full text-xs xl:text-sm font-medium transition-all duration-200 ${
                pathname.startsWith("/services")
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              Services
            </Link>

            <Link
              href="/cart"
              className={`relative px-2.5 xl:px-3.5 py-1 rounded-full text-xs xl:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                pathname === "/cart"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              Cart
              {itemCount > 0 && (
                <span className="bg-purple-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center leading-none shadow-sm">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Right Section CTAs */}
          <div className="relative z-10 hidden lg:flex items-center gap-1.5 xl:gap-2 shrink-0">
            {/* Search Pill */}
            <button
              className="flex items-center gap-1.5 bg-muted/60 dark:bg-zinc-800/60 border border-border/50 rounded-full px-2.5 xl:px-3.5 py-1 cursor-pointer transition-all hover:bg-muted hover:border-purple-500/40 text-xs font-medium text-muted-foreground shrink-0"
              onClick={() => setSearchOpen(true)}
            >
              <span className="text-xs">🔍</span>
              <span className="hidden xl:inline">Search...</span>
              <kbd className="hidden xl:inline ml-0.5 text-[9px] text-muted-foreground/80 bg-background/80 px-1 py-0.5 rounded border border-border/40">⌘K</kbd>
            </button>

            <ThemeToggle />

            {isLoading ? (
              <div className="flex gap-1.5 shrink-0">
                <div className="h-7 w-16 rounded-full bg-muted animate-pulse" />
                <div className="h-7 w-20 rounded-full bg-muted animate-pulse" />
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-1.5 shrink-0">
                {canSeeAdminPanel && (
                  <Link href={adminPanelHref} className="shrink-0">
                    <button className="text-amber-500 rounded-full px-2.5 xl:px-3.5 py-1 text-xs xl:text-sm font-semibold transition-all border border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 whitespace-nowrap">
                      Admin Panel
                    </button>
                  </Link>
                )}
                <Link href="/dashboard" className="shrink-0">
                  <button className="text-foreground/80 rounded-full px-2.5 xl:px-3 py-1 text-xs xl:text-sm font-semibold transition-all hover:text-foreground hover:bg-muted/80 whitespace-nowrap">
                    Dashboard
                  </button>
                </Link>
                <div className="shrink-0 flex items-center">
                  <UserButton showName={false} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href="/login" className="shrink-0">
                  <button className="text-foreground/80 rounded-full px-2.5 xl:px-3 py-1 text-xs xl:text-sm font-semibold transition-all hover:text-foreground hover:bg-muted/80 whitespace-nowrap">
                    Log in
                  </button>
                </Link>
                <Link href="/register" className="shrink-0">
                  <button className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 hover:from-indigo-600 hover:to-amber-600 text-white rounded-full px-3.5 xl:px-4 py-1.5 text-xs xl:text-sm font-bold transition-all shadow-md hover:shadow-purple-500/25 hover:scale-[1.03] active:scale-[0.98] border border-white/20 whitespace-nowrap">
                    Get started →
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="relative z-10 lg:hidden flex items-center gap-2">
            <button
              className="flex items-center justify-center p-2 rounded-full bg-muted/60 border border-border/50"
              onClick={() => setSearchOpen(true)}
            >
              <span className="text-xs">🔍</span>
            </button>
            <button
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <div className="space-y-1.5 w-5">
                <span className={`block h-0.5 bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block h-0.5 bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-background/98 backdrop-blur-2xl z-[100] flex flex-col p-6 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-200 lg:hidden">
          <div className="flex justify-between items-center mb-6">
            <span className="brand-gradient text-xl font-black">
              ⬡ ABHIBHIDEVELOPERS GROUP
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xl w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {Object.entries(MEGA_MENU).map(([key, menu]) => (
              <div key={key}>
                <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest px-3 py-2">{key}</p>
                {menu.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-all"
                  >
                    <span>{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
            <Link
              href="/pricing"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-all"
            >
              <span>💰</span><span className="text-sm font-medium">Pricing</span>
            </Link>
            <Link
              href="/services"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-all"
            >
              <span>🏢</span><span className="text-sm font-medium">Services</span>
            </Link>
            <Link
              href="/cart"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-all"
            >
              <span>🛒</span><span className="text-sm font-medium">Cart{itemCount > 0 ? ` (${itemCount})` : ""}</span>
            </Link>
          </nav>

          <div className="flex flex-col gap-3 pt-6 border-t border-border/40">
            {isAuthenticated ? (
              <>
                {canSeeAdminPanel && (
                  <Link href={adminPanelHref}>
                    <button className="w-full py-3 rounded-full font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20">
                      Admin Panel
                    </button>
                  </Link>
                )}
                <Link href="/dashboard">
                  <button className="w-full py-3 rounded-full font-bold text-foreground bg-muted">Dashboard</button>
                </Link>
                <SignOutButton redirectUrl="/">
                  <button className="w-full py-3 rounded-full font-bold text-red-500 bg-red-500/10 border border-red-500/20">Sign out</button>
                </SignOutButton>
              </>
            ) : (
              <>
                <Link href="/login">
                  <button className="w-full py-3 rounded-full font-bold text-foreground bg-muted">Log in</button>
                </Link>
                <Link href="/register">
                  <button className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 text-white rounded-full px-5 py-3 text-sm font-bold transition-all w-full text-center block shadow-md">Get started free →</button>
                </Link>
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

