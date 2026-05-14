import {
  Zap,
  ShieldCheck,
  BarChart3,
  Bot,
  Globe,
  CreditCard,
  Headphones,
  Code2,
} from "lucide-react"

const features = [
  {
    icon: Bot,
    title: "AI Agent Marketplace",
    description:
      "Deploy pre-built AI agents for sales, support, content, and data analysis. Each agent is production-ready with configurable parameters and usage analytics.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: Zap,
    title: "One-Click Deployment",
    description:
      "Go from demo to production in seconds. No infrastructure management, no DevOps — just configure and ship.",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Live KPI dashboards, revenue charts, subscription cohorts, and user behaviour tracking — all in one place.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Security",
    description:
      "AES-256 encryption at rest, TLS 1.3 in transit, RBAC access control, 2FA, and full audit trails for every action.",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: CreditCard,
    title: "Flexible Billing",
    description:
      "Stripe and Razorpay support for global and Indian payments. Monthly, yearly, and per-use pricing models with coupon codes.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    icon: Globe,
    title: "Multi-Tenant CRM",
    description:
      "Built-in lead management, email sequences, pipeline stages, and deal scoring — no third-party CRM needed.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: Headphones,
    title: "Integrated Support",
    description:
      "Ticket management with priority queues, internal notes, file attachments, and AI-assisted reply suggestions.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Code2,
    title: "Developer-First APIs",
    description:
      "RESTful APIs with JWT auth, rate limiting, webhook support, and OpenAPI docs for every endpoint.",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
]

export default function FeaturesGrid() {
  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything your SaaS needs
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete platform — from marketplace to billing to support — built for modern
            AI-first businesses.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${f.bg} mb-4`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
