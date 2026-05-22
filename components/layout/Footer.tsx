import Link from "next/link"

const FOOTER_LINKS = [
  {
    section: "Platform",
    items: [
      ["Marketplace", "/marketplace"],
      ["AI Agents", "/ai-agents"],
      ["SaaS Tools", "/marketplace?type=SAAS"],
      ["API Products", "/marketplace?type=API"],
      ["Automation", "/marketplace?type=AUTOMATION"],
      ["Enterprise", "/solutions/enterprise"],
    ],
  },
  {
    section: "Resources",
    items: [
      ["Blog", "/blog"],
      ["Documentation", "/docs"],
      ["API Reference", "/docs/api"],
      ["Live Demos", "/demo"],
      ["Compare Products", "/compare"],
      ["Status Page", "https://status.nexusai.app"],
    ],
  },
  {
    section: "Company",
    items: [
      ["About Us", "/about"],
      ["Careers", "/careers"],
      ["Partners", "/partners"],
      ["Affiliate Program", "/affiliates"],
      ["Contact Sales", "/contact"],
      ["Press Kit", "/press"],
    ],
  },
  {
    section: "Legal",
    items: [
      ["Terms of Service", "/terms"],
      ["Privacy Policy", "/privacy"],
      ["Cookie Policy", "/cookies"],
      ["GDPR", "/gdpr"],
      ["Security", "/security"],
      ["Refund Policy", "/refunds"],
    ],
  },
]

const TRUST_BADGES = [
  { label: "SOC 2 Type II", icon: "🔒" },
  { label: "GDPR Compliant", icon: "🇪🇺" },
  { label: "99.9% Uptime SLA", icon: "⚡" },
  { label: "Stripe Secured", icon: "💳" },
  { label: "ISO 27001", icon: "🛡️" },
]

const SOCIALS = [
  { icon: "𝕏", href: "https://twitter.com", label: "Twitter" },
  { icon: "in", href: "https://linkedin.com", label: "LinkedIn" },
  { icon: "⊡", href: "https://github.com", label: "GitHub" },
  { icon: "▶", href: "https://youtube.com", label: "YouTube" },
]

const S = `
.f-glass{background:rgba(4,4,4,.97);border-top:1px solid rgba(255,255,255,.05)}
.f-link{color:rgba(255,255,255,.38);font-size:.8125rem;transition:color .18s;display:inline-block}
.f-link:hover{color:rgba(255,255,255,.85);transform:translateX(2px)}
.trust-badge{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:.75rem;padding:.375rem .875rem;display:inline-flex;align-items:center;gap:.375rem;font-size:.75rem;color:rgba(255,255,255,.45);transition:all .2s}
.trust-badge:hover{border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.75)}
.social-btn{width:2.25rem;height:2.25rem;border-radius:.625rem;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.45);font-size:.75rem;font-weight:700;transition:all .2s}
.social-btn:hover{border-color:rgba(139,92,246,.5);color:#a78bfa;background:rgba(139,92,246,.08);transform:translateY(-2px)}
.stat-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:.875rem;padding:.75rem 1.25rem;text-align:center}
.newsletter-input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:.75rem;padding:.625rem 1rem;color:#fff;font-size:.875rem;outline:none;transition:border-color .2s}
.newsletter-input:focus{border-color:rgba(139,92,246,.5)}
.newsletter-input::placeholder{color:rgba(255,255,255,.25)}
`

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="f-glass">
      <style>{S}</style>

      {/* Stats bar */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["12K+", "Developers", "🧑‍💻"],
              ["500+", "AI Products", "🤖"],
              ["$2M+", "Creator Revenue", "💰"],
              ["99.9%", "Uptime SLA", "⚡"],
            ].map(([val, label, icon]) => (
              <div key={label} className="stat-card">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-base">{icon}</span>
                  <span className="text-xl font-black text-white">{val}</span>
                </div>
                <p className="text-xs text-zinc-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-12">

          {/* Brand column */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-2 w-fit">
              <span className="text-xl font-black"
                style={{ background: "linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                ⬡ NexusAI
              </span>
            </Link>
            <p className="text-sm text-zinc-600 leading-relaxed">
              The enterprise AI SaaS marketplace. Deploy AI agents, monetize tools, and scale your business with production-grade infrastructure.
            </p>

            {/* Newsletter */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stay in the loop</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Enter your email" className="newsletter-input" />
                <button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl whitespace-nowrap hover:scale-105 transition-all flex-shrink-0">
                  Subscribe
                </button>
              </div>
              <p className="text-[10px] text-zinc-700">No spam. Product updates & AI insights only.</p>
            </div>

            {/* Socials */}
            <div className="flex gap-2">
              {SOCIALS.map(s => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="social-btn">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map(group => (
            <div key={group.section}>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-5">{group.section}</p>
              <ul className="space-y-2.5">
                {group.items.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="f-link">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-wrap gap-2 mb-8">
            {TRUST_BADGES.map(b => (
              <span key={b.label} className="trust-badge">
                <span>{b.icon}</span>
                <span>{b.label}</span>
              </span>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-700">
              © {year} NexusAI Inc. All rights reserved. Built with ❤️ for AI developers worldwide.
            </p>
            <div className="flex gap-5">
              {[["Terms", "/terms"], ["Privacy", "/privacy"], ["Cookies", "/cookies"], ["Security", "/security"]].map(([l, h]) => (
                <Link key={h} href={h} className="f-link">{l}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
