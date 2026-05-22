import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { CallToAction } from "@/components/public/CallToAction"
import { Briefcase, Map, HeartHandshake, Coffee, Laptop, Sparkles } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Careers — NexusAI",
  description: "Join NexusAI and help us build the operating system for the AI-native enterprise. Remote-first, competitive salary, equity.",
}

const JOBS = [
  { title: "Senior AI Infrastructure Engineer", department: "Engineering", location: "Remote (Global)", type: "Full-time" },
  { title: "Product Manager, Agents", department: "Product", location: "Remote (US/EU)", type: "Full-time" },
  { title: "Enterprise Account Executive", department: "Sales", location: "Remote (US)", type: "Full-time" },
  { title: "Developer Advocate", department: "DevRel", location: "Remote (Global)", type: "Full-time" },
]

export default function CareersPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title={<>Build the <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">Future of AI</span></>}
        description="We are a fully distributed team of engineers, researchers, and builders on a mission to democratize AI infrastructure. Join us."
        pillText="We're Hiring"
        ctaText="View Open Roles"
        ctaHref="#jobs"
      />

      <FeatureGrid 
        title="Life at NexusAI"
        description="We believe in taking care of our team so they can do their best work."
        features={[
          { icon: Map, title: "Work Anywhere", description: "We are a remote-first company. Work from anywhere in the world with a flexible schedule." },
          { icon: HeartHandshake, title: "Comprehensive Health", description: "Premium medical, dental, and vision coverage for you and your dependents." },
          { icon: Coffee, title: "Home Office Stipend", description: "$2,000 upfront stipend to build your perfect remote setup, plus internet reimbursement." },
          { icon: Laptop, title: "Top-Tier Gear", description: "Choose your own equipment. Maxed-out MacBook Pros are standard issue." },
          { icon: Sparkles, title: "Meaningful Equity", description: "We want you to act like an owner, so we make sure you are one with competitive stock options." },
          { icon: Briefcase, title: "Unlimited PTO", description: "Take the time you need to recharge. We enforce a minimum of 3 weeks off per year." }
        ]}
      />

      <section id="jobs" className="py-24 px-6 border-t border-white/5 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Open Positions</h2>
            <p className="text-zinc-400">Don't see a fit? Email us at careers@nexusai.com.</p>
          </div>

          <div className="space-y-4">
            {JOBS.map((job, i) => (
              <a key={i} href="#" className="block p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-purple-500/50 transition-all group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                      <span className="bg-white/5 px-2.5 py-1 rounded-md">{job.department}</span>
                      <span>{job.location}</span>
                      <span>·</span>
                      <span>{job.type}</span>
                    </div>
                  </div>
                  <div className="text-purple-400 font-medium">Apply →</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <CallToAction 
        title="Ready to apply?"
        description="We look forward to meeting you."
        ctaText="Send Open Application"
        ctaHref="mailto:careers@nexusai.com"
      />
    </div>
  )
}
