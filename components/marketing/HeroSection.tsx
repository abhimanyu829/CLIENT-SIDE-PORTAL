import Link from "next/link"
import { ArrowRight, Sparkles, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-36 px-4">
      {/* Gradient orbs */}
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-500/20 blur-[120px] pointer-events-none"
      />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/60 text-sm font-medium text-muted-foreground mb-6">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          AI-Powered SaaS Platform
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          Deploy AI Agents &{" "}
          <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Grow Your SaaS
          </span>{" "}
          in Minutes
        </h1>

        {/* Subheading */}
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          OpenClaude gives you a production-ready marketplace, CRM, billing, and AI agent
          infrastructure — so you can focus on building, not plumbing.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild className="gap-2 text-base">
            <Link href="/register">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="gap-2 text-base">
            <Link href="/demo">
              <Play className="w-4 h-4" />
              Live demo
            </Link>
          </Button>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-muted-foreground">
          No credit card required · Cancel anytime · Free tier available
        </p>
      </div>
    </section>
  )
}
