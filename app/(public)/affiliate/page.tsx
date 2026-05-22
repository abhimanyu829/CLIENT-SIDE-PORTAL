import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { CallToAction } from "@/components/public/CallToAction"
import { FAQSection } from "@/components/public/FAQSection"
import { DollarSign, LineChart, Link as LinkIcon, Gift, Users, Zap } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Affiliate Program — NexusAI",
  description: "Join the NexusAI affiliate program. Earn recurring 30% commissions for referring customers to our AI marketplace.",
}

export default function AffiliatePage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title={<>Earn <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-400">30% Recurring</span> Revenue</>}
        description="Recommend the industry's leading AI agent marketplace to your audience and earn a lifetime 30% commission on every paid subscription."
        pillText="Affiliate Program"
        ctaText="Become an Affiliate"
        ctaHref="/register"
      />

      <div className="max-w-4xl mx-auto px-6 mb-24">
        <div className="bg-gradient-to-r from-emerald-900/40 to-green-900/20 border border-emerald-500/30 rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">Calculate Your Earnings</h2>
          <p className="text-emerald-400 mb-8">Refer just 100 Pro users to earn $3,000/month in passive income.</p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="bg-black/50 border border-white/10 rounded-xl p-6 w-full md:w-48 text-center">
              <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider block mb-2">Referrals</span>
              <span className="text-3xl font-black">100</span>
            </div>
            <div className="text-2xl text-zinc-600 font-bold">×</div>
            <div className="bg-black/50 border border-white/10 rounded-xl p-6 w-full md:w-48 text-center">
              <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider block mb-2">Avg. Value</span>
              <span className="text-3xl font-black">$100/mo</span>
            </div>
            <div className="text-2xl text-zinc-600 font-bold">=</div>
            <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-6 w-full md:w-48 text-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <span className="text-emerald-400 text-sm font-bold uppercase tracking-wider block mb-2">Monthly</span>
              <span className="text-3xl font-black text-white">$3,000</span>
            </div>
          </div>
        </div>
      </div>

      <FeatureGrid 
        title="Why promote NexusAI?"
        features={[
          { icon: DollarSign, title: "30% Lifetime Commission", description: "Unlike other programs that cap at 12 months, we pay you 30% for the lifetime of the customer." },
          { icon: LineChart, title: "High Conversion Rate", description: "Our free tier and frictionless onboarding mean your traffic converts into users at an industry-leading rate." },
          { icon: LinkIcon, title: "90-Day Cookie", description: "If a user clicks your link and signs up anytime within 90 days, you get the credit." },
          { icon: Gift, title: "Fast Payouts", description: "Commissions are paid out automatically on the 15th of every month via Stripe or PayPal." },
          { icon: Users, title: "Creator Assets", description: "Get access to a library of high-converting banners, email templates, and video assets." },
          { icon: Zap, title: "Real-time Dashboard", description: "Track your clicks, conversions, and upcoming payouts in real-time through your affiliate dashboard." }
        ]}
      />

      <FAQSection 
        title="Affiliate FAQs"
        faqs={[
          { question: "Is there a minimum payout threshold?", answer: "Yes, payouts are processed once your unpaid commission balance reaches $50." },
          { question: "Can I run paid ads to my affiliate link?", answer: "You may run paid ads, but you are strictly prohibited from bidding on our branded terms (e.g., 'NexusAI')." },
          { question: "Do I earn commissions on Enterprise deals?", answer: "Yes! If you refer an enterprise customer, you will receive a flat finder's fee of $1,000 upon closed-won." }
        ]}
      />

      <CallToAction 
        title="Start earning today"
        description="Approval is instant. Get your custom tracking link and start promoting."
        ctaText="Join Affiliate Program"
        ctaHref="/register"
      />
    </div>
  )
}
