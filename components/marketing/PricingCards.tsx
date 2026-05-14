import Link from "next/link"
import { Check, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    description: "Perfect for exploring the platform and running demos.",
    features: [
      "5 AI agent calls/day",
      "1 active project",
      "Community support",
      "Marketplace access",
      "Basic analytics",
    ],
    cta: "Start free",
    href: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For growing teams that need power and flexibility.",
    features: [
      "Unlimited AI agent calls",
      "10 active projects",
      "Priority support (24h)",
      "Advanced analytics",
      "Webhook integrations",
      "Custom branding",
      "API access",
    ],
    cta: "Get Pro",
    href: "/register?plan=pro",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Dedicated infrastructure, SLAs, and white-labelling.",
    features: [
      "Everything in Pro",
      "Dedicated servers",
      "99.9% SLA guarantee",
      "SSO / SAML",
      "Custom contracts",
      "Onboarding call",
      "Dedicated account manager",
    ],
    cta: "Contact sales",
    href: "/contact",
    highlight: false,
  },
]

export default function PricingCards() {
  return (
    <section className="py-24 px-4" id="pricing">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Start free, scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border p-8 flex flex-col",
                plan.highlight
                  ? "border-primary shadow-lg shadow-primary/20 bg-primary/5"
                  : "bg-card shadow-sm"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    <Zap className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-8 w-full"
                variant={plan.highlight ? "default" : "outline"}
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
