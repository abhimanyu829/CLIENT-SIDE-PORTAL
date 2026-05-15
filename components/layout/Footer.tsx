import Link from "next/link"

const LINKS = [
  { section: "Product",   items: [["Marketplace","/marketplace"],["AI Agents","/ai-agents"],["Demos","/demo"],["Pricing","/#pricing"]] },
  { section: "Resources", items: [["Blog","/blog"],["Docs","/docs"],["API Reference","/docs/api"],["Status","https://status.nexusai.app"]] },
  { section: "Company",   items: [["About","/about"],["Careers","/careers"],["Contact","/contact"],["Privacy","/privacy"]] },
]

const SOCIALS = [
  { icon:"𝕏", href:"https://twitter.com" },
  { icon:"in", href:"https://linkedin.com" },
  { icon:"⊡", href:"https://github.com" },
]

const S = `
.f-glass{background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.05)}
.f-link{color:rgba(255,255,255,.4);font-size:.8125rem;transition:color .2s}
.f-link:hover{color:rgba(255,255,255,.9)}
`

export default function Footer() {
  return (
    <footer className="f-glass mt-auto" style={{background:"rgba(4,4,4,.95)"}}>
      <style>{S}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <span className="text-xl font-black" style={{background:"linear-gradient(135deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>⬡ NexusAI</span>
            </Link>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-xs mb-6">
              The enterprise AI SaaS marketplace. Deploy agents, manage subscriptions, and scale intelligently.
            </p>
            <div className="flex gap-3">
              {SOCIALS.map(s => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl border border-white/8 flex items-center justify-center text-zinc-600 hover:text-white hover:border-white/20 transition-all text-xs font-bold">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {LINKS.map(group => (
            <div key={group.section}>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">{group.section}</p>
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

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10 border-t border-white/5">
          <p className="text-xs text-zinc-700">© {new Date().getFullYear()} NexusAI Inc. All rights reserved.</p>
          <div className="flex gap-5">
            {[["Terms","/terms"],["Privacy","/privacy"],["Cookies","/cookies"]].map(([l,h])=>(
              <Link key={h} href={h} className="f-link">{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
