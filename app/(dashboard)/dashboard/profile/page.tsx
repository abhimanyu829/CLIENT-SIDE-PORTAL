"use client"

import { useState } from "react"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.d-input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);outline:none;transition:border-color .2s}
.d-input:focus{border-color:rgba(139,92,246,.5)}
.d-tab{border-bottom:2px solid transparent;transition:all .2s}
.d-tab-active{border-bottom-color:#8b5cf6;color:white}
`

const API_KEYS = [
  { name:"Production Server", prefix:"sk_live_abc123...", lastUsed:"10m ago", created:"May 1, 2026" },
  { name:"Local Dev",         prefix:"sk_test_xyz789...", lastUsed:"Never",   created:"Yesterday" },
]

const SESSIONS = [
  { device:"Mac OS · Chrome",  ip:"192.168.1.1",  active:"Just now",  current:true },
  { device:"iOS · Safari",     ip:"10.0.0.5",     active:"2h ago",    current:false },
  { device:"Windows · Firefox",ip:"192.168.1.22", active:"3d ago",    current:false },
]

const LOGIN_HISTORY = [
  { event:"Successful login",      ip:"192.168.1.1",  device:"Mac OS", time:"Just now" },
  { event:"Successful login",      ip:"10.0.0.5",     device:"iOS",    time:"2h ago" },
  { event:"Failed login attempt",  ip:"203.0.113.42", device:"Unknown",time:"1d ago" },
  { event:"Password changed",      ip:"192.168.1.1",  device:"Mac OS", time:"3d ago" },
]

export default function ProfilePage() {
  const [tab, setTab] = useState("profile")
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState<number|null>(null)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TABS = [
    { id:"profile",       label:"Profile" },
    { id:"security",      label:"Security" },
    { id:"api",           label:"API Keys" },
    { id:"notifications", label:"Notifications" },
    { id:"sessions",      label:"Sessions" },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <style>{S}</style>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">Account Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your profile, security, API keys, and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-white/5 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold whitespace-nowrap d-tab ${tab===t.id?"d-tab-active text-white":"text-zinc-600 hover:text-zinc-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE ──────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="space-y-6">
          <div className="d-glass rounded-2xl p-6">
            <h2 className="font-black text-lg mb-5">Personal Information</h2>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-2xl font-black">
                  AC
                </div>
                <button className="d-glass px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-all">
                  Change Avatar
                </button>
              </div>
              {/* Fields */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[["First Name","Acme"],["Last Name","Corp"]].map(([label,val])=>(
                    <div key={label}>
                      <label className="text-xs text-zinc-600 font-semibold uppercase tracking-widest block mb-1.5">{label}</label>
                      <input defaultValue={val} className="w-full d-input rounded-xl px-4 py-3 text-sm text-white" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-zinc-600 font-semibold uppercase tracking-widest block mb-1.5">Email Address</label>
                  <input type="email" defaultValue="abhibhidevelopers@abhibhidevelopers.online" readOnly
                    className="w-full d-input rounded-xl px-4 py-3 text-sm text-zinc-500 cursor-not-allowed" />
                  <p className="text-xs text-zinc-700 mt-1">Contact support to change your email.</p>
                </div>
                <div>
                  <label className="text-xs text-zinc-600 font-semibold uppercase tracking-widest block mb-1.5">Timezone</label>
                  <select className="w-full d-input rounded-xl px-4 py-3 text-sm text-white bg-transparent">
                    {["Asia/Kolkata (IST)","Pacific Time (PT)","Eastern Time (ET)","UTC"].map(tz=>(
                      <option key={tz} style={{background:"#111"}}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-600 font-semibold uppercase tracking-widest block mb-1.5">Company / Organization</label>
                  <input defaultValue="Acme Corp" className="w-full d-input rounded-xl px-4 py-3 text-sm text-white" />
                </div>
                <button onClick={handleSave}
                  className={`d-btn px-6 py-3 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all ${saved?"bg-emerald-600":"d-btn"}`}>
                  {saved ? "✓ Saved!" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="d-glass rounded-2xl p-6 border border-red-500/15">
            <h2 className="font-black text-lg text-red-400 mb-2">Danger Zone</h2>
            <p className="text-sm text-zinc-500 mb-4">These actions are irreversible. Please proceed with caution.</p>
            <div className="flex flex-wrap gap-3">
              <button className="d-glass px-4 py-2.5 rounded-xl text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                Delete Account
              </button>
              <button className="d-glass px-4 py-2.5 rounded-xl text-sm text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-all">
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY ──────────────────────────────────────────── */}
      {tab === "security" && (
        <div className="space-y-5">
          {/* 2FA */}
          <div className="d-glass rounded-2xl p-6">
            <h2 className="font-black text-lg mb-4">Two-Factor Authentication</h2>
            <div className="d-glass rounded-xl p-4 flex items-center gap-4 border border-amber-500/20">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">📱</div>
              <div className="flex-1">
                <p className="font-bold text-sm">Authenticator App</p>
                <p className="text-xs text-zinc-600">Not configured — highly recommended</p>
              </div>
              <button className="d-btn px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">Enable 2FA</button>
            </div>
          </div>

          {/* Password */}
          <div className="d-glass rounded-2xl p-6">
            <h2 className="font-black text-lg mb-4">Change Password</h2>
            <div className="space-y-3 max-w-md">
              {["Current Password","New Password","Confirm New Password"].map(f=>(
                <div key={f}>
                  <label className="text-xs text-zinc-600 font-semibold uppercase tracking-widest block mb-1.5">{f}</label>
                  <input type="password" className="w-full d-input rounded-xl px-4 py-3 text-sm text-white" />
                </div>
              ))}
              <button className="d-btn px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all mt-2">
                Update Password
              </button>
            </div>
          </div>

          {/* Login history */}
          <div className="d-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="font-black text-lg">Login History</h2>
            </div>
            <div className="divide-y divide-white/5">
              {LOGIN_HISTORY.map((l,i)=>(
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${l.event.includes("Failed")?"bg-red-400":"bg-green-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{l.event}</p>
                    <p className="text-xs text-zinc-600">{l.ip} · {l.device}</p>
                  </div>
                  <span className="text-xs text-zinc-700 whitespace-nowrap">{l.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── API KEYS ──────────────────────────────────────────── */}
      {tab === "api" && (
        <div className="space-y-5">
          <div className="d-glass rounded-2xl p-5 border border-amber-500/15 flex gap-3">
            <span className="text-amber-400 text-sm mt-0.5">⚠</span>
            <p className="text-xs text-amber-200">Never share API keys publicly. If compromised, revoke immediately and generate a new key.</p>
          </div>

          <div className="d-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-black">API Keys</h2>
              <button className="d-btn px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">+ Generate Key</button>
            </div>
            <div className="divide-y divide-white/5">
              {API_KEYS.map((key, i)=>(
                <div key={i} className="px-5 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                  <div>
                    <p className="text-sm font-bold">{key.name}</p>
                    <p className="text-xs text-zinc-600">Last used: {key.lastUsed}</p>
                  </div>
                  <p className="font-mono text-xs text-zinc-500 hidden md:block">
                    {showKey===i ? "sk_live_DEMO_KEY_HIDDEN_FOR_SECURITY" : key.prefix}
                  </p>
                  <button onClick={()=>setShowKey(showKey===i?null:i)} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
                    {showKey===i?"Hide":"Show"}
                  </button>
                  <button className="d-glass px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="d-glass rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-2">API Documentation</h3>
            <p className="text-xs text-zinc-600 mb-3">Use these keys to authenticate with the NexusAI REST API.</p>
            <div className="d-glass rounded-xl p-4 font-mono text-xs text-zinc-400 overflow-x-auto">
              {`curl -X POST https://api.nexusai.app/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'`}
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ─────────────────────────────────────── */}
      {tab === "notifications" && (
        <div className="d-glass rounded-2xl p-6">
          <h2 className="font-black text-lg mb-5">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              {title:"Product Updates",       desc:"Major new features and improvements",      on:true,  locked:false},
              {title:"Billing & Invoices",    desc:"Receipts and renewal reminders",            on:true,  locked:true},
              {title:"AI Usage Alerts",       desc:"Alerts when approaching token limits",      on:true,  locked:false},
              {title:"Ticket Updates",        desc:"Replies and status changes on your tickets",on:true,  locked:false},
              {title:"Security Alerts",       desc:"Suspicious login activity warnings",        on:true,  locked:true},
              {title:"Marketing & Promos",    desc:"Occasional discounts and offers",           on:false, locked:false},
            ].map((pref,i)=>(
              <div key={i} className={`flex items-center justify-between py-4 border-b border-white/5 last:border-0 ${pref.locked?"opacity-60":""}`}>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    {pref.title}
                    {pref.locked && <span className="text-[10px] d-glass px-1.5 py-0.5 rounded text-zinc-600">Required</span>}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">{pref.desc}</p>
                </div>
                <label className={`relative inline-flex items-center ${pref.locked?"cursor-not-allowed":"cursor-pointer"}`}>
                  <input type="checkbox" defaultChecked={pref.on} disabled={pref.locked} className="sr-only peer" />
                  <div className="w-10 h-5.5 bg-zinc-800 peer-checked:bg-violet-600 rounded-full transition-all relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4.5" style={{height:"22px"}}></div>
                </label>
              </div>
            ))}
          </div>
          <button className="d-btn px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all mt-4">
            Save Preferences
          </button>
        </div>
      )}

      {/* ── SESSIONS ──────────────────────────────────────────── */}
      {tab === "sessions" && (
        <div className="space-y-4">
          <div className="d-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-black">Active Sessions</h2>
              <button className="d-glass px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                Revoke All Others
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {SESSIONS.map((s,i)=>(
                <div key={i} className={`px-5 py-4 flex items-center gap-4 ${s.current?"bg-violet-500/5":""}`}>
                  <div className="w-10 h-10 rounded-xl d-glass flex items-center justify-center text-lg">
                    {s.device.includes("Mac")?"💻":s.device.includes("iOS")?"📱":"🖥"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      {s.device}
                      {s.current && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black tracking-wider">CURRENT</span>}
                    </p>
                    <p className="text-xs text-zinc-600">IP: {s.ip} · {s.active}</p>
                  </div>
                  {!s.current && (
                    <button className="d-glass px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all shrink-0">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
