// components/marketing/PricingCards.tsx
import Link from "next/link"

const S = `
.pc-glass{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:1.25rem;padding:2rem;transition:all .3s ease;position:relative;overflow:hidden}
.pc-glass:hover{border-color:rgba(255,255,255,.12);transform:translateY(-4px)}
.pc-popular{border-color:rgba(139,92,246,.4) !important;background:rgba(139,92,246,.07) !important}
.pc-popular::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#60a5fa)}
.pc-cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.875rem;padding:.75rem 1.5rem;font-weight:800;color:#fff;width:100%;transition:all .2s;display:block;text-align:center}
.pc-cta:hover{opacity:.9;transform:scale(1.02)}
.pc-ghost-cta{border:1px solid rgba(255,255,255,.12);border-radius:.875rem;padding:.75rem 1.5rem;font-weight:700;color:rgba(255,255,255,.7);width:100%;transition:all .2s;display:block;text-align:center}
.pc-ghost-cta:hover{border-color:rgba(255,255,255,.25);color:#fff}
.pc-check{color:#8b5cf6;font-size:.75rem;flex-shrink:0}
.pc-gradient{background:linear-gradient(135deg,#fff,#a78bfa 60%,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
`

const PLANS = [
  {
    name:"Free",
    price:0,
    desc:"Perfect for exploring the platform.",
    features:["5 AI requests/day","1 project","Community support","Marketplace access","Basic analytics"],
    cta:"Get started free",
    ctaHref:"/register",
    popular:false,
  },
  {
    name:"Pro",
    price:49,
    desc:"For solo builders shipping real products.",
    features:["500 AI requests/day","10 projects","Email support","Advanced analytics","API access","Stripe billing","AI Chat assistant"],
    cta:"Start Pro trial",
    ctaHref:"/register?plan=pro",
    popular:true,
  },
  {
    name:"Team",
    price:149,
    desc:"For growing teams and agencies.",
    features:["Unlimited AI requests","Unlimited projects","Priority support","Custom AI models","Team seats (10)","SSO + RBAC","SLA guarantee","Audit logs"],
    cta:"Start Team trial",
    ctaHref:"/register?plan=team",
    popular:false,
  },
  {
    name:"Enterprise",
    price:null,
    desc:"Dedicated infrastructure for at-scale.",
    features:["Everything in Team","Dedicated infrastructure","Custom contracts","Onboarding support","Custom integrations","24/7 support","DPA + BAA","Volume discounts"],
    cta:"Contact sales",
    ctaHref:"/contact",
    popular:false,
  },
]

export default function PricingCards() {
  return (
    <section className="py-24 px-4 bg-[#080808]" id="pricing">
      <style>{S}</style>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-black text-purple-400 uppercase tracking-widest">Pricing</span>
          <h2 className="text-4xl sm:text-5xl font-black mt-3 mb-4">
            Simple, <span className="pc-gradient">transparent pricing</span>
          </h2>
          <p className="text-zinc-500 text-lg">No hidden fees. Start free, scale when ready.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan, i) => (
            <div key={i} className={`pc-glass ${plan.popular ? "pc-popular" : ""}`}>
              {plan.popular && (
                <div className="absolute top-3 right-3 text-[9px] font-black text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full tracking-widest">
                  POPULAR
                </div>
              )}
              <p className="font-black text-lg mb-1">{plan.name}</p>
              <p className="text-xs text-zinc-600 mb-5 leading-relaxed">{plan.desc}</p>

              <div className="mb-6">
                {plan.price === null ? (
                  <p className="text-3xl font-black">Custom</p>
                ) : plan.price === 0 ? (
                  <p className="text-3xl font-black">$0<span className="text-sm text-zinc-600">/mo</span></p>
                ) : (
                  <p className="text-3xl font-black">${plan.price}<span className="text-sm text-zinc-600">/mo</span></p>
                )}
              </div>

              <div className="space-y-2 mb-7">
                {plan.features.map(f => (
                  <p key={f} className="text-xs text-zinc-400 flex items-start gap-2">
                    <span className="pc-check mt-0.5">✓</span>
                    {f}
                  </p>
                ))}
              </div>

              <Link href={plan.ctaHref}>
                <button className={plan.popular ? "pc-cta" : "pc-ghost-cta"}>{plan.cta}</button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-zinc-700 mt-8">
          All plans include 14-day free trial. No credit card required to start.
        </p>
      </div>
    </section>
  )
}
