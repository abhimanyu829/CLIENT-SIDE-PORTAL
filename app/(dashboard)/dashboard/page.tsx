import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

async function getDashboardData(userId: string) {
  const [subscriptions, tickets, invoices, projects] = await Promise.all([
    db.subscription.findMany({ where:{userId}, include:{product:true,tier:true}, take:3, orderBy:{createdAt:"desc"} }).catch(()=>[]),
    db.ticket.findMany({ where:{clientId:userId}, take:5, orderBy:{createdAt:"desc"} }).catch(()=>[]),
    db.invoice.findMany({ where:{userId}, take:5, orderBy:{issuedAt:"desc"} }).catch(()=>[]),
    db.project.findMany({ where:{clientId:userId}, take:4 }).catch(()=>[]),
  ])
  return { subscriptions, tickets, invoices, projects }
}

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 2s ease-in-out infinite}
@keyframes dc{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.d-card{animation:dc .3s ease-out both}
`

const QUICK = [
  { label:"Upgrade Plan",        icon:"⬡", href:"/dashboard/subscriptions", color:"text-blue-400",    bg:"rgba(59,130,246,.1)" },
  { label:"Open AI Chat",        icon:"✦", href:"/dashboard/chat",          color:"text-purple-400",  bg:"rgba(139,92,246,.1)" },
  { label:"Browse Marketplace",  icon:"◈", href:"/marketplace",             color:"text-emerald-400", bg:"rgba(16,185,129,.1)" },
  { label:"Create Ticket",       icon:"◎", href:"/dashboard/tickets",       color:"text-red-400",     bg:"rgba(239,68,68,.1)"  },
  { label:"Launch Demo",         icon:"▶", href:"/demo",                    color:"text-amber-400",   bg:"rgba(245,158,11,.1)" },
]

const ACTIVITIES = [
  { icon:"💳", title:"Invoice Paid", desc:"INV-2024-03 for $349.00 paid successfully", time:"2h ago", color:"text-emerald-400" },
  { icon:"✅", title:"Ticket Resolved", desc:"Support ticket #T-882 marked resolved", time:"1d ago", color:"text-blue-400" },
  { icon:"✦", title:"AI Chat session", desc:"30-minute session — 4,200 tokens used", time:"2d ago", color:"text-purple-400" },
  { icon:"🚀", title:"Project deployed", desc:"CRM AI v2.1 deployed to production", time:"3d ago", color:"text-amber-400" },
  { icon:"🔐", title:"Login detected", desc:"New login from Mac OS · Chrome", time:"4d ago", color:"text-zinc-400" },
]

export default async function DashboardOverviewPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const { subscriptions, tickets, invoices, projects } = await getDashboardData(session.user.id)

  const activeSubs = subscriptions.filter((s:any) => s.status === "ACTIVE")
  const openTickets = tickets.filter((t:any) => t.status === "OPEN" || t.status === "IN_PROGRESS")
  const totalSpend = invoices.reduce((sum:number,inv:any) => sum + Number(inv.amount||0), 0)

  const STATS = [
    { label:"Active Plans",    value: activeSubs.length || "0",     sub:"Subscriptions", icon:"⬡", color:"text-blue-400",    border:"border-blue-500/20",    glow:"rgba(59,130,246,.08)" },
    { label:"AI API Calls",    value:"45.2k",                        sub:"+12% this month", icon:"✦", color:"text-purple-400", border:"border-purple-500/20",  glow:"rgba(139,92,246,.08)" },
    { label:"Open Tickets",    value: openTickets.length || "0",     sub:"Needs attention",  icon:"◎", color:"text-red-400",    border:"border-red-500/20",     glow:"rgba(239,68,68,.08)"  },
    { label:"Monthly Spend",   value:`$${(totalSpend/100).toFixed(0)||"0"}`, sub:"Current cycle", icon:"◑", color:"text-amber-400",  border:"border-amber-500/20",   glow:"rgba(245,158,11,.08)" },
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <style>{S}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Good evening, <span style={{background:"linear-gradient(135deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Acme Corp</span> 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">Here&apos;s what&apos;s happening on your platform today.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/chat">
            <button className="d-btn px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all flex items-center gap-2">
              ✦ Open AI Chat
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s,i)=>(
          <div key={i} className={`d-glass rounded-2xl p-5 border ${s.border} d-card`} style={{animationDelay:`${i*0.06}s`,boxShadow:`0 0 30px ${s.glow}`}}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-zinc-600 font-medium">{s.label}</span>
              <span className={`text-lg ${s.color}`}>{s.icon}</span>
            </div>
            <p className="text-3xl font-black mb-1">{s.value}</p>
            <p className="text-xs text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK.map((q,i)=>(
            <Link key={i} href={q.href}>
              <div className="d-glass rounded-2xl p-4 hover:border-white/12 hover:-translate-y-1 transition-all cursor-pointer d-card text-center" style={{animationDelay:`${i*0.05}s`}}>
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center text-xl" style={{background:q.bg}}>
                  <span className={q.color}>{q.icon}</span>
                </div>
                <p className="text-xs font-semibold text-zinc-300">{q.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* AI Usage Bar */}
      <div className="d-glass rounded-2xl p-5 border border-purple-500/15" style={{boxShadow:"0 0 30px rgba(139,92,246,.06)"}}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">✦</span>
            <p className="font-bold text-sm">AI Token Usage</p>
            <span className="d-glass text-xs px-2.5 py-0.5 rounded-full text-zinc-500">Pro Plan</span>
          </div>
          <p className="text-sm font-mono text-zinc-400">45,200 / 100,000</p>
        </div>
        <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{width:"45%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)"}} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-zinc-600">
          <span>45% used</span>
          <Link href="/dashboard/subscriptions" className="text-purple-400 hover:underline">Upgrade for more →</Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active Subscriptions */}
        <div className="lg:col-span-2 d-glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="font-bold text-sm">Active Subscriptions</p>
            <Link href="/dashboard/subscriptions" className="text-xs text-purple-400 hover:underline">Manage →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {activeSubs.length > 0 ? activeSubs.map((sub:any, i:number) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-lg">⬡</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{sub.product?.name ?? "Unknown Product"}</p>
                  <p className="text-xs text-zinc-600">{sub.tier?.name ?? "—"} · Renews {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}</p>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">Active</span>
              </div>
            )) : (
              <div className="px-5 py-8 text-center">
                <p className="text-zinc-600 text-sm">No active subscriptions</p>
                <Link href="/marketplace"><button className="mt-3 d-btn px-4 py-2 rounded-xl text-xs font-bold text-white">Browse Marketplace</button></Link>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="d-glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="font-bold text-sm">Recent Activity</p>
            <span className="d-glass text-[10px] px-2 py-0.5 rounded-full text-zinc-600">Live</span>
          </div>
          <div className="divide-y divide-white/5">
            {ACTIVITIES.map((a,i)=>(
              <div key={i} className="px-4 py-3 flex gap-3 hover:bg-white/2 transition-all">
                <span className="text-base shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{a.title}</p>
                  <p className="text-[11px] text-zinc-600 truncate">{a.desc}</p>
                </div>
                <span className="text-[10px] text-zinc-700 shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="d-glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="font-bold text-sm">Support Tickets</p>
            <Link href="/dashboard/tickets" className="text-xs text-purple-400 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {tickets.length > 0 ? tickets.slice(0,4).map((t:any)=>(
              <Link key={t.id} href={`/dashboard/tickets/${t.id}`}>
                <div className="px-5 py-3 flex items-center gap-3 hover:bg-white/2 transition-all cursor-pointer">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.status==="OPEN"?"bg-red-400":t.status==="IN_PROGRESS"?"bg-amber-400":"bg-zinc-600"}`} />
                  <p className="flex-1 text-xs font-medium truncate">{t.title}</p>
                  <span className="text-[10px] text-zinc-600">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            )) : (
              <div className="px-5 py-6 text-center text-sm text-zinc-600">No tickets yet</div>
            )}
          </div>
          <div className="p-3 border-t border-white/5">
            <Link href="/dashboard/tickets">
              <button className="w-full d-glass rounded-xl py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-all">+ Create Ticket</button>
            </Link>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="lg:col-span-2 d-glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="font-bold text-sm">Recent Invoices</p>
            <Link href="/dashboard/invoices" className="text-xs text-purple-400 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {invoices.length > 0 ? invoices.slice(0,4).map((inv:any)=>(
              <div key={inv.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold font-mono">{inv.stripeInvoiceId?.slice(0,12) ?? `INV-${inv.id.slice(0,8)}`}</p>
                  <p className="text-[11px] text-zinc-600">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "—"}</p>
                </div>
                <p className="font-bold text-sm">${(Number(inv.amount||0)/100).toFixed(2)}</p>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${inv.status==="PAID"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":inv.status==="PENDING"?"bg-amber-500/10 text-amber-400 border-amber-500/20":"bg-red-500/10 text-red-400 border-red-500/20"}`}>
                  {inv.status ?? "—"}
                </span>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-sm text-zinc-600">No invoices yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
