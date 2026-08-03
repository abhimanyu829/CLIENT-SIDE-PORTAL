"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, Clock3, ExternalLink, LifeBuoy, Loader2, ShoppingBag, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const waitingSteps = ["PENDING", "PREPARING", "DEPLOYING", "DATABASE_CONFIG", "GENERATING_CREDENTIALS", "QUALITY_CHECK", "COMPLETED"]

export default function ServiceWorkspaceClient({ serviceId }: { serviceId: string }) {
  const [service, setService] = useState<any>(null)
  const [deployment, setDeployment] = useState<any>(null)
  const [addons, setAddons] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requesting, setRequesting] = useState(false)
  const [requestType, setRequestType] = useState("FEATURE")
  const [subject, setSubject] = useState("")
  const [details, setDetails] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const responses = await Promise.all([fetch(`/api/services/${serviceId}`, { cache: "no-store" }), fetch(`/api/services/${serviceId}/deployment`, { cache: "no-store" }), fetch("/api/addons", { cache: "no-store" }), fetch(`/api/services/${serviceId}/requests`, { cache: "no-store" })])
      const payloads = await Promise.all(responses.map((response) => response.json()))
      if (!responses[0].ok) throw new Error(payloads[0].error ?? "Service not found")
      setService(payloads[0].data); setDeployment(payloads[1].data ?? null); setAddons(payloads[2].data ?? []); setRequests(payloads[3].data ?? [])
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load workspace") }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [serviceId])

  // Continuous deployment updates: poll while the service is not yet ACTIVE.
  // (Pusher "service-update" events cover realtime; polling is the fallback.)
  useEffect(() => {
    if (!service || service.status === "ACTIVE") return
    const timer = setInterval(() => { void load() }, 5000)
    return () => clearInterval(timer)
  }, [service?.status, serviceId])

  async function renewService() {
    const response = await fetch(`/api/services/${serviceId}/renew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    const payload = await response.json()
    if (!response.ok) { setError(payload.error ?? "Unable to start renewal"); return }
    if (payload.data?.checkoutUrl) window.location.href = payload.data.checkoutUrl
  }

  function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) { resolve(true); return }
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  async function requestAddon(addon: { id: string; name: string; price: number; currency: string }) {
    setError("")
    const loaded = await loadRazorpay()
    if (!loaded) { setError("Payment gateway failed to load. Please try again."); return }

    try {
      // 1. Create a Razorpay order for the addon price (backend reads price from DB)
      const orderRes = await fetch("/api/payments/razorpay/addon-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchasedServiceId: serviceId, addonId: addon.id }),
      })
      const orderData = await orderRes.json()
      if (!orderData.success) { setError(orderData.error?.message ?? "Unable to create payment order"); return }

      const { keyId, razorpayOrder, internalOrderId } = orderData.data

      const options = {
        key: keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: "Auralis Neural",
        description: `Add-on: ${addon.name}`,
        order_id: razorpayOrder.id,
        handler: async function (response: any) {
          // 2. Verify payment
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              orderId: internalOrderId,
            }),
          })
          if (!verifyRes.ok) { setError("Payment verification failed. Please contact support."); return }
          // 3. Create upgrade request (marks as PAID)
          const upgradeRes = await fetch(`/api/services/${serviceId}/upgrades`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addonId: addon.id, orderId: internalOrderId }),
          })
          const upgradeData = await upgradeRes.json()
          if (!upgradeRes.ok) { setError(upgradeData.error ?? "Upgrade request failed"); return }
          await load()
        },
        theme: { color: "#7c3aed" },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
    }
  }

  async function submitRequest() {
    setRequesting(true)
    try {
      const response = await fetch(`/api/services/${serviceId}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: requestType, subject, details }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Unable to submit request")
      setSubject(""); setDetails(""); await load()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to submit request") }
    finally { setRequesting(false) }
  }

  if (loading) return <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (error && !service) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
  if (!service) return null

  const active = service.status === "ACTIVE"
  const deploymentStatus = deployment?.deploymentStatus ?? service.deployment?.status ?? "PENDING"
  const currentStep = Math.max(0, waitingSteps.indexOf(deploymentStatus))
  const config = service.config ?? {}

  return <div className="mx-auto max-w-7xl space-y-6 pb-12"><Button asChild variant="ghost" size="sm" className="-ml-3"><Link href="/dashboard/services"><ArrowLeft className="mr-2 h-4 w-4" /> My Services</Link></Button>{error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4" /> {error}</div>}<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm text-muted-foreground">Managed service workspace</p><h1 className="font-serif text-3xl font-semibold">{service.product.name}</h1><p className="mt-1 text-sm text-muted-foreground">{service.orderItem.name} · {service.status.replaceAll("_", " ")}</p></div>{active && <div className="flex flex-wrap gap-2">{config.applicationUrl && <Button asChild><a href={config.applicationUrl} target="_blank" rel="noreferrer">Open application <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}{config.documentationUrl && <Button asChild variant="outline"><a href={config.documentationUrl} target="_blank" rel="noreferrer">Documentation</a></Button>}</div>}</div>{!active ? <><Card className="overflow-hidden border-amber-200"><CardHeader className="bg-amber-50/70"><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-amber-700" /> Preparing your deployment</CardTitle><CardDescription>Payment received. Credentials stay protected until deployment quality checks complete.</CardDescription></CardHeader><CardContent className="space-y-6 pt-6"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Current status</p><p className="mt-1 font-medium">{deploymentStatus.replaceAll("_", " ")}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Queue ahead</p><p className="mt-1 font-medium">{deployment?.queueAhead ?? 0} customer(s)</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Estimated completion</p><p className="mt-1 font-medium">{deployment?.estimatedCompletionAt ? new Date(deployment.estimatedCompletionAt).toLocaleString() : "Deployment team will update this"}</p></div></div><div className="grid gap-3 md:grid-cols-7">{waitingSteps.map((step, index) => <div key={step} className="flex items-center gap-2 md:flex-col md:items-start"><span className={index <= currentStep ? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" : "flex h-7 w-7 items-center justify-center rounded-full border text-xs text-muted-foreground"}>{index < currentStep ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span><span className={index <= currentStep ? "text-xs font-medium" : "text-xs text-muted-foreground"}>{step.replaceAll("_", " ")}</span></div>)}</div></CardContent></Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Recommended services", "/marketplace"], ["Documentation", service.product.documentationUrl ?? "/marketplace"], ["Video tutorials", config.tutorialUrl ?? "/marketplace"], ["Community & support", "/dashboard/tickets"]].map(([label, href]) => <Button key={String(label)} asChild variant="outline" className="justify-start"><Link href={String(href)}>{label}</Link></Button>)}</div></> : <div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Service access</CardTitle><CardDescription>Deployment configuration released after activation.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[["Application URL", config.applicationUrl], ["Admin URL", config.adminUrl], ["Username", config.username], ["Password", config.password], ["Domain", config.domain], ["Support level", config.supportLevel], ["Storage", config.allocatedStorage], ["CPU / RAM", [config.allocatedCpu, config.allocatedRam].filter(Boolean).join(" / ")]].filter((item) => item[1]).map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-all text-sm font-medium">{String(value)}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Subscription</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p><span className="text-muted-foreground">Activated:</span> {service.activationDate ? new Date(service.activationDate).toLocaleDateString() : "-"}</p><p><span className="text-muted-foreground">Expiry:</span> {service.expiryDate ? new Date(service.expiryDate).toLocaleDateString() : "Lifetime"}</p><p><span className="text-muted-foreground">Remaining:</span> {service.remainingDays ?? "Unlimited"} {service.remainingDays !== null ? "days" : ""}</p><Button asChild variant="outline" className="w-full"><Link href="/dashboard/invoices">Download invoice</Link></Button>{service.expiryDate && <Button className="w-full" onClick={() => void renewService()}>Renew service</Button>}{(service.order?.payments?.length ?? 0) > 0 && <div className="space-y-1 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">Payment history</p>{service.order.payments.map((payment: any) => <p key={payment.id} className="flex justify-between text-xs"><span>{payment.gateway} · {payment.status}</span><span>{payment.currency} {Number(payment.amount).toFixed(2)}</span></p>)}</div>}</CardContent></Card></div>}<div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Upgrade center</CardTitle><CardDescription>Pricing comes from NexusAI backend catalog.</CardDescription></CardHeader><CardContent className="space-y-3">{addons.length === 0 ? <p className="text-sm text-muted-foreground">No add-ons available for this service.</p> : addons.map((addon) => <div key={addon.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{addon.name}</p><p className="text-xs text-muted-foreground">{addon.description ?? addon.category}</p><p className="mt-1 text-xs font-medium">{addon.currency} {Number(addon.price).toFixed(2)}</p></div><Button size="sm" variant="outline" onClick={() => void requestAddon(addon)}><ShoppingBag className="mr-1 h-3.5 w-3.5" /> Request</Button></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> Request service support</CardTitle><CardDescription>Feature, migration, customization, or infrastructure request.</CardDescription></CardHeader><CardContent className="space-y-3"><select value={requestType} onChange={(event) => setRequestType(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="FEATURE">Feature request</option><option value="BUG_FIX">Bug fix</option><option value="DESIGN_CHANGE">Design change</option><option value="CUSTOMIZATION">Customization</option><option value="MIGRATION">Migration</option><option value="CONSULTATION">Consultation</option><option value="PERFORMANCE_UPGRADE">Performance upgrade</option><option value="DATABASE_UPGRADE">Database upgrade</option><option value="SECURITY_UPGRADE">Security upgrade</option><option value="INFRASTRUCTURE_UPGRADE">Infrastructure upgrade</option></select><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Request subject" /><Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe request, expected outcome, timeline, and business impact." rows={4} /><Button disabled={requesting || subject.trim().length < 3 || details.trim().length < 10} onClick={() => void submitRequest()}>{requesting ? "Submitting..." : "Submit request"}</Button></CardContent></Card></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Service requests</CardTitle></CardHeader><CardContent>{requests.length === 0 ? <p className="text-sm text-muted-foreground">No support requests submitted.</p> : <div className="space-y-2">{requests.map((request) => <div key={request.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{request.name}</p><span className="text-xs text-muted-foreground">{request.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>{request.adminNotes && <p className="mt-2 rounded-lg bg-muted p-2 text-xs">Admin: {request.adminNotes}</p>}</div>)}</div>}</CardContent></Card></div>
}
