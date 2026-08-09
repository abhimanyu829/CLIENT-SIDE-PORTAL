"use client"

import { useRef } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Github,
  Youtube,
  Send,
  ShieldCheck,
  Zap,
  Lock,
  Globe,
  CreditCard,
} from "lucide-react"

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
  { label: "SOC 2 Type II", icon: Lock },
  { label: "GDPR Compliant", icon: Globe },
  { label: "99.9% Uptime SLA", icon: Zap },
  { label: "Secured payment", icon: CreditCard },
]

const SOCIALS = [
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: Github, href: "https://github.com", label: "GitHub" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
]

export default function Footer() {
  const year = new Date().getFullYear()
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"],
  })

  const truckY = useTransform(scrollYProgress, [0, 1], [-50, 150])

  return (
    <footer
      ref={containerRef}
      suppressHydrationWarning
      className="relative w-full bg-[#f8f9fa] dark:bg-zinc-950 overflow-hidden"
    >
      {/* Main Parallax Container with Orange Hills Background */}
      <div
        className="relative min-h-screen w-full bg-cover bg-center overflow-hidden pt-12 md:pt-24 pb-20 flex flex-col justify-between"
        style={{
          backgroundImage: `url("https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260430_115327_3f256636-9e63-4885-8d0b-09317dc2b0a5.png&w=1280&q=85")`,
        }}
      >
        {/* Top-Aligned Floating Footer Card */}
        <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
            className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm shadow-xl rounded-2xl md:rounded-3xl border border-gray-100 dark:border-zinc-800/80 overflow-hidden"
          >
            {/* Stats bar inside card */}
            <div className="border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/40 px-6 py-6 sm:px-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["10x", "Faster Workflow", "🚀"],
                  ["80%", "Cost Saved", "📉"],
                  ["<50ms", "Average Latency", "⚡"],
                  ["0", "Manual Steps", "🪄"],
                ].map(([val, label, icon]) => (
                  <div
                    key={label}
                    className="bg-white dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700/60 rounded-2xl p-4 text-center shadow-xs transition-all duration-300 hover:shadow-md hover:border-orange-500/30"
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="text-base">{icon}</span>
                      <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {val}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Content (Top Half) */}
            <div className="p-6 sm:p-10 md:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-10 lg:gap-12">
                {/* Brand Column */}
                <div className="lg:col-span-2 space-y-6">
                  <Link href="/" className="flex items-center gap-3 w-fit group">
                    <div className="bg-orange-500 w-10 h-10 md:w-12 md:h-12 rounded-xl shadow-inner p-2.5 flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors duration-300">
                      <svg viewBox="0 0 256 256" className="w-full h-full text-white fill-current">
                        <path d="M 228 0 C 172.772 0 128 44.772 128 100 L 128 0 L 0 0 L 0 28 C 0 83.228 44.772 128 100 128 L 0 128 L 0 256 L 28 256 C 83.228 256 128 211.228 128 156 L 128 256 L 256 256 L 256 228 C 256 172.772 211.228 128 156 128 L 256 128 L 256 0 Z" />
                      </svg>
                    </div>
                    <span className="text-gray-900 dark:text-white text-xl sm:text-2xl md:text-3xl font-bold tracking-tighter">
                      ABHIBHIDEVELOPERS GROUP
                    </span>
                  </Link>

                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-normal">
                    The enterprise AI SaaS marketplace. Deploy AI agents, monetize tools, and scale your business with production-grade infrastructure.
                  </p>

                  {/* Newsletter */}
                  <div className="space-y-2.5 pt-2">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-300 uppercase tracking-widest">
                      Stay in the loop
                    </p>
                    <div className="flex gap-2 max-w-md">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                      />
                      <button className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl whitespace-nowrap shadow-md hover:shadow-orange-500/25 transition-all duration-200 flex items-center gap-1.5 shrink-0 active:scale-95">
                        <span>Subscribe</span>
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-500">
                      No spam. Product updates & AI insights only.
                    </p>
                  </div>
                </div>

                {/* Links Columns */}
                {FOOTER_LINKS.map((group) => (
                  <div key={group.section} className="space-y-4">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-200 uppercase tracking-widest">
                      {group.section}
                    </p>
                    <ul className="space-y-2.5">
                      {group.items.map(([label, href]) => (
                        <li key={href}>
                          <Link
                            href={href}
                            className="text-gray-500 dark:text-gray-400 font-medium text-sm hover:text-orange-600 dark:hover:text-orange-400 transition-colors duration-200 block"
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Trust Badges */}
              <div className="mt-10 pt-6 border-t border-gray-100 dark:border-zinc-800/80">
                <div className="flex flex-wrap gap-2.5">
                  {TRUST_BADGES.map((b) => {
                    const IconComponent = b.icon
                    return (
                      <span
                        key={b.label}
                        className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/80 dark:border-zinc-700/60 rounded-xl px-3.5 py-1.5 inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 hover:border-orange-500/40 hover:text-orange-600 dark:hover:text-orange-400"
                      >
                        <IconComponent className="w-3.5 h-3.5 text-orange-500" />
                        <span>{b.label}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer Content (Bottom Bar) */}
            <div className="border-t border-gray-100 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 px-6 py-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium text-center sm:text-left">
                © {year} ABHIBHIDEVELOPERS GROUP. All Rights Reserved. Built with ❤️ for AI developers worldwide.
              </p>

              {/* Social Icons mapped as 40x40px circles */}
              <div className="flex items-center gap-2.5">
                {SOCIALS.map((s) => {
                  const IconComponent = s.icon
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-zinc-800 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-all duration-300 hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/25 hover:scale-105"
                    >
                      <IconComponent className="w-5 h-5" />
                    </a>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Background Truck Parallax Layer */}
        <motion.div
          style={{ y: truckY }}
          className="absolute inset-x-0 bottom-0 h-full pointer-events-none z-20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://roof-wish-40038865.figma.site/_components/v2/f31fd17907ce60745d45e83a61d44fd3810d5f25/truck_1.8c4bff83.png"
            alt="Truck Parallax"
            className="w-full h-full object-contain object-bottom origin-bottom scale-[1.5] sm:scale-110 md:scale-[2.0] lg:scale-105"
          />
        </motion.div>
      </div>
    </footer>
  )
}


