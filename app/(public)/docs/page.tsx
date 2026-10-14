import React from "react"
import { Metadata } from "next"
import Link from "next/link"
import {
  BookOpen,
  Zap,
  Bot,
  ShoppingBag,
  CreditCard,
  Users,
  BarChart3,
  Ticket,
  HeartHandshake,
  Globe2,
  Settings,
  ShieldCheck,
  Megaphone,
  ChevronRight,
  Layers,
  MessageSquare,
  Star,
  PlayCircle,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Documentation — Abhibhi Developers",
  description:
    "Learn how to use the Abhibhi Developers platform. Guides on AI agents, marketplace, billing, subscriptions, and more.",
}

const NAV = [
  {
    heading: "Getting Started",
    links: [
      { label: "Platform Overview", anchor: "#overview" },
      { label: "Creating Your Account", anchor: "#account" },
      { label: "Dashboard Walkthrough", anchor: "#dashboard" },
      { label: "Your First Product", anchor: "#first-product" },
    ],
  },
  {
    heading: "Marketplace",
    links: [
      { label: "Listing a Product", anchor: "#listing" },
      { label: "Pricing & Tiers", anchor: "#pricing-tiers" },
      { label: "Reviews & Ratings", anchor: "#reviews" },
      { label: "Featured & Badges", anchor: "#badges" },
    ],
  },
  {
    heading: "AI Agents",
    links: [
      { label: "What Are AI Agents?", anchor: "#agents-intro" },
      { label: "Using the Agent Gateway", anchor: "#agent-gateway" },
      { label: "Deploying Your Agent", anchor: "#deploy-agent" },
      { label: "Agent Analytics", anchor: "#agent-analytics" },
    ],
  },
  {
    heading: "Billing & Payments",
    links: [
      { label: "Subscriptions", anchor: "#subscriptions" },
      { label: "Razorpay & UPI", anchor: "#razorpay" },
      { label: "Invoices & Receipts", anchor: "#invoices" },
      { label: "Refund Policy", anchor: "#refunds" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Raising a Ticket", anchor: "#tickets" },
      { label: "Live Chat", anchor: "#chat" },
      { label: "Contact Us", anchor: "#contact" },
    ],
  },
]

const QUICK_LINKS = [
  { icon: BookOpen, title: "Platform Overview", desc: "Understand the full scope of what Abhibhi Developers offers — from marketplace to AI agents.", color: "text-violet-400", border: "hover:border-violet-500/50", anchor: "#overview" },
  { icon: ShoppingBag, title: "Marketplace Guide", desc: "Learn how to list products, set pricing tiers, manage reviews, and get featured.", color: "text-blue-400", border: "hover:border-blue-500/50", anchor: "#listing" },
  { icon: Bot, title: "AI Agents", desc: "Deploy intelligent agents that handle support, sales, and automation for your business.", color: "text-emerald-400", border: "hover:border-emerald-500/50", anchor: "#agents-intro" },
  { icon: CreditCard, title: "Billing & Subscriptions", desc: "Everything about payments, subscription plans, invoices, and refunds.", color: "text-amber-400", border: "hover:border-amber-500/50", anchor: "#subscriptions" },
  { icon: BarChart3, title: "Analytics", desc: "Track revenue, buyer activity, agent performance, and product conversions.", color: "text-rose-400", border: "hover:border-rose-500/50", anchor: "#agent-analytics" },
  { icon: HeartHandshake, title: "Support & Help", desc: "How to reach our team, raise a ticket, and get priority assistance.", color: "text-pink-400", border: "hover:border-pink-500/50", anchor: "#tickets" },
]

export default function DocsPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">

      {/* ── HERO ──────────────────────────────────────── */}
      <div className="relative pt-32 pb-16 px-6 text-center border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-violet-600/15 blur-[100px]" />
        </div>
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <BookOpen className="w-3.5 h-3.5" /> Platform Documentation
          </span>
          <h1 className="text-5xl font-black mb-4">Abhibhi Developers Docs</h1>
          <p className="text-zinc-400 max-w-xl mx-auto text-lg">
            Everything you need to sell, automate, and grow with the Abhibhi Developers platform.
          </p>
        </div>
      </div>

      {/* ── QUICK LINK CARDS ──────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {QUICK_LINKS.map(({ icon: Icon, title, desc, color, border, anchor }) => (
            <a
              key={title}
              href={anchor}
              className={`p-6 rounded-2xl bg-white/[0.02] border border-white/10 ${border} transition-colors group cursor-pointer block`}
            >
              <Icon className={`w-8 h-8 ${color} mb-4`} />
              <h4 className="font-bold mb-2 group-hover:text-white transition-colors">{title}</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </a>
          ))}
        </div>

        {/* ── TWO-COL LAYOUT ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Sidebar Nav */}
          <aside className="hidden md:block col-span-1 sticky top-24 self-start">
            {NAV.map(({ heading, links }) => (
              <div key={heading} className="mb-7">
                <h3 className="font-bold text-white text-xs uppercase tracking-widest mb-3">{heading}</h3>
                <ul className="space-y-2">
                  {links.map(({ label, anchor }) => (
                    <li key={label}>
                      <a
                        href={anchor}
                        className="text-sm text-zinc-500 hover:text-violet-400 flex items-center gap-1 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          {/* Main Content */}
          <div className="col-span-1 md:col-span-3 space-y-16">

            {/* ── OVERVIEW ─────────────────────────── */}
            <section id="overview">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <Globe2 className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-black">Platform Overview</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Abhibhi Developers is an all-in-one platform that lets individuals, creators, and businesses sell digital products and AI-powered tools through a curated marketplace, while automating their operations with intelligent AI agents.
              </p>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Whether you are a solo creator selling Notion templates, a startup shipping a SaaS product, or an enterprise deploying AI automation — Abhibhi Developers gives you the infrastructure, distribution, and payments layer to run your entire business.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                {[
                  { label: "Marketplace", desc: "List and sell digital products to thousands of buyers." },
                  { label: "AI Agents", desc: "Automate support, sales, and operations with intelligent agents." },
                  { label: "Subscriptions", desc: "Launch recurring revenue with one-click billing setup." },
                ].map(({ label, desc }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
                    <p className="font-bold text-white text-sm mb-1">{label}</p>
                    <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-white/5" />

            {/* ── ACCOUNT ──────────────────────────── */}
            <section id="account">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-black">Creating Your Account</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Sign up at <Link href="/register" className="text-violet-400 hover:underline">abhibhideveloper.tech/register</Link>. You can sign in with your email or via Google. No credit card is required to create an account or explore the platform.
              </p>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Enter your name, email address, and a secure password." },
                  { step: "2", text: "Verify your email address using the link sent to your inbox." },
                  { step: "3", text: "Complete your seller profile — add a bio, profile photo, and payout details." },
                  { step: "4", text: "You are now ready to list products or browse the marketplace." },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3 bg-white/[0.02] border border-white/8 rounded-xl p-4">
                    <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-black flex items-center justify-center flex-shrink-0">{step}</span>
                    <p className="text-zinc-300 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-white/5" />

            {/* ── DASHBOARD ────────────────────────── */}
            <section id="dashboard">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black">Dashboard Walkthrough</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-5">
                Your dashboard is the central hub for managing every part of your business. Here is what you will find in each section:
              </p>
              <div className="space-y-4">
                {[
                  { icon: BarChart3, label: "Overview", color: "text-violet-400 bg-violet-500/10", desc: "A snapshot of your revenue, active subscriptions, and recent buyer activity at a glance." },
                  { icon: ShoppingBag, label: "My Products", color: "text-blue-400 bg-blue-500/10", desc: "View, edit, and manage all your marketplace listings. Check views, purchases, and conversion rates per product." },
                  { icon: CreditCard, label: "Subscriptions", color: "text-amber-400 bg-amber-500/10", desc: "See all active subscriber plans, upcoming renewals, and payment history." },
                  { icon: Ticket, label: "Support Tickets", color: "text-rose-400 bg-rose-500/10", desc: "Track open tickets from buyers and respond directly from the dashboard." },
                  { icon: Bot, label: "AI Agents", color: "text-emerald-400 bg-emerald-500/10", desc: "Monitor your deployed AI agents, view call logs, and adjust configurations." },
                  { icon: MessageSquare, label: "Inbox", color: "text-pink-400 bg-pink-500/10", desc: "View messages from buyers, support team, and system notifications." },
                ].map(({ icon: Icon, label, color, desc }) => (
                  <div key={label} className="flex items-start gap-4 bg-white/[0.02] border border-white/8 rounded-xl p-5 hover:border-white/15 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm mb-1">{label}</p>
                      <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-white/5" />

            {/* ── FIRST PRODUCT ─────────────────────── */}
            <section id="first-product">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-2xl font-black">Your First Product</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-5">
                Getting your first product live on the Abhibhi marketplace takes under 10 minutes. You can sell AI tools, SaaS subscriptions, digital downloads, services, or courses.
              </p>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Go to My Products", desc: "From your dashboard, click 'My Products' then 'New Product'." },
                  { step: "2", title: "Fill in the basics", desc: "Add your product name, a clear tagline, a detailed description, and a thumbnail image." },
                  { step: "3", title: "Set pricing", desc: "Choose a one-time price, add a discount, or set up subscription tiers (monthly / annual)." },
                  { step: "4", title: "Add features", desc: "List what buyers get — features, limits, and what makes your product unique." },
                  { step: "5", title: "Publish", desc: "Submit for review. Most listings go live within a few hours. You will receive an email confirmation." },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-3 bg-white/[0.02] border border-white/8 rounded-xl p-4">
                    <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center flex-shrink-0">{step}</span>
                    <div>
                      <p className="font-bold text-white text-sm mb-0.5">{title}</p>
                      <p className="text-zinc-500 text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-white/5" />

            {/* ── MARKETPLACE ──────────────────────── */}
            <section id="listing">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-2xl font-black">Marketplace Guide</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-5">
                The Abhibhi marketplace is where buyers discover and purchase products. Your listing competes on quality, pricing, and ratings. Here is how to maximise your visibility and conversions.
              </p>

              <h3 id="pricing-tiers" className="text-lg font-bold mb-3 mt-6">Pricing & Tiers</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                You can create multiple pricing tiers for a single product — for example, a Basic plan, a Pro plan, and an Enterprise plan. Each tier can have its own price, feature set, and usage limits. Buyers choose the tier that suits them, and you can upsell them to higher plans at any time.
              </p>

              <h3 id="reviews" className="text-lg font-bold mb-3 mt-6">Reviews & Ratings</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                After purchasing, buyers can leave a star rating and written review. Products with higher ratings appear higher in search results. Respond to reviews professionally to build trust with future buyers. You cannot remove reviews, but you can flag inappropriate ones for moderation.
              </p>

              <h3 id="badges" className="text-lg font-bold mb-3 mt-6">Featured & Badges</h3>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                {[
                  { badge: "⭐ Featured", desc: "Awarded by our team to high-quality, well-documented products." },
                  { badge: "🔥 Trending", desc: "Automatically given to products with rapid sales growth in the past 7 days." },
                  { badge: "🏆 Best Seller", desc: "Awarded when your product is among the top sellers in its category." },
                  { badge: "👑 PRO", desc: "Reserved for premium, enterprise-grade tools with advanced capabilities." },
                ].map(({ badge, desc }) => (
                  <div key={badge} className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
                    <p className="font-bold text-white text-sm mb-1">{badge}</p>
                    <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-white/5" />

            {/* ── AI AGENTS ────────────────────────── */}
            <section id="agents-intro">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-black">AI Agents</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-4">
                AI Agents are intelligent assistants that you can deploy to automate repetitive tasks in your business. They can answer buyer questions, qualify leads, resolve support tickets, send follow-up messages, and much more — all without you lifting a finger.
              </p>
              <p className="text-zinc-400 leading-relaxed mb-5">
                Agents are configured through the Abhibhi dashboard. You define what they know (your product details, FAQs, policies) and what they can do (reply to messages, escalate to you, send emails). No coding is required.
              </p>

              <h3 id="agent-gateway" className="text-lg font-bold mb-3 mt-6">Agent Gateway</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                The Agent Gateway is the central system that routes all AI agent traffic. When a buyer sends a message or triggers an automation, the Gateway decides which agent handles the request, checks permissions, logs the interaction, and returns a response — all in milliseconds.
              </p>

              <h3 id="deploy-agent" className="text-lg font-bold mb-3 mt-6">Deploying Your Agent</h3>
              <div className="space-y-3">
                {[
                  { step: "1", desc: "From your dashboard, go to AI Agents → New Agent." },
                  { step: "2", desc: "Choose an agent type: Support Bot, Sales Assistant, Onboarding Guide, or Custom." },
                  { step: "3", desc: "Give your agent a name, describe its role, and add your product knowledge (FAQs, policies, product details)." },
                  { step: "4", desc: "Set the agent's tone (friendly, professional, concise) and response limits." },
                  { step: "5", desc: "Activate the agent and embed it on your marketplace listing or product page." },
                ].map(({ step, desc }) => (
                  <div key={step} className="flex items-start gap-3 bg-white/[0.02] border border-white/8 rounded-xl p-4">
                    <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-black flex items-center justify-center flex-shrink-0">{step}</span>
                    <p className="text-zinc-300 text-sm leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <h3 id="agent-analytics" className="text-lg font-bold mb-3 mt-8">Agent Analytics</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Every agent interaction is logged. In your dashboard you can see total conversations, resolution rate (how often the agent answered without escalating to you), average response time, most common questions, and buyer satisfaction scores. Use this data to improve your agent's knowledge base over time.
              </p>
            </section>

            <hr className="border-white/5" />

            {/* ── BILLING ──────────────────────────── */}
            <section id="subscriptions">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black">Billing & Payments</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-5">
                Abhibhi Developers handles all payment processing for you. You set your prices, we collect payments, handle taxes, and transfer your earnings to your bank account.
              </p>

              <h3 className="text-lg font-bold mb-3">Subscriptions</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                You can offer monthly or annual subscription plans on any product. Buyers are automatically charged on renewal. If a payment fails, they receive automated retry notifications. You can pause, cancel, or upgrade a subscriber's plan from your dashboard at any time.
              </p>

              <h3 id="razorpay" className="text-lg font-bold mb-3 mt-6">Razorpay & UPI Payments</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                All Indian payments are processed via Razorpay. Buyers can pay using UPI, credit/debit cards, net banking, or wallets. International buyers can pay via Stripe. No setup is required from your side — payments are enabled the moment your account is verified.
              </p>

              <h3 id="invoices" className="text-lg font-bold mb-3 mt-6">Invoices & Receipts</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                Every successful transaction automatically generates a branded invoice with your business name, buyer details, GST-ready line items, and a unique invoice number. Buyers can download their invoice from their dashboard. You can export all invoices as a CSV from your Billing section.
              </p>

              <h3 id="refunds" className="text-lg font-bold mb-3 mt-6">Refund Policy</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Refund requests can be submitted by buyers within 7 days of purchase for digital products that were not as described. As a seller, you will be notified and can respond within 48 hours before a decision is made. Abhibhi Developers' team mediates disputes fairly. Subscription cancellations take effect at the end of the current billing period — no partial refunds for used subscription time.
              </p>
            </section>

            <hr className="border-white/5" />

            {/* ── SUPPORT ──────────────────────────── */}
            <section id="tickets">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-pink-500/15 flex items-center justify-center">
                  <HeartHandshake className="w-5 h-5 text-pink-400" />
                </div>
                <h2 className="text-2xl font-black">Support & Help</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-5">
                We are committed to helping you succeed on the platform. Here is how to get help when you need it.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Ticket, color: "text-violet-400 bg-violet-500/10", title: "Raise a Ticket", desc: "For account issues, billing disputes, or product moderation queries, open a ticket from Dashboard → Support Tickets. We respond within 24 hours on business days." },
                  { icon: MessageSquare, color: "text-blue-400 bg-blue-500/10", title: "Live Chat", id: "chat", desc: "Use the chat icon in the bottom-right corner of any page to talk to our support team in real time during business hours (Mon–Sat, 9 AM – 7 PM IST)." },
                  { icon: Star, color: "text-amber-400 bg-amber-500/10", title: "Priority Support", desc: "Pro and Scale plan subscribers get priority queue access and a dedicated point of contact for onboarding and technical questions." },
                  { icon: Megaphone, color: "text-rose-400 bg-rose-500/10", title: "Contact Us", id: "contact", desc: "Business Support: support@abhibhideveloper.tech · Direct Contact: luckypal5002@gmail.com — or use the Contact page for partnership and media enquiries. Both emails open via mailto: from the Contact page." },
                ].map(({ icon: Icon, color, title, desc, id }) => (
                  <div key={title} id={id} className="flex items-start gap-4 bg-white/[0.02] border border-white/8 rounded-xl p-5 hover:border-white/15 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm mb-1">{title}</p>
                      <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── BOTTOM CTA ───────────────────────── */}
            <div className="relative bg-gradient-to-br from-violet-600/10 to-purple-900/10 border border-violet-500/20 rounded-2xl p-10 text-center mt-8">
              <PlayCircle className="w-10 h-10 text-violet-400 mx-auto mb-4" />
              <h3 className="text-2xl font-black mb-2">Can't find what you need?</h3>
              <p className="text-zinc-400 mb-6">Our team is ready to help. Reach out and we'll get back to you the same day.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/contact-sales" className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm shadow-lg shadow-violet-500/20">
                  Contact Support
                </Link>
                <Link href="/marketplace" className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:border-violet-500/40 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm">
                  Browse Marketplace
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
