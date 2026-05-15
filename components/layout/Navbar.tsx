"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/ai-agents",   label: "AI Agents" },
  { href: "/demo",        label: "Demos" },
  { href: "/blog",        label: "Blog" },
]

const S = `
.n-glass{background:rgba(8,8,8,.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.n-link{position:relative;color:rgba(255,255,255,.5);transition:color .2s}
.n-link:hover{color:rgba(255,255,255,.9)}
.n-link::after{content:'';position:absolute;bottom:-4px;left:0;width:0;height:1px;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:width .25s}
.n-link:hover::after{width:100%}
.n-link-active{color:rgba(255,255,255,.95)}
.n-link-active::after{width:100%}
.n-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:.75rem;padding:.5rem 1.25rem;font-size:.875rem;font-weight:700;transition:all .2s}
.n-btn-primary:hover{transform:scale(1.04);box-shadow:0 0 20px rgba(139,92,246,.3)}
.n-btn-ghost{color:rgba(255,255,255,.6);border-radius:.75rem;padding:.5rem 1rem;font-size:.875rem;font-weight:600;transition:color .2s}
.n-btn-ghost:hover{color:#fff}
.n-mobile{position:fixed;inset:0;background:rgba(8,8,8,.97);backdrop-filter:blur(30px);z-index:100;display:flex;flex-direction:column;padding:1.5rem}
@keyframes nslide{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}.n-mobile{animation:nslide .2s ease-out}
`

export default function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <>
      <style>{S}</style>

      <header className={`sticky top-0 z-50 w-full n-glass transition-all ${scrolled ? "shadow-lg shadow-black/20" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-black" style={{background:"linear-gradient(135deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>⬡ NexusAI</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={`n-link text-sm font-medium ${pathname.startsWith(href) ? "n-link-active" : ""}`}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-2">
            {status === "loading" ? (
              <div className="flex gap-2">
                <div className="h-8 w-20 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-8 w-24 rounded-xl bg-white/5 animate-pulse" />
              </div>
            ) : session ? (
              <>
                <Link href="/dashboard"><button className="n-btn-ghost">Dashboard</button></Link>
                <button onClick={() => signOut()} className="n-btn-ghost">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login"><button className="n-btn-ghost">Log in</button></Link>
                <Link href="/register"><button className="n-btn-primary">Get started</button></Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <div className="space-y-1.5">
              <span className={`block h-0.5 w-6 bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
              <span className={`block h-0.5 w-6 bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-6 bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="n-mobile">
          <div className="flex justify-between items-center mb-8">
            <span className="text-lg font-black" style={{background:"linear-gradient(135deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>⬡ NexusAI</span>
            <button onClick={() => setMobileOpen(false)} className="text-zinc-500 hover:text-white text-2xl">✕</button>
          </div>
          <nav className="flex flex-col gap-1 flex-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href}
                className="px-4 py-3.5 rounded-xl text-lg font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-all">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
            {session ? (
              <>
                <Link href="/dashboard"><button className="w-full py-3 rounded-xl font-bold text-zinc-300 bg-white/5">Dashboard</button></Link>
                <button onClick={() => signOut()} className="w-full py-3 rounded-xl font-bold text-red-400 bg-red-500/10">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login"><button className="w-full py-3 rounded-xl font-bold text-zinc-300 bg-white/5">Log in</button></Link>
                <Link href="/register"><button className="n-btn-primary w-full py-3 rounded-xl font-bold text-center block">Get started free →</button></Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
