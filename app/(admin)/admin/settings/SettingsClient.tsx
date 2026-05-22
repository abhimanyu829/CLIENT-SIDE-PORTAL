"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  createFeatureFlag,
  updateFeatureFlag,
  toggleFeatureFlag,
  saveGlobalConfiguration
} from "./actions"
import {
  Settings, ToggleLeft, ToggleRight, Webhook, Mail,
  Activity, Sliders, Layout, ShieldAlert, Plus, Edit, X,
  SlidersHorizontal, Check, RefreshCw
} from "lucide-react"

interface FeatureFlag {
  id: string
  name: string
  description: string
  isEnabled: boolean
  rolloutPercent: number
  targetUserIds: string[]
  createdAt: Date
  updatedAt: Date
}

interface Props {
  featureFlags: FeatureFlag[]
}

export default function SettingsClient({ featureFlags }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("branding")
  const [loading, setLoading] = useState(false)

  // Global branding state
  const [platformName, setPlatformName] = useState("AbhiBhi Platforms")
  const [brandingLogo, setBrandingLogo] = useState("https://abhibhi.com/logo.png")
  const [metaTitle, setMetaTitle] = useState("AbhiBhi Admin - Multi SaaS Portal")
  const [metaDescription, setMetaDescription] = useState("Monetization and customer analytics platform dashboard.")

  // Feature Flag Modal state
  const [flagModal, setFlagModal] = useState<{ mode: "create" | "edit"; data?: FeatureFlag } | null>(null)
  const [flagName, setFlagName] = useState("")
  const [flagDesc, setFlagDesc] = useState("")
  const [flagEnabled, setFlagEnabled] = useState(true)
  const [flagRollout, setFlagRollout] = useState(100)
  const [flagTargets, setFlagTargets] = useState("")

  // Webhooks simulation lists
  const webhookLogs = [
    { id: "wh_1", event: "payment_intent.succeeded", gateway: "Stripe", date: new Date().toLocaleTimeString(), status: "SUCCESS" },
    { id: "wh_2", event: "subscription.cancelled", gateway: "Stripe", date: new Date(Date.now() - 30 * 60000).toLocaleTimeString(), status: "SUCCESS" },
    { id: "wh_3", event: "payment.failed", gateway: "Razorpay", date: new Date(Date.now() - 2 * 3600000).toLocaleTimeString(), status: "FAILED" }
  ]

  // Notifications SMTP state
  const [smtpServer, setSmtpServer] = useState("smtp.sendgrid.net")
  const [smtpUser, setSmtpUser] = useState("apikey")
  const [slackWebhook, setSlackWebhook] = useState("https://hooks.slack.com/services/T00/B00/X00")

  // System diagnostics mock metrics
  const systemMetrics = {
    cpuUsage: "12%",
    ramUsage: "2.4 GB / 8.0 GB",
    diskUsage: "45.2 GB / 100 GB",
    dbConnections: "18 active",
    nodeVersion: "v20.11.0",
    postgresVersion: "PostgreSQL 16.1",
  }

  const handleSaveBranding = async () => {
    setLoading(true)
    try {
      await saveGlobalConfiguration({ platformName, brandingLogo, metaTitle, metaDescription })
      toast({ title: "Configuration Saved", description: "Successfully updated metadata and global brand options." })
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFlag = async (flagId: string, currentState: boolean) => {
    try {
      await toggleFeatureFlag(flagId, !currentState)
      toast({ title: "Feature Flag Switched", description: `Turned ${!currentState ? "ON" : "OFF"} successfully.` })
      router.refresh()
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" })
    }
  }

  const handleSaveFlag = async () => {
    if (!flagName) return
    setLoading(true)
    try {
      const payload = {
        name: flagName,
        description: flagDesc,
        isEnabled: flagEnabled,
        rolloutPercent: flagRollout,
        targetUserIds: flagTargets.split(",").map(t => t.trim()).filter(Boolean)
      }

      if (flagModal?.mode === "create") {
        await createFeatureFlag(payload)
        toast({ title: "Feature Flag Created", description: `Successfully created ${flagName.toUpperCase()}` })
      } else if (flagModal?.mode === "edit" && flagModal.data) {
        await updateFeatureFlag(flagModal.data.id, payload)
        toast({ title: "Feature Flag Saved", description: "Successfully updated configuration." })
      }
      setFlagModal(null)
      router.refresh()
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openFlagModal = (mode: "create" | "edit", data?: FeatureFlag) => {
    setFlagModal({ mode, data })
    if (mode === "edit" && data) {
      setFlagName(data.name)
      setFlagDesc(data.description)
      setFlagEnabled(data.isEnabled)
      setFlagRollout(data.rolloutPercent)
      setFlagTargets(data.targetUserIds.join(", "))
    } else {
      setFlagName("")
      setFlagDesc("")
      setFlagEnabled(true)
      setFlagRollout(100)
      setFlagTargets("")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Platform Configurations</h1>
          <p className="text-sm text-muted-foreground">Adjust SEO metadata, rollout gradual feature flags, monitor webhooks logs, and SMTP notifications.</p>
        </div>
      </div>

      <div className="flex border-b overflow-x-auto">
        {[
          { id: "branding", label: "General & Branding", icon: Settings },
          { id: "flags", label: "Feature Flags", icon: SlidersHorizontal },
          { id: "webhooks", label: "Webhooks Integration", icon: Webhook },
          { id: "smtp", label: "Notifications & SMTP", icon: Mail },
          { id: "system", label: "System Health & Diagnostic", icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 1. BRANDING TAB */}
      {activeTab === "branding" && (
        <div className="border rounded-xl p-5 bg-card shadow-sm max-w-2xl space-y-4">
          <h2 className="text-base font-bold">Branding, SEO & Metadata Configs</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Platform Name</label>
                <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Branding Logo Url</label>
                <Input value={brandingLogo} onChange={(e) => setBrandingLogo(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">SEO Page Title</label>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="mt-1" />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">SEO Page Description</label>
              <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} className="mt-1" />
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button onClick={handleSaveBranding} disabled={loading} className="bg-violet-600 hover:bg-violet-700">Save Configuration</Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FEATURE FLAGS TAB */}
      {activeTab === "flags" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openFlagModal("create")} size="sm" className="bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 mr-1" /> Create Feature Flag
            </Button>
          </div>

          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                  <th className="px-6 py-2.5">Flag Identifier</th>
                  <th className="px-6 py-2.5">Description</th>
                  <th className="px-6 py-2.5">Rollout Ratio</th>
                  <th className="px-6 py-2.5">State Toggles</th>
                  <th className="px-6 py-2.5 text-right">Configure</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {featureFlags.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-xs">No active feature flags configured</td></tr>
                ) : featureFlags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-muted/10 text-xs">
                    <td className="px-6 py-3 font-mono font-bold text-violet-600">{flag.name}</td>
                    <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{flag.description}</td>
                    <td className="px-6 py-3 font-mono font-semibold">{flag.rolloutPercent}% rollout</td>
                    <td className="px-6 py-3">
                      <button onClick={() => handleToggleFlag(flag.id, flag.isEnabled)} className="focus:outline-none">
                        {flag.isEnabled ? (
                          <ToggleRight className="h-7 w-7 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-zinc-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openFlagModal("edit", flag)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. WEBHOOKS INTEGRATION TAB */}
      {activeTab === "webhooks" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
            <h2 className="text-base font-bold flex items-center gap-1.5"><Webhook className="h-5 w-5 text-indigo-500" /> API Gateway Webhooks Config</h2>
            <p className="text-xs text-muted-foreground">Configure public API endpoint targets for external Stripe / Razorpay event triggers.</p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase">Stripe Webhook Target Endpoint</label>
                <Input value="https://api.abhibhi.com/api/webhooks/stripe" readOnly className="h-8 mt-1 text-xs bg-muted/30 select-all font-mono" />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase">Stripe Webhook Signing Secret</label>
                <Input type="password" value="whsec_830bca782cf*********************" readOnly className="h-8 mt-1 text-xs bg-muted/30" />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase">Razorpay Webhook Secret</label>
                <Input type="password" value="rzp_webhook_secret_998*********************" readOnly className="h-8 mt-1 text-xs bg-muted/30" />
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
            <h2 className="text-base font-bold">Simulated Webhook Inbound Events</h2>
            <p className="text-xs text-muted-foreground">Real-time listing of incoming webhooks processing queue status.</p>
            <div className="space-y-2">
              {webhookLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-center text-xs p-2.5 rounded border bg-muted/20">
                  <div>
                    <span className="font-mono font-bold text-violet-600">{log.event}</span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Gateway: {log.gateway} · {log.date}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    log.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>{log.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SMTP TAB */}
      {activeTab === "smtp" && (
        <div className="border rounded-xl p-5 bg-card shadow-sm max-w-2xl space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><Mail className="h-5 w-5 text-indigo-500" /> Notifications & SMTP Server Settings</h2>
          <p className="text-xs text-muted-foreground">Specify outbound mail server connections rules and developer Slack webhooks notification rules.</p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">SMTP Server Host</label>
                <Input value={smtpServer} onChange={(e) => setSmtpServer(e.target.value)} className="mt-1 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">SMTP Server User</label>
                <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="mt-1 text-xs" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Slack Webhooks Integration URL</label>
              <Input value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} className="mt-1 text-xs" />
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => toast({ title: "SMTP Settings Saved", description: "SMTP server and Slack hooks saved." })} className="bg-violet-600 hover:bg-violet-700">Save Mail Settings</Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SYSTEM HEALTH TAB */}
      {activeTab === "system" && (
        <div className="border rounded-xl p-5 bg-card shadow-sm max-w-2xl space-y-4 animate-in fade-in duration-200">
          <h2 className="text-base font-bold flex items-center gap-1.5"><Activity className="h-5 w-5 text-emerald-500" /> Host Environment Diagnostic Metrics</h2>
          <p className="text-xs text-muted-foreground">Real-time system load, engine runtime configurations details, and connection queues.</p>
          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 border rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">Server CPU usage</span>
              <p className="text-lg font-bold text-violet-600 mt-1 font-sans">{systemMetrics.cpuUsage}</p>
            </div>
            <div className="p-3 border rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">Memory Allocated</span>
              <p className="text-lg font-bold text-violet-600 mt-1 font-sans">{systemMetrics.ramUsage}</p>
            </div>
            <div className="p-3 border rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">Host Storage Size</span>
              <p className="text-lg font-bold text-violet-600 mt-1 font-sans">{systemMetrics.diskUsage}</p>
            </div>
            <div className="p-3 border rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">Active Postgres sessions</span>
              <p className="text-lg font-bold text-violet-600 mt-1 font-sans">{systemMetrics.dbConnections}</p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2 text-xs">
            <div className="flex justify-between"><span>Node Engine Runtime Version:</span><span className="font-mono font-semibold">{systemMetrics.nodeVersion}</span></div>
            <div className="flex justify-between"><span>Postgres database server version:</span><span className="font-mono font-semibold">{systemMetrics.postgresVersion}</span></div>
          </div>
        </div>
      )}

      {/* Feature Flag Form Modal */}
      {flagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border rounded-xl w-full max-w-lg p-6 relative shadow-2xl space-y-4">
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setFlagModal(null)}>
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold">{flagModal.mode === "create" ? "Create Feature Flag" : "Edit Feature Flag Details"}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Flag Name (Unique identifier)</label>
                <Input value={flagName} onChange={(e) => setFlagName(e.target.value)} placeholder="e.g. ENABLE_NEW_UI" className="mt-1" />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                <Input value={flagDesc} onChange={(e) => setFlagDesc(e.target.value)} placeholder="Brief memo describing what this flag controls." className="mt-1" />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Target Rollout Ratio (%)</span>
                  <span>{flagRollout}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={flagRollout}
                  onChange={(e) => setFlagRollout(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Specific Target User IDs (Comma-separated)</label>
                <Input value={flagTargets} onChange={(e) => setFlagTargets(e.target.value)} placeholder="e.g. usr_1, usr_2" className="mt-1 text-xs" />
              </div>

              <label className="flex items-center gap-2 text-sm pt-2">
                <input type="checkbox" checked={flagEnabled} onChange={(e) => setFlagEnabled(e.target.checked)} />
                Flag Active (visible to check APIs)
              </label>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => setFlagModal(null)}>Cancel</Button>
                <Button onClick={handleSaveFlag} size="sm" className="bg-violet-600 hover:bg-violet-700">Save Feature Flag</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
