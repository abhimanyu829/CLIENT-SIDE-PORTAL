"use client"

import { useState } from "react"
import Link from "next/link"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.d-card{transition:all .3s ease}
.d-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.1)}
`

const TIERS = [
  { name:"Free",       price:0,    interval:"mo", color:"text-zinc-400",    border:"border-zinc-700/40",  features:["5 AI requests/day","1 project","Community support","Basic analytics"] },
  { name:"Pro",        price:4900, interval:"mo", color:"text-blue-400",    border:"border-blue-500/30",  popular:true, features:["500 AI requests/day","10 projects","Email support","Advanced analytics","API access"] },
  { name:"Team",       price:14900,interval:"mo", color:"text-purple-400",  border:"border-purple-500/30",features:["Unlimited AI requests","Unlimited projects","Priority support","Custom models","Team seats","SSO"] },
  { name:"Enterprise", price:0,    interval:"mo", color:"text-amber-400",   border:"border-amber-500/30", features:["Everything in Team","Dedicated infra","SLA guarantee","Custom contracts","Onboarding","24/7 support"] },
]

export default function SubscriptionsClient({ subscriptions, invoices }: { subscriptions: any[], invoices: any[] }) {
  const [tab, setTab] = useState<"plans"|"billing"|"usage">("plans")
  const [billingCycle, setBillingCycle] = useState<"monthly"|"yearly">("monthly")

  const activeSub = subscriptions.find((s:any) => s.status === "ACTIVE")

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <style>{S}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Subscriptions</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your plans, billing cycles, and usage quotas.</p>
        </div>
        <div className="d-glass rounded-xl px-4 py-2 text-center">
          <p className="text-xs text-zinc-600">Current Plan</p>
          <p className="font-black text-blue-400">{activeSub?.tier?.name ?? "Free"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 d-glass rounded-xl p-1 w-fit">
        {[["plans","Plans"],["billing","Billing"],["usage","Usage"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab===id?"bg-violet-600 text-white":"text-zinc-500 hover:text-zinc-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === "plans" && (
        <div className="space-y-6">
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${billingCycle==="monthly"?"text-white":"text-zinc-500"}`}>Monthly</span>
            <button onClick={()=>setBillingCycle(b=>b==="monthly"?"yearly":"monthly")}
              className={`relative w-12 h-6 rounded-full transition-all ${billingCycle==="yearly"?"bg-violet-600":"bg-zinc-800"}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${billingCycle==="yearly"?"left-7":"left-1"}`} />
            </button>
            <span className={`text-sm ${billingCycle==="yearly"?"text-white":"text-zinc-500"}`}>Yearly</span>
            <span className="d-glass text-[10px] px-2 py-0.5 rounded-full text-emerald-400 border-emerald-500/20">Save 20%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier,i)=>{
              const price = tier.price === 0 ? tier.price : billingCycle==="yearly" ? Math.floor(tier.price*0.8) : tier.price
              const isActive = activeSub?.tier?.name?.toLowerCase() === tier.name.toLowerCase()
              return (
                <div key={i} className={`d-glass rounded-2xl p-5 border ${tier.border} d-card relative overflow-hidden ${tier.popular?"border-blue-500/40":""}`}>
                  {tier.popular && (
                    <div className="absolute top-0 left-0 right-0 py-1 text-center text-[10px] font-black tracking-widest bg-blue-600 text-white">
                      MOST POPULAR
                    </div>
                  )}
                  <div className={tier.popular ? "mt-5" : ""}>
                    <p className={`font-black text-lg ${tier.color}`}>{tier.name}</p>
                    <div className="my-3">
                      {tier.price === 0 && tier.name === "Free" ? (
                        <p className="text-3xl font-black">$0</p>
                      ) : tier.price === 0 ? (
                        <p className="text-2xl font-black">Custom</p>
                      ) : (
                        <p className="text-3xl font-black">${(price/100).toFixed(0)}<span className="text-sm text-zinc-600">/{billingCycle==="yearly"?"yr":"mo"}</span></p>
                      )}
                    </div>
                    <div className="space-y-1.5 mb-5">
                      {tier.features.map(f=>(
                        <p key={f} className="text-xs text-zinc-500 flex items-center gap-2">
                          <span className={`${tier.color} text-[10px]`}>✓</span>{f}
                        </p>
                      ))}
                    </div>
                    {isActive ? (
                      <button disabled className="w-full d-glass py-2.5 rounded-xl text-sm font-bold text-zinc-500 cursor-default">
                        ✓ Current Plan
                      </button>
                    ) : tier.name === "Enterprise" ? (
                      <Link href="/dashboard/tickets">
                        <button className="w-full d-glass py-2.5 rounded-xl text-sm font-bold text-amber-400 hover:border-amber-500/30 transition-all">
                          Contact Sales
                        </button>
                      </Link>
                    ) : (
                      <button className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${tier.popular ? "d-btn text-white" : "d-glass text-zinc-300 hover:text-white"}`}>
                        {activeSub ? "Switch Plan" : "Get Started"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Current subscription detail */}
          {activeSub && (
            <div className="d-glass rounded-2xl p-6 border border-blue-500/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-blue-400 mb-1">Active Subscription</p>
                  <h2 className="text-xl font-black">{activeSub.product?.name}</h2>
                  <p className="text-sm text-zinc-500">{activeSub.tier?.name} · Renews {activeSub.currentPeriodEnd ? new Date(activeSub.currentPeriodEnd).toLocaleDateString() : "—"}</p>
                </div>
                <div className="flex gap-2">
                  <button className="d-glass px-4 py-2 rounded-xl text-sm text-red-400 hover:border-red-500/30 transition-all">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing Tab */}
      {tab === "billing" && (
        <div className="space-y-6">
          {/* Payment method */}
          <div className="d-glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Payment Methods</h2>
              <button className="d-btn px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">+ Add Card</button>
            </div>
            <div className="d-glass rounded-xl p-4 flex items-center gap-4 border border-blue-500/20">
              <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-xs font-black text-white">VISA</div>
              <div>
                <p className="font-semibold text-sm">•••• •••• •••• 4242</p>
                <p className="text-xs text-zinc-600">Expires 12/2026</p>
              </div>
              <span className="ml-auto d-glass text-[10px] px-2 py-0.5 rounded-full text-emerald-400">Default</span>
            </div>
          </div>

          {/* Invoice history */}
          <div className="d-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-bold">Invoice History</h2>
              <Link href="/dashboard/invoices" className="text-xs text-purple-400 hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-white/5">
              {invoices.length > 0 ? invoices.slice(0,5).map((inv:any)=>(
                <div key={inv.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-mono font-semibold">{inv.stripeInvoiceId?.slice(0,16) ?? `INV-${inv.id.slice(0,8)}`}</p>
                    <p className="text-xs text-zinc-600">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "—"}</p>
                  </div>
                  <p className="font-black">${(Number(inv.amount||0)/100).toFixed(2)}</p>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${inv.status==="PAID"?"text-emerald-400 border-emerald-500/20 bg-emerald-500/10":"text-amber-400 border-amber-500/20 bg-amber-500/10"}`}>{inv.status}</span>
                  <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">⬇ PDF</button>
                </div>
              )) : (
                <div className="px-5 py-8 text-center text-zinc-600 text-sm">No invoices yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {tab === "usage" && (
        <div className="space-y-4">
          {[
            { label:"AI Token Usage", used:45200, total:100000, color:"#8b5cf6", icon:"✦" },
            { label:"API Requests",   used:3200,  total:10000,  color:"#3b82f6", icon:"⚡" },
            { label:"Storage",        used:2.4,   total:10,     color:"#10b981", icon:"◻", unit:"GB" },
            { label:"Team Seats",     used:3,     total:5,      color:"#f59e0b", icon:"◑" },
          ].map((u,i)=>(
            <div key={i} className="d-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{color:u.color}}>{u.icon}</span>
                  <p className="font-semibold text-sm">{u.label}</p>
                </div>
                <p className="text-sm font-mono text-zinc-400">{u.used.toLocaleString()}{u.unit?"":"/"}{!u.unit&&u.total.toLocaleString()}{u.unit&&" "+u.unit}</p>
              </div>
              <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{width:`${(u.used/u.total)*100}%`,background:u.color}} />
              </div>
              <p className="text-[11px] text-zinc-700 mt-1.5">{Math.round((u.used/u.total)*100)}% used</p>
            </div>
          ))}
          <div className="d-glass rounded-2xl p-5 text-center border border-purple-500/20">
            <p className="text-sm text-zinc-400 mb-3">Need more resources?</p>
            <button onClick={()=>setTab("plans")} className="d-btn px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">
              Upgrade Plan →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
