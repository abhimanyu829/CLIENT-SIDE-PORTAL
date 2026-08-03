"use client"

import { FormEvent, useEffect, useState } from "react"
import { Activity, AlertCircle, CheckCircle2, Loader2, Pause, Play, RefreshCw, Server, Settings2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const deploymentSteps = ["PENDING", "PREPARING", "DEPLOYING", "DATABASE_CONFIG", "GENERATING_CREDENTIALS", "QUALITY_CHECK", "COMPLETED", "FAILED"]

export default function DeploymentCenterClient() {
  const [services, setServices] = useState<any[]>([])
  const [monitoring, setMonitoring] = useState<any>(null)
  const [addons, setAddons] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [nextStatus, setNextStatus] = useState("PREPARING")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [addonForm, setAddonForm] = useState({ name: "", slug: "", category: "GENERAL", price: "", description: "" })
  const [upgrades, setUpgrades] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])

  async function load() {
    setLoading(true); setError("")
    try {
      const responses = await Promise.all([fetch("/api/admin/deployment-center", { cache: "no-store" }), fetch("/api/admin/deployment-center/monitoring", { cache: "no-store" }), fetch("/api/admin/deployment-center/addons", { cache: "no-store" }), fetch("/api/admin/deployment-center/upgrades", { cache: "no-store" }), fetch("/api/admin/deployment-center/requests?status=OPEN", { cache: "no-store" })])
      const payloads = await Promise.all(responses.map((response) => response.json()))
      if (!responses[0].ok) throw new Error(payloads[0].error ?? "Unable to load deployment center")
      setServices(payloads[0].data ?? []); setMonitoring(payloads[1].data ?? null); setAddons(payloads[2].data ?? []); setUpgrades(payloads[3].data ?? []); setRequests(payloads[4].data ?? [])
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load deployment center") }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function selectService(id: string) {
    setError("")
    try {
      const response = await fetch(`/api/admin/deployment-center/${id}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Unable to load service")
      setSelected(payload.data); setConfig(Object.fromEntries(Object.entries(payload.data.config ?? {}).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])))
      const current = payload.data.deployment?.status ?? "PENDING"
      const currentIndex = deploymentSteps.indexOf(current)
      setNextStatus(deploymentSteps[Math.min(currentIndex + 1, deploymentSteps.length - 1)])
    } catch (selectError) { setError(selectError instanceof Error ? selectError.message : "Unable to load service") }
  }

  async function saveConfig(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/deployment-center/${selected.id}/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to save configuration")
      await selectService(selected.id)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save configuration") }
    finally { setSaving(false) }
  }

  async function updateStatus() {
    if (!selected) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/deployment-center/${selected.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, config: nextStatus === "COMPLETED" ? config : undefined }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to update deployment")
      await Promise.all([selectService(selected.id), load()])
    } catch (statusError) { setError(statusError instanceof Error ? statusError.message : "Unable to update deployment") }
    finally { setSaving(false) }
  }

  async function lifecycle(action: string) {
    if (!selected) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/deployment-center/${selected.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to run action")
      await Promise.all([selectService(selected.id), load()])
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Unable to run action") }
    finally { setSaving(false) }
  }

  async function applyUpgrade(upgradeId: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/deployment-center/upgrades/${upgradeId}/apply`, { method: "POST" })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to apply upgrade")
      await load()
    } catch (upgradeError) { setError(upgradeError instanceof Error ? upgradeError.message : "Unable to apply upgrade") }
    finally { setSaving(false) }
  }

  async function markUpgradePaid(upgradeId: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/deployment-center/upgrades/${upgradeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAID" }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to mark upgrade paid")
      await load()
    } catch (upgradeError) { setError(upgradeError instanceof Error ? upgradeError.message : "Unable to mark upgrade paid") }
    finally { setSaving(false) }
  }

  async function resolveRequest(requestId: string, status: string) {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/deployment-center/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, status }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to update request")
      await load()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to update request") }
    finally { setSaving(false) }
  }

  async function createAddon(event: FormEvent) {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch("/api/admin/deployment-center/addons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...addonForm, price: Number(addonForm.price), currency: "INR" }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to create add-on")
      setAddonForm({ name: "", slug: "", category: "GENERAL", price: "", description: "" }); await load()
    } catch (addonError) { setError(addonError instanceof Error ? addonError.message : "Unable to create add-on") }
    finally { setSaving(false) }
  }

  const metrics = monitoring ? [{ label: "Services", value: monitoring.totalServices }, { label: "Waiting deployment", value: monitoring.deployments?.pending }, { label: "Completed", value: monitoring.deployments?.completed }, { label: "Open requests", value: monitoring.openRequests }] : []

  return <div className="mx-auto max-w-[1600px] space-y-6 pb-10"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm text-muted-foreground">Admin / Operations</p><h1 className="font-serif text-3xl font-semibold tracking-tight">Deployment Center</h1><p className="mt-1 text-sm text-muted-foreground">Customer service provisioning, lifecycle control, upgrades, and business monitoring.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Refresh</Button></div>{error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4" /> {error}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Card key={metric.label}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-1 text-2xl font-semibold">{metric.value ?? 0}</p></CardContent></Card>)}</div><div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]"><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-4 w-4" /> Deployment queue</CardTitle><CardDescription>{services.length} provisioned services</CardDescription></CardHeader><CardContent className="max-h-[680px] space-y-2 overflow-y-auto">{loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : services.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No service deployments.</p> : services.map((service) => <button key={service.id} onClick={() => void selectService(service.id)} className={selected?.id === service.id ? "w-full rounded-xl border border-primary bg-primary/5 p-3 text-left" : "w-full rounded-xl border p-3 text-left hover:bg-muted"}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{service.product.name}</p><span className="text-[10px] text-muted-foreground">{service.status.replaceAll("_", " ")}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{service.user.name} Â· {service.user.email}</p><p className="mt-1 text-xs font-medium text-primary">{service.deployment?.status?.replaceAll("_", " ") ?? "PENDING"}</p></button>)}</CardContent></Card>{selected ? <div className="space-y-6"><Card><CardHeader><CardTitle>{selected.product.name}</CardTitle><CardDescription>{selected.user.name} Â· {selected.user.email} Â· {selected.order.orderNumber}</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Plan</p><p className="mt-1 text-sm font-medium">{selected.orderItem.tier?.name ?? "One-time"}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Deployment</p><p className="mt-1 text-sm font-medium">{selected.deployment?.status?.replaceAll("_", " ")}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Payment</p><p className="mt-1 text-sm font-medium">{selected.order.payments?.[0]?.status ?? selected.order.status}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Service status</p><p className="mt-1 text-sm font-medium">{selected.status.replaceAll("_", " ")}</p></div></CardContent></Card><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Service configuration</CardTitle><CardDescription>Secrets are encrypted before persistence. Timeline never stores raw credentials.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={saveConfig}>{[["applicationUrl", "Application URL"], ["adminUrl", "Admin URL"], ["username", "Username"], ["password", "Password"], ["temporaryPassword", "Temporary password"], ["domain", "Domain"], ["subdomain", "Subdomain"], ["sslStatus", "SSL status"], ["allocatedStorage", "Allocated storage"], ["allocatedCpu", "Allocated CPU"], ["allocatedRam", "Allocated RAM"], ["databaseName", "Database name"], ["databaseStorage", "Database storage"], ["databaseSize", "Database size"], ["dockerContainerName", "Docker container name"], ["containerId", "Container ID"], ["imageVersion", "Image version"], ["gitRepository", "Git repository"], ["branch", "Branch"], ["supportLevel", "Support level"], ["documentationUrl", "Documentation URL"], ["tutorialUrl", "Tutorial URL"], ["monitoringStatus", "Monitoring status"], ["expiryDate", "Expiry date (ISO)"], ["renewalDate", "Renewal date (ISO)"]].map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={key}>{label}</Label><Input id={key} type={key === "password" || key === "temporaryPassword" ? "password" : "text"} value={config[key] ?? ""} onChange={(event) => setConfig((current) => ({ ...current, [key]: event.target.value }))} /></div>)}<div className="space-y-1.5 sm:col-span-2"><Label htmlFor="deploymentNotes">Deployment notes</Label><Textarea id="deploymentNotes" value={config.deploymentNotes ?? ""} onChange={(event) => setConfig((current) => ({ ...current, deploymentNotes: event.target.value }))} rows={3} /></div><div className="sm:col-span-2"><Button disabled={saving} type="submit">Save configuration</Button></div></form></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Controls</CardTitle></CardHeader><CardContent className="space-y-3"><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{deploymentSteps.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><Button className="w-full" disabled={saving} onClick={() => void updateStatus()}><CheckCircle2 className="mr-2 h-4 w-4" /> Update deployment</Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" disabled={saving} onClick={() => void lifecycle("PAUSE")}><Pause className="mr-1 h-3.5 w-3.5" /> Pause</Button><Button variant="outline" size="sm" disabled={saving} onClick={() => void lifecycle("RESUME")}><Play className="mr-1 h-3.5 w-3.5" /> Resume</Button><Button variant="outline" size="sm" disabled={saving} onClick={() => void lifecycle("RESTART")}>Restart</Button><Button variant="destructive" size="sm" disabled={saving} onClick={() => void lifecycle("SUSPEND")}>Suspend</Button></div><div className="grid grid-cols-2 gap-2 border-t pt-3">{[["START", "Start"], ["STOP", "Stop"], ["ACTIVATE", "Activate"], ["DEACTIVATE", "Deactivate"], ["CONTINUE", "Continue"], ["CLONE", "Clone"], ["ARCHIVE", "Archive"], ["DELETE", "Delete"]].map(([action, label]) => <Button key={action} variant={action === "DELETE" ? "destructive" : "outline"} size="sm" disabled={saving} onClick={() => { if (action === "DELETE" && !window.confirm("Mark this service as deleted? Data stays in the database.")) return; void lifecycle(action) }}>{label}</Button>)}</div><div className="grid grid-cols-2 gap-2 border-t pt-3"><Button variant="outline" size="sm" disabled={saving} onClick={() => { const days = Number(window.prompt("Extend subscription by how many days?", "30")); if (days > 0) void fetch(`/api/admin/deployment-center/${selected.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "EXTEND", days }) }).then(() => Promise.all([selectService(selected.id), load()])) }}>Extend</Button><Button variant="outline" size="sm" disabled={saving} onClick={() => { const days = Number(window.prompt("Renew subscription for how many days?", "30")); if (days > 0) void fetch(`/api/admin/deployment-center/${selected.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RENEW", days }) }).then(() => Promise.all([selectService(selected.id), load()])) }}>Renew</Button><Button variant="outline" size="sm" disabled={saving} className="col-span-2" onClick={() => { const newUserId = window.prompt("Transfer service to user ID:"); if (newUserId) void fetch(`/api/admin/deployment-center/${selected.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "TRANSFER", newUserId }) }).then(() => Promise.all([selectService(selected.id), load()])) }}>Transfer service</Button></div></CardContent></Card></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Customer timeline</CardTitle></CardHeader><CardContent className="space-y-3">{selected.timeline?.length === 0 ? <p className="text-sm text-muted-foreground">No timeline events.</p> : selected.timeline?.map((event: any) => <div key={event.id} className="border-l-2 border-primary/30 pl-3"><p className="text-sm font-medium">{event.message}</p><p className="text-xs text-muted-foreground">{event.type} Â· {new Date(event.createdAt).toLocaleString()}</p></div>)}</CardContent></Card></div> : <Card className="flex min-h-[500px] items-center justify-center"><CardContent className="text-center"><Server className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Select a deployment to configure and activate it.</p></CardContent></Card>}</div><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Add-on catalog</CardTitle></CardHeader><CardContent className="space-y-3">{addons.length === 0 ? <p className="text-sm text-muted-foreground">No add-ons created.</p> : addons.map((addon) => <div key={addon.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">{addon.name}</p><p className="text-xs text-muted-foreground">{addon.category} Â· {addon.currency} {Number(addon.price).toFixed(2)}</p></div><span className={addon.isActive ? "text-xs text-emerald-700" : "text-xs text-red-700"}>{addon.isActive ? "Active" : "Disabled"}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Create add-on</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={createAddon}><Input placeholder="Name" value={addonForm.name} onChange={(event) => setAddonForm((current) => ({ ...current, name: event.target.value }))} /><Input placeholder="slug-name" value={addonForm.slug} onChange={(event) => setAddonForm((current) => ({ ...current, slug: event.target.value }))} /><Input placeholder="Category" value={addonForm.category} onChange={(event) => setAddonForm((current) => ({ ...current, category: event.target.value }))} /><Input type="number" min="0" placeholder="Price (INR)" value={addonForm.price} onChange={(event) => setAddonForm((current) => ({ ...current, price: event.target.value }))} /><Textarea placeholder="Description" value={addonForm.description} onChange={(event) => setAddonForm((current) => ({ ...current, description: event.target.value }))} rows={3} /><Button type="submit" disabled={saving || !addonForm.name || !addonForm.slug || !addonForm.price}>Create add-on</Button></form></CardContent></Card></div><div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Upgrade requests</CardTitle><CardDescription>Confirm payment, then apply the upgrade to the customer workspace.</CardDescription></CardHeader><CardContent className="space-y-3">{upgrades.length === 0 ? <p className="text-sm text-muted-foreground">No upgrade requests.</p> : upgrades.map((upgrade) => <div key={upgrade.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{upgrade.snapshot?.name ?? "Add-on"} Â· {upgrade.status}</p><p className="text-xs text-muted-foreground">{upgrade.user?.email} Â· {upgrade.purchasedService?.orderItem?.name} Â· {upgrade.snapshot?.currency} {Number(upgrade.snapshot?.price ?? 0).toFixed(2)}</p></div><div className="flex gap-2">{upgrade.status === "PENDING" && <Button size="sm" variant="outline" disabled={saving} onClick={() => void markUpgradePaid(upgrade.id)}>Mark paid</Button>}{(upgrade.status === "PENDING" || upgrade.status === "PAID") && <Button size="sm" disabled={saving} onClick={() => void applyUpgrade(upgrade.id)}>Apply</Button>}</div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Service requests</CardTitle><CardDescription>Feature, bug, migration, and customization requests from customers.</CardDescription></CardHeader><CardContent className="space-y-3">{requests.length === 0 ? <p className="text-sm text-muted-foreground">No open requests.</p> : requests.map((request) => <div key={request.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{request.name}</p><span className="text-xs text-muted-foreground">{request.type.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-muted-foreground">{request.email} Â· {new Date(request.createdAt).toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">{request.reason}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => void resolveRequest(request.id, "CLOSED")}>Resolve</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => void resolveRequest(request.id, "REJECTED")}>Reject</Button></div></div>)}</CardContent></Card></div></div>
}

