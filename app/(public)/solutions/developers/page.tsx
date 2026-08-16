import Link from "next/link"
import {
  Code2,
  Terminal,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Server,
  Database,
  Lock,
  Workflow,
  ExternalLink,
  BookOpen,
  Rocket,
  Activity,
  Globe2,
} from "lucide-react"

export const metadata = {
  title: "NexusAI for Developers — Built for Engineers, Powered by AI",
  description: "Accelerate your AI application development with pre-built agent SDKs, isolated sandboxes, unified billing, and enterprise-grade infrastructure.",
}

const CODE_EXAMPLES = {
  typescript: `import { NexusClient } from "@nexusai/sdk"

const nexus = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY,
  environment: "production",
})

// Initialize autonomous agent workflow in 3 lines
const agent = await nexus.agents.deploy({
  name: "Customer Support AI",
  type: "AI_AGENT",
  capabilities: ["RAG_SEARCH", "TICKET_AUTO_RESOLUTION"],
  model: "gpt-4o",
})

console.log(\`Agent live at: \${agent.endpoint}\`)`,

  python: `from nexusai import NexusClient

client = NexusClient(api_key="nx_live_secret_key")

# Stream real-time agent output with sub-50ms latency
response = client.agents.run_stream(
    agent_id="sales-crm-bot",
    prompt="Qualify lead: enterprise SaaS request",
    sandbox=True
)

for chunk in response.stream():
    print(chunk.text, end="", flush=True)`,

  curl: `curl -X POST https://api.nexusai.dev/v1/sandboxes/provision \\
  -H "Authorization: Bearer nx_live_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "sales-crm-ai",
    "ttlSeconds": 300,
    "maxTokenUsage": 50000
  }'`,
}

const PAIN_POINTS = [
  {
    problem: "Weeks wasted configuring LLM rate limits, retries, and API provider fallback logic.",
    solution: "Unified Multi-Model Gateway with automatic failover across OpenAI, Anthropic, and Gemini.",
    icon: Cpu,
  },
  {
    problem: "Risk of uncontained code execution when giving AI agents custom tools and python interpreters.",
    solution: "3-Second Isolated Docker/Wasm Sandboxes with zero host filesystem exposure.",
    icon: Lock,
  },
  {
    problem: "Building custom multi-tenant subscription tiers and usage metering takes months.",
    solution: "Turnkey Razorpay & Stripe integration with automated usage token tracking.",
    icon: Database,
  },
  {
    problem: "Lack of real-time telemetry and debugging visibility into multi-agent workflows.",
    solution: "Built-in tracing, latency breakdown, and token cost analytics for every execution.",
    icon: Activity,
  },
]

const FEATURES = [
  {
    icon: Code2,
    title: "TypeScript & Python First SDKs",
    description: "Fully typed, intuitive client libraries designed for Next.js, Node.js, FastAPI, and Django applications.",
  },
  {
    icon: Terminal,
    title: "Instant Live Sandbox Demos",
    description: "Spin up isolated, interactive trial environments for prospective clients in under 3 seconds.",
  },
  {
    icon: ShieldCheck,
    title: "SOC2 & GDPR Enterprise Shield",
    description: "AES-256 encryption at rest, TLS 1.3 in transit, automated audit logs, and compliance readiness out of the box.",
  },
  {
    icon: Workflow,
    title: "Event-Driven Webhooks & Pusher",
    description: "Real-time state synchronization across web apps, admin portals, and external CRM systems.",
  },
  {
    icon: Server,
    title: "Sub-50ms Global Edge Routing",
    description: "Multi-region edge network ensures minimal latency and maximum throughput worldwide.",
  },
  {
    icon: Rocket,
    title: "Monetize on Agent Marketplace",
    description: "Publish your custom AI tools and SaaS services directly to thousands of active buyers.",
  },
]

const STEPS = [
  {
    step: "01",
    title: "Install SDK & Connect Keys",
    description: "Add `@nexusai/sdk` to your project and configure your project environment variables in minutes.",
  },
  {
    step: "02",
    title: "Configure Agent Behaviors",
    description: "Define agent prompts, knowledge bases, tool permissions, and fallback rules using simple JSON schemas.",
  },
  {
    step: "03",
    title: "Embed Demos & Sandboxes",
    description: "Drop pre-styled React components or lightweight iframe sandboxes into your existing web applications.",
  },
  {
    step: "04",
    title: "Deploy & Scale Worldwide",
    description: "Launch with confidence backed by 99.99% uptime SLA, automated failovers, and live usage monitoring.",
  },
]

export default function DevelopersSolutionPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      {/* ── HERO SECTION ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto text-center space-y-8 pt-4 pb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Developer-First AI Infrastructure
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
          Stop Reinventing AI Infra. Build, Deploy & Scale <span className="text-primary underline decoration-primary/40 underline-offset-8">10x Faster</span>.
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          NexusAI gives developers pre-built AI agent SDKs, 3-second live sandboxes, unified multi-tenant billing, and high-performance edge APIs to launch production AI software without boilerplate code.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3.5 text-sm font-bold shadow-md hover:opacity-90 transition-all"
          >
            Explore Developer Tools <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/request-service"
            className="inline-flex items-center gap-2 rounded-xl bg-card border border-border px-6 py-3.5 text-sm font-bold text-foreground hover:bg-accent transition-all"
          >
            Request Custom Architecture <Workflow className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-xl bg-muted px-5 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all"
          >
            <BookOpen className="w-4 h-4" /> API Docs
          </Link>
        </div>

        {/* Hero Code Snippet Box */}
        <div className="mt-12 text-left max-w-4xl mx-auto rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden font-mono text-xs sm:text-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs text-zinc-400 font-sans font-semibold">deploy-agent.ts</span>
            </div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans font-bold">TypeScript SDK</span>
          </div>
          <div className="p-5 overflow-x-auto leading-relaxed text-emerald-400">
            <pre>{CODE_EXAMPLES.typescript}</pre>
          </div>
        </div>
      </div>

      {/* ── METRICS STRIP ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto border-y border-border py-8 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-3xl font-black text-primary">&lt; 45ms</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">Edge API Latency</p>
          </div>
          <div>
            <p className="text-3xl font-black text-foreground">99.99%</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">Production SLA</p>
          </div>
          <div>
            <p className="text-3xl font-black text-primary">1,200+</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">Hosted AI Agents</p>
          </div>
          <div>
            <p className="text-3xl font-black text-foreground">10M+</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">Daily Token Executions</p>
          </div>
        </div>
      </div>

      {/* ── PAIN POINTS VS SOLUTIONS ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto space-y-10 mb-20">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black">Built by Engineers, for Engineers</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            We solved the non-differentiating infrastructure headaches so you can focus 100% on your core AI product logic.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {PAIN_POINTS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/40 transition-all space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground">Challenge &amp; Fix #{idx + 1}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 font-medium">
                    <span className="font-bold">❌ Problem:</span> {item.problem}
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold">
                    <span className="font-bold">✅ NexusAI Solution:</span> {item.solution}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── CORE FEATURES GRID ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto space-y-10 mb-20">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black">Everything Your AI Stack Needs</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A comprehensive suit of developer primitives engineered for scale, reliability, and security.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all space-y-3"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── WORKFLOW STEPS ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto space-y-10 mb-20 rounded-3xl border border-border bg-card p-8 sm:p-12 shadow-sm">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black">4 Steps from Zero to Production</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Go from initial idea to live customer-facing AI agent in less than an afternoon.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="space-y-3 rounded-2xl border border-border bg-background p-6">
              <span className="text-3xl font-black text-primary">{s.step}</span>
              <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CODE EXAMPLES MULTI-LANG ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto space-y-8 mb-20">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black">Multi-Language Code Integration</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Clean, developer-friendly APIs designed to seamlessly integrate into your current software architecture.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-zinc-300 bg-white p-5 font-mono text-xs space-y-3 shadow-md" style={{ backgroundColor: '#ffffff', color: '#171717' }}>
            <div className="flex items-center justify-between text-zinc-700 border-b border-zinc-200 pb-2 font-bold font-sans">
              <span className="text-xs text-amber-700 font-extrabold">Python Client</span>
              <span className="text-zinc-500 font-semibold">Python 3.10+</span>
            </div>
            <pre className="overflow-x-auto leading-relaxed font-bold text-zinc-900" style={{ color: '#171717' }}>{CODE_EXAMPLES.python}</pre>
          </div>

          <div className="rounded-2xl border border-zinc-300 bg-white p-5 font-mono text-xs space-y-3 shadow-md" style={{ backgroundColor: '#ffffff', color: '#171717' }}>
            <div className="flex items-center justify-between text-zinc-700 border-b border-zinc-200 pb-2 font-bold font-sans">
              <span className="text-xs text-indigo-700 font-extrabold">REST API / cURL</span>
              <span className="text-zinc-500 font-semibold">cURL / HTTP</span>
            </div>
            <pre className="overflow-x-auto leading-relaxed font-bold text-zinc-900" style={{ color: '#171717' }}>{CODE_EXAMPLES.curl}</pre>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA BANNER ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl border border-amber-800 dark:border-purple-700" style={{ backgroundColor: '#a16207' }}>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>Ready to Build Your Next AI Solution?</h2>
        <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-semibold text-amber-100" style={{ color: '#fef3c7' }}>
          Join hundreds of developers building enterprise AI products with NexusAI. Get started today or talk with our engineering architects.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-xl text-zinc-900 font-extrabold px-7 py-3.5 text-sm shadow-md transition-all border border-white"
            style={{ color: '#18181b', backgroundColor: '#ffffff' }}
          >
            Explore Marketplace <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/request-service"
            className="inline-flex items-center gap-2 rounded-xl text-white font-extrabold px-7 py-3.5 text-sm shadow-md transition-all border border-zinc-700"
            style={{ color: '#ffffff', backgroundColor: '#18181b' }}
          >
            Request Custom Architecture <Workflow className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
