import React from "react"
import Link from "next/link"
import { Metadata } from "next"
import { Briefcase, MapPin, HeartHandshake, Coffee, Laptop, Sparkles, ArrowRight, CheckCircle2, Rocket, Globe, Zap, Users } from "lucide-react"

export const metadata: Metadata = {
  title: "Careers — ABHIBHIDEVELOPERS",
  description: "Join ABHIBHIDEVELOPERS and help us build the operating system for the AI-native enterprise. Remote-first, competitive salary, equity.",
}

const JOBS = [
  { title: "Senior AI Infrastructure Engineer", department: "Engineering", location: "Remote (Global)", type: "Full-time" },
  { title: "Product Manager, Autonomous Agents", department: "Product", location: "Remote (Global)", type: "Full-time" },
  { title: "Enterprise Account Executive", department: "Sales", location: "Remote (US/EU/India)", type: "Full-time" },
  { title: "Developer Advocate & Technical Writer", department: "DevRel", location: "Remote (Global)", type: "Full-time" },
  { title: "Full-Stack Next.js / TypeScript Engineer", department: "Engineering", location: "Remote (Global)", type: "Full-time" },
]

const PERKS = [
  { icon: Globe, title: "Work Anywhere", desc: "We are 100% remote-first. Work from anywhere in the world with flexible async schedules." },
  { icon: HeartHandshake, title: "Comprehensive Health", desc: "Premium medical, dental, and vision coverage for you and your dependents." },
  { icon: Coffee, title: "Home Office Stipend", desc: "Upfront stipend to build your dream remote setup, plus monthly internet reimbursement." },
  { icon: Laptop, title: "Top-Tier Gear", desc: "Maxed-out M-series MacBook Pros and 4K displays provided standard to every team member." },
  { icon: Sparkles, title: "Meaningful Equity", desc: "We want everyone to act like an owner—every employee receives competitive stock options." },
  { icon: Zap, title: "Unlimited & Flexible PTO", desc: "Take the time you need to recharge. We enforce minimum 3 weeks mandatory time off per year." },
]

export default function CareersPage() {
  return (
    <div className="bg-white text-zinc-900 min-h-screen py-12 md:py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* 1. Hero Header Section */}
        <div className="bg-gradient-to-br from-purple-50/60 via-white to-zinc-50 border border-zinc-200/90 rounded-3xl p-8 md:p-14 shadow-xs relative overflow-hidden">
          <div className="max-w-3xl space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 bg-purple-100/80 text-purple-900 border border-purple-200/80 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5 text-purple-700" />
              <span>We're Hiring · ABHIBHIDEVELOPERS</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 leading-[1.1]">
              Build the Future of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600">
                Autonomous AI Software
              </span>
            </h1>

            <p className="text-base sm:text-xl text-zinc-600 font-medium leading-relaxed">
              We are a fully distributed team of engineers, researchers, and builders on a mission to democratize AI infrastructure. Come build with us.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/join-our-team"
                className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-sm transition-all shadow-sm hover:shadow-purple-500/25 hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
              >
                <span>View Open Roles</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/join-our-team"
                className="px-6 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-sm transition-all border border-zinc-200 cursor-pointer"
              >
                Join Our Team Directly →
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Perks & Life at ABHIBHIDEVELOPERS */}
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold text-purple-700 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Why Join Us
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">Life at ABHIBHIDEVELOPERS</h2>
            <p className="text-zinc-600 text-sm font-medium">We believe in taking exceptional care of our team so everyone can do their best work.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PERKS.map((perk, idx) => {
              const Icon = perk.icon
              return (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-xs hover:shadow-md hover:border-purple-200 transition-all space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                    <Icon className="w-5.5 h-5.5" />
                  </div>
                  <h3 className="text-lg font-extrabold text-zinc-900">{perk.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">{perk.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Open Positions Section - All Connected Directly to /join-our-team */}
        <div id="jobs" className="bg-white rounded-3xl p-8 md:p-12 border border-zinc-200/90 shadow-xs space-y-8 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
            <div>
              <span className="text-xs font-extrabold text-purple-700 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                Active Listings
              </span>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight mt-2">Open Positions</h2>
            </div>
            <Link
              href="/join-our-team"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-xs hover:scale-[1.02] cursor-pointer shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Apply Now (/join-our-team)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {JOBS.map((job, i) => (
              <Link
                key={i}
                href="/join-our-team"
                className="block p-6 rounded-2xl bg-zinc-50/70 border border-zinc-200/80 hover:border-purple-300 hover:bg-purple-50/30 transition-all group shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold text-zinc-900 group-hover:text-purple-600 transition-colors">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold text-zinc-500">
                      <span className="bg-purple-100/80 text-purple-900 px-2.5 py-0.5 rounded-md font-mono">{job.department}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-zinc-400" /> {job.location}</span>
                      <span>•</span>
                      <span>{job.type}</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-600 group-hover:text-purple-700 bg-white group-hover:bg-purple-100/80 px-4 py-2 rounded-xl border border-zinc-200 group-hover:border-purple-200 transition-all shrink-0">
                    <span>Apply Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 4. Bottom CTA Section - Connected Directly to /join-our-team */}
        <div className="bg-gradient-to-r from-zinc-900 via-purple-950 to-zinc-900 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 text-purple-200 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              <Rocket className="w-3.5 h-3.5 text-purple-400" />
              <span>Direct Application</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Don't see an exact match?
            </h2>

            <p className="text-zinc-300 text-sm sm:text-base font-medium leading-relaxed">
              We are always looking for exceptional talent. Submit your application directly to our team.
            </p>

            <div className="pt-4">
              <Link
                href="/join-our-team"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm transition-all shadow-lg hover:scale-[1.02] cursor-pointer"
              >
                <span>Join Our Team Directly</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

